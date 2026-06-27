import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connection";
import Project, { type IProjectForecast } from "@/lib/db/models/Project";
import Sprint from "@/lib/db/models/Sprint";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";
import Engineer from "@/lib/db/models/Engineer";
import Epic from "@/lib/db/models/Epic";
import Feature from "@/lib/db/models/Feature";
import WorkItem from "@/lib/db/models/WorkItem";
import { calculateTeamVelocity } from "@/lib/services/capacity.service";

export type RagStatus = "on_track" | "at_risk" | "off_track" | "complete";

// Velocity-health style drift bands, reused for RAG (see CLAUDE.md / requirements.md
// Q5: 10% / 25% variance thresholds, hardcoded in Phase 1).
const AT_RISK_DRIFT_RATIO = 0.1;
const OFF_TRACK_DRIFT_RATIO = 0.25;

export interface SprintVelocityPoint {
  sprintId: string;
  sprintName: string;
  endDate: Date;
  teamVelocity: number;
}

export interface BurnProjection {
  remainingPoints: number;
  projectedSprintsRemaining: number;
  projectedCompleteSprintName: string | null;
  projectedCompleteDate: Date | null;
  currentTeamVelocity: number;
}

/**
 * Manual mode remaining points: Σ (storyCount - completedStoryCount) × avgStoryPoints
 * for all non-complete features.
 */
export function computeRemainingPointsManual(
  features: { storyCount?: number; completedStoryCount?: number; derivedStatus?: string }[],
  avgStoryPoints: number
): number {
  return features
    .filter((f) => f.derivedStatus !== "complete")
    .reduce((sum, f) => sum + ((f.storyCount ?? 0) - (f.completedStoryCount ?? 0)) * avgStoryPoints, 0);
}

/** Integrated mode remaining points: Σ storyPoints where isComplete === false. */
export function computeRemainingPointsIntegrated(workItems: { storyPoints?: number; isComplete: boolean }[]): number {
  return workItems
    .filter((w) => !w.isComplete)
    .reduce((sum, w) => sum + (w.storyPoints ?? 0), 0);
}

/**
 * Burns remainingPoints sprint-by-sprint against the given velocity series
 * (ordered earliest-first, starting at the current sprint) until it reaches
 * zero. Falls back to `fallbackVelocity` for sprints with no capacity data
 * (e.g. far-future sprints with no entries yet) — CLAUDE.md risk mitigation.
 */
export function projectBurn(remainingPoints: number, sprints: SprintVelocityPoint[], fallbackVelocity: number): BurnProjection {
  const currentTeamVelocity = sprints[0] && sprints[0].teamVelocity > 0 ? sprints[0].teamVelocity : fallbackVelocity;

  if (remainingPoints <= 0) {
    return {
      remainingPoints: 0,
      projectedSprintsRemaining: 0,
      projectedCompleteSprintName: sprints[0]?.sprintName ?? null,
      projectedCompleteDate: sprints[0]?.endDate ?? null,
      currentTeamVelocity,
    };
  }

  let remaining = remainingPoints;
  let sprintsElapsed = 0;
  let lastSprint = sprints[sprints.length - 1] ?? null;

  for (const sprint of sprints) {
    sprintsElapsed++;
    const velocity = sprint.teamVelocity > 0 ? sprint.teamVelocity : fallbackVelocity;
    remaining -= velocity;
    lastSprint = sprint;
    if (remaining <= 0) {
      return {
        remainingPoints: remainingPoints,
        projectedSprintsRemaining: sprintsElapsed,
        projectedCompleteSprintName: sprint.sprintName,
        projectedCompleteDate: sprint.endDate,
        currentTeamVelocity,
      };
    }
  }

  // Ran out of known sprints — keep projecting forward using the fallback velocity.
  const velocity = fallbackVelocity > 0 ? fallbackVelocity : 1;
  const extraSprintsNeeded = Math.ceil(remaining / velocity);
  sprintsElapsed += extraSprintsNeeded;

  const lastEndDate = lastSprint?.endDate ?? new Date();
  const projectedCompleteDate = new Date(lastEndDate.getTime() + extraSprintsNeeded * 14 * 86_400_000);

  return {
    remainingPoints: remainingPoints,
    projectedSprintsRemaining: sprintsElapsed,
    projectedCompleteSprintName: null,
    projectedCompleteDate,
    currentTeamVelocity,
  };
}

/**
 * RAG status from drift between current and baseline projected sprint counts.
 * Baseline is the sprints-remaining count captured at the first forecast calc.
 */
export function computeRagStatus(
  projectedSprintsRemaining: number,
  baselineSprintsRemaining: number | null
): RagStatus {
  if (projectedSprintsRemaining <= 0) return "complete";
  if (baselineSprintsRemaining === null || baselineSprintsRemaining <= 0) return "on_track";

  const driftRatio = (projectedSprintsRemaining - baselineSprintsRemaining) / baselineSprintsRemaining;
  if (driftRatio <= AT_RISK_DRIFT_RATIO) return "on_track";
  if (driftRatio <= OFF_TRACK_DRIFT_RATIO) return "at_risk";
  return "off_track";
}

/**
 * Full forecast recompute for a project — loads capacity entries, scope
 * (manual or integrated), runs the burn projection, and writes the result
 * to projects.forecast + projects.status. Call after any of the triggers
 * listed in docs/data-model.md Section 6.
 */
export async function recomputeForecast(projectId: string): Promise<IProjectForecast> {
  await connectDB();

  const project = await Project.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const engineers = await Engineer.find({ assignedProjectId: projectId, isActive: true }).lean();
  const fallbackVelocity = engineers.reduce((sum, e) => sum + e.baseVelocity, 0);

  const totalPoints = await getTotalPoints(project);
  const completedPoints = await getCompletedPoints(project);
  const remainingPoints =
    project.mode === "integrated"
      ? await getRemainingPointsIntegrated(project)
      : await getRemainingPointsManual(project);

  const sprints = await Sprint.find({ organizationId: project.organizationId })
    .sort({ startDate: 1 })
    .where({ endDate: { $gte: new Date() } })
    .lean();

  const sprintVelocities: SprintVelocityPoint[] = await Promise.all(
    sprints.map(async (sprint) => {
      const entries = await SprintCapacityEntry.find({ projectId, sprintId: sprint._id }).lean();
      return {
        sprintId: sprint._id.toString(),
        sprintName: sprint.name,
        endDate: sprint.endDate,
        teamVelocity: calculateTeamVelocity(entries),
      };
    })
  );

  const burn = projectBurn(remainingPoints, sprintVelocities, fallbackVelocity);

  const baselineSprintsRemaining = project.forecast?.baselineCompleteDate
    ? project.forecast.projectedSprintsRemaining
    : null;

  const status = computeRagStatus(burn.projectedSprintsRemaining, baselineSprintsRemaining);

  const forecast: IProjectForecast = {
    totalPoints,
    completedPoints,
    remainingPoints,
    currentTeamVelocity: burn.currentTeamVelocity,
    projectedSprintsRemaining: burn.projectedSprintsRemaining,
    projectedCompleteSprintName: burn.projectedCompleteSprintName ?? "",
    projectedCompleteDate: burn.projectedCompleteDate ?? new Date(),
    lastCalculatedAt: new Date(),
    baselineCompleteDate: project.forecast?.baselineCompleteDate ?? burn.projectedCompleteDate ?? new Date(),
  };

  project.forecast = forecast;
  project.status = status;
  await project.save();

  return forecast;
}

async function getTotalPoints(project: { _id: Types.ObjectId; mode?: string; avgStoryPoints?: number }): Promise<number> {
  if (project.mode === "integrated") {
    const epics = await Epic.find({ projectId: project._id }).lean();
    return epics.reduce((sum, e) => sum + e.totalPoints, 0);
  }
  const features = await Feature.find({ projectId: project._id }).lean();
  const avgStoryPoints = project.avgStoryPoints ?? 5;
  return features.reduce((sum, f) => sum + (f.storyCount ?? 0) * avgStoryPoints, 0);
}

async function getCompletedPoints(project: { _id: Types.ObjectId; mode?: string; avgStoryPoints?: number }): Promise<number> {
  if (project.mode === "integrated") {
    const epics = await Epic.find({ projectId: project._id }).lean();
    return epics.reduce((sum, e) => sum + e.completedPoints, 0);
  }
  const features = await Feature.find({ projectId: project._id }).lean();
  const avgStoryPoints = project.avgStoryPoints ?? 5;
  return features.reduce((sum, f) => sum + (f.completedStoryCount ?? 0) * avgStoryPoints, 0);
}

async function getRemainingPointsManual(project: { _id: Types.ObjectId; avgStoryPoints?: number }): Promise<number> {
  const features = await Feature.find({ projectId: project._id }).lean();
  return computeRemainingPointsManual(features, project.avgStoryPoints ?? 5);
}

async function getRemainingPointsIntegrated(project: { _id: Types.ObjectId }): Promise<number> {
  const workItems = await WorkItem.find({ projectId: project._id }).lean();
  return computeRemainingPointsIntegrated(workItems);
}
