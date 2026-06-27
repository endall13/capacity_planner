import { describe, it, expect } from "vitest";
import {
  computeRemainingPointsManual,
  computeRemainingPointsIntegrated,
  projectBurn,
  computeRagStatus,
  type SprintVelocityPoint,
} from "./forecast.service";

describe("computeRemainingPointsManual", () => {
  it("sums (storyCount - completedStoryCount) * avgStoryPoints, skipping complete features", () => {
    const features = [
      { storyCount: 10, completedStoryCount: 4, derivedStatus: "in_progress" },
      { storyCount: 5, completedStoryCount: 5, derivedStatus: "complete" },
      { storyCount: 8, completedStoryCount: 0, derivedStatus: "not_started" },
    ];
    expect(computeRemainingPointsManual(features, 5)).toBe((6 + 8) * 5);
  });
});

describe("computeRemainingPointsIntegrated", () => {
  it("sums storyPoints for incomplete work items only", () => {
    const items = [
      { storyPoints: 5, isComplete: false },
      { storyPoints: 8, isComplete: true },
      { storyPoints: 3, isComplete: false },
      { isComplete: false }, // unestimated
    ];
    expect(computeRemainingPointsIntegrated(items)).toBe(8);
  });
});

function sprint(name: string, endDate: string, teamVelocity: number): SprintVelocityPoint {
  return { sprintId: name, sprintName: name, endDate: new Date(endDate), teamVelocity };
}

describe("projectBurn", () => {
  it("burns to zero within known sprints", () => {
    const sprints = [
      sprint("2026-Q1-1", "2026-01-18", 10),
      sprint("2026-Q1-2", "2026-02-01", 10),
      sprint("2026-Q1-3", "2026-02-15", 10),
    ];
    const result = projectBurn(25, sprints, 10);
    expect(result.projectedSprintsRemaining).toBe(3);
    expect(result.projectedCompleteSprintName).toBe("2026-Q1-3");
    expect(result.projectedCompleteDate).toEqual(new Date("2026-02-15"));
  });

  it("already complete (remainingPoints <= 0)", () => {
    const sprints = [sprint("2026-Q1-1", "2026-01-18", 10)];
    const result = projectBurn(0, sprints, 10);
    expect(result.projectedSprintsRemaining).toBe(0);
  });

  it("falls back to fallbackVelocity for sprints with no capacity data (velocity 0)", () => {
    const sprints = [sprint("2026-Q1-1", "2026-01-18", 0), sprint("2026-Q1-2", "2026-02-01", 0)];
    const result = projectBurn(20, sprints, 10);
    expect(result.projectedSprintsRemaining).toBe(2);
  });

  it("projects beyond known sprints using fallback velocity", () => {
    const sprints = [sprint("2026-Q1-1", "2026-01-18", 10)];
    const result = projectBurn(35, sprints, 10);
    // sprint 1 burns 10 (remaining 25), then 3 more fallback sprints needed (ceil(25/10)=3)
    expect(result.projectedSprintsRemaining).toBe(4);
    expect(result.projectedCompleteSprintName).toBeNull();
    expect(result.projectedCompleteDate).not.toBeNull();
  });

  it("currentTeamVelocity reflects the first sprint in the series", () => {
    const sprints = [sprint("2026-Q1-1", "2026-01-18", 12)];
    const result = projectBurn(50, sprints, 5);
    expect(result.currentTeamVelocity).toBe(12);
  });

  it("currentTeamVelocity falls back when the first sprint has zero velocity (no capacity entries yet)", () => {
    const sprints = [sprint("2026-Q1-1", "2026-01-18", 0)];
    const result = projectBurn(50, sprints, 8);
    expect(result.currentTeamVelocity).toBe(8);
  });
});

describe("computeRagStatus", () => {
  it("on_track when no baseline yet", () => {
    expect(computeRagStatus(5, null)).toBe("on_track");
  });

  it("complete when projectedSprintsRemaining is 0", () => {
    expect(computeRagStatus(0, 5)).toBe("complete");
  });

  it("on_track within 10% drift", () => {
    expect(computeRagStatus(11, 10)).toBe("on_track"); // 10% exactly
  });

  it("at_risk between 10% and 25% drift", () => {
    expect(computeRagStatus(12, 10)).toBe("at_risk"); // 20% drift
  });

  it("off_track beyond 25% drift", () => {
    expect(computeRagStatus(14, 10)).toBe("off_track"); // 40% drift
  });
});
