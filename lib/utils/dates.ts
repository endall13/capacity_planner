export interface HolidayLike {
  date: Date;
}

// All comparisons done in UTC. Inputs are expected as date-only values
// (e.g. parsed from "YYYY-MM-DD", which Date parses as UTC midnight).
// Mixing UTC-parsed dates with local-time date math (date-fns addDays/isWeekend)
// shifts the day in negative-UTC timezones — so we do day math in UTC ourselves.

function utcDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(utcDayKey(date) + days * 86_400_000);
}

function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date, holidays: HolidayLike[]): boolean {
  const key = utcDayKey(date);
  return holidays.some((h) => utcDayKey(h.date) === key);
}

function isWorkingDay(date: Date, holidays: HolidayLike[]): boolean {
  return !isWeekendUtc(date) && !isHoliday(date, holidays);
}

/** Counts working days in [start, end], inclusive on both ends. */
export function countWorkingDays(start: Date, end: Date, holidays: HolidayLike[] = []): number {
  const startKey = utcDayKey(start);
  const endKey = utcDayKey(end);
  if (startKey > endKey) return 0;
  let count = 0;
  for (let key = startKey; key <= endKey; key += 86_400_000) {
    if (isWorkingDay(new Date(key), holidays)) count++;
  }
  return count;
}

/**
 * Working days missed by joining late: from sprintStart up to (not including) joinDate.
 */
export function workingDaysBefore(joinDate: Date, sprintStart: Date, holidays: HolidayLike[] = []): number {
  const joinKey = utcDayKey(joinDate);
  const startKey = utcDayKey(sprintStart);
  if (joinKey <= startKey) return 0;
  const dayBeforeJoin = addUtcDays(joinDate, -1);
  return countWorkingDays(sprintStart, dayBeforeJoin, holidays);
}

/**
 * Working days missed by leaving early: from (after) leaveDate through sprintEnd.
 */
export function workingDaysAfter(leaveDate: Date, sprintEnd: Date, holidays: HolidayLike[] = []): number {
  const leaveKey = utcDayKey(leaveDate);
  const endKey = utcDayKey(sprintEnd);
  if (leaveKey >= endKey) return 0;
  const dayAfterLeave = addUtcDays(leaveDate, 1);
  return countWorkingDays(dayAfterLeave, sprintEnd, holidays);
}
