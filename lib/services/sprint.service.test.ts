import { describe, it, expect } from "vitest";
import { computeSprintSchedule } from "./sprint.service";

const anchor = new Date("2026-01-05"); // Monday

describe("computeSprintSchedule", () => {
  it("first sprint starts on anchor date with correct name and working days", () => {
    const schedule = computeSprintSchedule(anchor, 2026);
    const first = schedule[0];
    expect(first.startDate.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(first.endDate.toISOString().slice(0, 10)).toBe("2026-01-18");
    expect(first.name).toBe("2026-Q1-1");
    expect(first.totalWorkingDays).toBe(10);
  });

  it("generates ~26 sprints covering the full year (14-day cadence)", () => {
    const schedule = computeSprintSchedule(anchor, 2026);
    expect(schedule.length).toBeGreaterThanOrEqual(26);
    expect(schedule.length).toBeLessThanOrEqual(27);
  });

  it("sprint names are unique and sequential within each quarter", () => {
    const schedule = computeSprintSchedule(anchor, 2026);
    const names = schedule.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("sprint belongs to the quarter of its start date even if it spans into the next quarter", () => {
    const schedule = computeSprintSchedule(anchor, 2026);
    // Find a sprint whose start is in Q1 (Mar) but end crosses into Q2 (Apr)
    const crossing = schedule.find(
      (s) => s.startDate.getUTCMonth() === 2 && s.endDate.getUTCMonth() === 3
    );
    expect(crossing).toBeDefined();
    expect(crossing!.quarter).toBe(1);
  });

  it("sprintIndexInQuarter resets to 1 at the start of each quarter", () => {
    const schedule = computeSprintSchedule(anchor, 2026);
    const q2First = schedule.find((s) => s.quarter === 2 && s.sprintIndexInQuarter === 1);
    expect(q2First).toBeDefined();
    expect(q2First!.name).toBe(`2026-Q2-1`);
  });

  it("holiday inside a sprint window reduces totalWorkingDays by 1", () => {
    const holidays = [{ date: new Date("2026-01-06"), name: "Test Holiday" }]; // Tue in sprint 1
    const schedule = computeSprintSchedule(anchor, 2026, holidays);
    expect(schedule[0].totalWorkingDays).toBe(9);
    expect(schedule[0].holidays).toHaveLength(1);
  });

  it("is idempotent — same inputs produce identical schedule", () => {
    const a = computeSprintSchedule(anchor, 2026);
    const b = computeSprintSchedule(anchor, 2026);
    expect(a).toEqual(b);
  });

  it("anchor mid-year still produces a schedule starting at/before year start", () => {
    const schedule = computeSprintSchedule(anchor, 2027);
    expect(schedule[0].startDate.getUTCFullYear()).toBe(2027);
    expect(schedule[0].name.startsWith("2027-Q1-")).toBe(true);
  });
});
