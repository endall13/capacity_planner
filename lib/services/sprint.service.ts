import { connectDB } from "@/lib/db/connection";
import Sprint from "@/lib/db/models/Sprint";
import { countWorkingDays, workingDaysBefore, workingDaysAfter } from "@/lib/utils/dates";

export { workingDaysBefore, workingDaysAfter };

export interface OrgHoliday {
  date: Date;
  name: string;
}

export interface SprintScheduleEntry {
  name: string;
  year: number;
  quarter: number;
  sprintIndexInQuarter: number;
  startDate: Date;
  endDate: Date;
  totalWorkingDays: number;
  holidays: OrgHoliday[];
}

const SPRINT_LENGTH_DAYS = 14;

function utcDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(utcDayKey(date) + days * 86_400_000);
}

function quarterOf(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function holidaysInRange(holidays: OrgHoliday[], start: Date, end: Date): OrgHoliday[] {
  const startKey = utcDayKey(start);
  const endKey = utcDayKey(end);
  return holidays.filter((h) => {
    const key = utcDayKey(h.date);
    return key >= startKey && key <= endKey;
  });
}

/**
 * Pure schedule computation — no DB access. Sprint belongs to the quarter/year
 * of its start date (boundary rule), even if it spans into the next quarter or year.
 */
export function computeSprintSchedule(
  anchorDate: Date,
  targetYear: number,
  holidays: OrgHoliday[] = []
): SprintScheduleEntry[] {
  const yearStart = new Date(Date.UTC(targetYear, 0, 1));
  const yearEnd = new Date(Date.UTC(targetYear, 11, 31));

  // Walk the anchor cadence forward to the first sprint start in or after yearStart.
  const anchorKey = utcDayKey(anchorDate);
  const yearStartKey = utcDayKey(yearStart);
  const diffCycles = Math.floor((yearStartKey - anchorKey) / (SPRINT_LENGTH_DAYS * 86_400_000));
  let cursor = addUtcDays(anchorDate, diffCycles * SPRINT_LENGTH_DAYS);
  while (utcDayKey(cursor) < yearStartKey) cursor = addUtcDays(cursor, SPRINT_LENGTH_DAYS);
  while (utcDayKey(addUtcDays(cursor, -SPRINT_LENGTH_DAYS)) >= yearStartKey) {
    cursor = addUtcDays(cursor, -SPRINT_LENGTH_DAYS);
  }

  const entries: SprintScheduleEntry[] = [];
  const quarterCounters: Record<string, number> = {};

  while (utcDayKey(cursor) <= utcDayKey(yearEnd)) {
    const startDate = cursor;
    const endDate = addUtcDays(startDate, SPRINT_LENGTH_DAYS - 1);
    const year = startDate.getUTCFullYear();
    const quarter = quarterOf(startDate);
    const sprintHolidays = holidaysInRange(holidays, startDate, endDate);
    const totalWorkingDays = countWorkingDays(startDate, endDate, sprintHolidays);

    const counterKey = `${year}-Q${quarter}`;
    const sprintIndexInQuarter = (quarterCounters[counterKey] ?? 0) + 1;
    quarterCounters[counterKey] = sprintIndexInQuarter;

    entries.push({
      name: `${year}-Q${quarter}-${sprintIndexInQuarter}`,
      year,
      quarter,
      sprintIndexInQuarter,
      startDate,
      endDate,
      totalWorkingDays,
      holidays: sprintHolidays,
    });

    cursor = addUtcDays(cursor, SPRINT_LENGTH_DAYS);
  }

  return entries;
}

/**
 * Generates (or regenerates) the sprint schedule for a year and upserts to DB.
 * Idempotent — matched on { organizationId, name }, safe to run repeatedly.
 */
export async function generateSprintSchedule(
  organizationId: string,
  anchorDate: Date,
  targetYear: number,
  holidays: OrgHoliday[] = []
): Promise<SprintScheduleEntry[]> {
  await connectDB();
  const entries = computeSprintSchedule(anchorDate, targetYear, holidays);

  await Promise.all(
    entries.map((entry) =>
      Sprint.updateOne(
        { organizationId, name: entry.name },
        {
          $setOnInsert: { organizationId, name: entry.name },
          $set: {
            year: entry.year,
            quarter: entry.quarter,
            sprintIndexInQuarter: entry.sprintIndexInQuarter,
            startDate: entry.startDate,
            endDate: entry.endDate,
            totalWorkingDays: entry.totalWorkingDays,
            holidays: entry.holidays,
          },
        },
        { upsert: true }
      )
    )
  );

  return entries;
}
