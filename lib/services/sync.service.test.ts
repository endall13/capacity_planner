import { describe, it, expect } from "vitest";
import { derivePlanningHealth, computeInjection } from "./sync.service";

describe("derivePlanningHealth", () => {
  it("needs_decomposition for >= 13", () => {
    expect(derivePlanningHealth(13)).toBe("needs_decomposition");
    expect(derivePlanningHealth(20)).toBe("needs_decomposition");
  });

  it("at_risk for exactly 8", () => {
    expect(derivePlanningHealth(8)).toBe("at_risk");
  });

  it("healthy for <= 5", () => {
    expect(derivePlanningHealth(5)).toBe("healthy");
    expect(derivePlanningHealth(1)).toBe("healthy");
  });

  it("healthy for unestimated (null/undefined)", () => {
    expect(derivePlanningHealth(null)).toBe("healthy");
    expect(derivePlanningHealth(undefined)).toBe("healthy");
  });

  it("healthy for values between 5 and 8 or 8 and 13 (e.g. 6, 10)", () => {
    expect(derivePlanningHealth(6)).toBe("healthy");
    expect(derivePlanningHealth(10)).toBe("healthy");
  });
});

describe("computeInjection", () => {
  it("zero injection when plan held exactly", () => {
    const r = computeInjection({ remainingPointsAtStart: 100, completedPointsThisSprint: 20, remainingPointsAtEnd: 80 });
    expect(r.injectedPoints).toBe(0);
    expect(r.injectionRate).toBe(0);
  });

  it("positive injection when scope grew mid-sprint", () => {
    const r = computeInjection({ remainingPointsAtStart: 100, completedPointsThisSprint: 20, remainingPointsAtEnd: 90 });
    expect(r.injectedPoints).toBe(10);
    expect(r.injectionRate).toBeCloseTo(0.1);
  });

  it("negative injection when scope was removed", () => {
    const r = computeInjection({ remainingPointsAtStart: 100, completedPointsThisSprint: 20, remainingPointsAtEnd: 70 });
    expect(r.injectedPoints).toBe(-10);
    expect(r.injectionRate).toBeCloseTo(-0.1);
  });

  it("zero injectionRate when remainingPointsAtStart is zero", () => {
    const r = computeInjection({ remainingPointsAtStart: 0, completedPointsThisSprint: 0, remainingPointsAtEnd: 5 });
    expect(r.injectionRate).toBe(0);
    expect(r.injectedPoints).toBe(5);
  });
});
