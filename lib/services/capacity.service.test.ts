import { describe, it, expect } from "vitest";
import { calculateCapacity, calculateTeamVelocity } from "./capacity.service";

// 2-week sprint, Mon 2026-01-05 through Fri 2026-01-16 = 10 working days, no holidays.
const sprint = {
  startDate: new Date("2026-01-05"),
  endDate: new Date("2026-01-16"),
  totalWorkingDays: 10,
  holidays: [],
};

describe("calculateCapacity", () => {
  it("full sprint, no absences", () => {
    const r = calculateCapacity({ baseVelocity: 20, sprint });
    expect(r.availableDays).toBe(10);
    expect(r.dailyRate).toBe(2);
    expect(r.plannedVelocity).toBe(20);
    expect(r.effectiveVelocity).toBe(20);
  });

  it("mid-sprint join (Wed 2026-01-07) misses Mon+Tue = 2 days", () => {
    const r = calculateCapacity({
      baseVelocity: 20,
      sprint,
      sprintJoinDate: new Date("2026-01-07"),
    });
    expect(r.missedDaysJoiningLate).toBe(2);
    expect(r.availableDays).toBe(8);
    expect(r.plannedVelocity).toBe(16);
  });

  it("mid-sprint leave (Thu 2026-01-15) misses Fri 2026-01-16 = 1 day", () => {
    const r = calculateCapacity({
      baseVelocity: 20,
      sprint,
      sprintLeaveDate: new Date("2026-01-15"),
    });
    expect(r.missedDaysLeavingEarly).toBe(1);
    expect(r.availableDays).toBe(9);
    expect(r.plannedVelocity).toBe(18);
  });

  it("PTO days reduce available days", () => {
    const r = calculateCapacity({ baseVelocity: 20, sprint, ptoDays: 3 });
    expect(r.totalDaysOff).toBe(3);
    expect(r.availableDays).toBe(7);
    expect(r.plannedVelocity).toBe(14);
  });

  it("sick days reduce available days same as PTO", () => {
    const r = calculateCapacity({ baseVelocity: 20, sprint, sickDays: 2 });
    expect(r.totalDaysOff).toBe(2);
    expect(r.availableDays).toBe(8);
    expect(r.plannedVelocity).toBe(16);
  });

  it("injection points subtract from plannedVelocity to get effectiveVelocity", () => {
    const r = calculateCapacity({ baseVelocity: 20, sprint, injectionPoints: 5 });
    expect(r.plannedVelocity).toBe(20);
    expect(r.effectiveVelocity).toBe(15);
  });

  it("combined: join late + PTO + sick + injection", () => {
    const r = calculateCapacity({
      baseVelocity: 20,
      sprint,
      sprintJoinDate: new Date("2026-01-07"), // -2 days
      ptoDays: 1,
      sickDays: 1,
      injectionPoints: 2,
    });
    // 10 - (1+1) - 2 - 0 = 6 available days
    expect(r.totalDaysOff).toBe(2);
    expect(r.missedDaysJoiningLate).toBe(2);
    expect(r.availableDays).toBe(6);
    expect(r.plannedVelocity).toBe(12);
    expect(r.effectiveVelocity).toBe(10);
  });

  it("clamps availableDays to zero when absences exceed total working days", () => {
    const r = calculateCapacity({ baseVelocity: 20, sprint, ptoDays: 20 });
    expect(r.availableDays).toBe(0);
    expect(r.plannedVelocity).toBe(0);
    expect(r.effectiveVelocity).toBe(0);
  });

  it("holiday within sprint excludes that day from missedDaysJoiningLate", () => {
    const sprintWithHoliday = {
      ...sprint,
      holidays: [{ date: new Date("2026-01-06") }], // Tue holiday
    };
    const r = calculateCapacity({
      baseVelocity: 20,
      sprint: sprintWithHoliday,
      sprintJoinDate: new Date("2026-01-07"), // misses Mon only (Tue is holiday, not a working day)
    });
    expect(r.missedDaysJoiningLate).toBe(1);
  });
});

describe("calculateTeamVelocity", () => {
  it("sums effectiveVelocity across engineers", () => {
    const total = calculateTeamVelocity([
      { effectiveVelocity: 10 },
      { effectiveVelocity: 7.5 },
      { effectiveVelocity: 0 },
    ]);
    expect(total).toBe(17.5);
  });
});
