import { describe, it, expect } from "vitest";
import { computeFeaturePoints, aggregateEpicTotals } from "./manual.service";

describe("computeFeaturePoints", () => {
  it("not_started when completedStoryCount is 0", () => {
    const r = computeFeaturePoints(10, 0, 5);
    expect(r).toEqual({ totalPoints: 50, completedPoints: 0, derivedStatus: "not_started" });
  });

  it("in_progress when partially complete", () => {
    const r = computeFeaturePoints(10, 4, 5);
    expect(r).toEqual({ totalPoints: 50, completedPoints: 20, derivedStatus: "in_progress" });
  });

  it("complete when completedStoryCount reaches storyCount", () => {
    const r = computeFeaturePoints(10, 10, 5);
    expect(r).toEqual({ totalPoints: 50, completedPoints: 50, derivedStatus: "complete" });
  });

  it("clamps completedPoints if completedStoryCount overshoots storyCount", () => {
    const r = computeFeaturePoints(10, 15, 5);
    expect(r.completedPoints).toBe(50);
    expect(r.derivedStatus).toBe("complete");
  });

  it("respects custom avgStoryPoints", () => {
    const r = computeFeaturePoints(4, 2, 4.9);
    expect(r.totalPoints).toBeCloseTo(19.6);
    expect(r.completedPoints).toBeCloseTo(9.8);
  });
});

describe("aggregateEpicTotals", () => {
  it("sums totalPoints and completedPoints across features", () => {
    const features = [
      { totalPoints: 50, completedPoints: 20 },
      { totalPoints: 30, completedPoints: 30 },
      { totalPoints: 10, completedPoints: 0 },
    ];
    expect(aggregateEpicTotals(features)).toEqual({ totalPoints: 90, completedPoints: 50 });
  });

  it("returns zeros for an empty epic", () => {
    expect(aggregateEpicTotals([])).toEqual({ totalPoints: 0, completedPoints: 0 });
  });
});
