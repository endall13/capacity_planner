import { workingDaysBefore, workingDaysAfter, type HolidayLike } from "@/lib/utils/dates";

export interface CapacitySprintInput {
  startDate: Date;
  endDate: Date;
  totalWorkingDays: number;
  holidays?: HolidayLike[];
}

export interface CapacityInput {
  baseVelocity: number;
  sprint: CapacitySprintInput;
  ptoDays?: number;
  sickDays?: number;
  sprintJoinDate?: Date | null;
  sprintLeaveDate?: Date | null;
  injectionPoints?: number;
}

export interface CapacityResult {
  totalDaysOff: number;
  missedDaysJoiningLate: number;
  missedDaysLeavingEarly: number;
  availableDays: number;
  dailyRate: number;
  plannedVelocity: number;
  effectiveVelocity: number;
}

/**
 * Core velocity formula chain. See CLAUDE.md "Core Velocity Formula".
 * availableDays is clamped to >= 0 — overlapping absence inputs (e.g. PTO during
 * a period already excluded by a late join) must never produce negative velocity.
 */
export function calculateCapacity(input: CapacityInput): CapacityResult {
  const { baseVelocity, sprint } = input;
  const ptoDays = input.ptoDays ?? 0;
  const sickDays = input.sickDays ?? 0;
  const injectionPoints = input.injectionPoints ?? 0;
  const holidays = sprint.holidays ?? [];

  const totalDaysOff = ptoDays + sickDays;

  const missedDaysJoiningLate = input.sprintJoinDate
    ? workingDaysBefore(input.sprintJoinDate, sprint.startDate, holidays)
    : 0;

  const missedDaysLeavingEarly = input.sprintLeaveDate
    ? workingDaysAfter(input.sprintLeaveDate, sprint.endDate, holidays)
    : 0;

  const availableDays = Math.max(
    0,
    sprint.totalWorkingDays - totalDaysOff - missedDaysJoiningLate - missedDaysLeavingEarly
  );

  const dailyRate = sprint.totalWorkingDays > 0 ? baseVelocity / sprint.totalWorkingDays : 0;
  const plannedVelocity = dailyRate * availableDays;
  const effectiveVelocity = plannedVelocity - injectionPoints;

  return {
    totalDaysOff,
    missedDaysJoiningLate,
    missedDaysLeavingEarly,
    availableDays,
    dailyRate,
    plannedVelocity,
    effectiveVelocity,
  };
}

/** Sum of effectiveVelocity across all engineers on a project for a given sprint. */
export function calculateTeamVelocity(entries: { effectiveVelocity: number }[]): number {
  return entries.reduce((sum, e) => sum + e.effectiveVelocity, 0);
}
