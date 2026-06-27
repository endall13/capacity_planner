import { connectDB } from "@/lib/db/connection";
import Sprint from "@/lib/db/models/Sprint";
import Project from "@/lib/db/models/Project";
import Epic from "@/lib/db/models/Epic";
import WorkItem, { type PlanningHealth } from "@/lib/db/models/WorkItem";
import ProjectSprintSnapshot from "@/lib/db/models/ProjectSprintSnapshot";
import { recomputeForecast } from "@/lib/services/forecast.service";

/**
 * Planning health from story points (integrated mode, advisory only).
 * See CLAUDE.md "Planning Health Rules".
 */
export function derivePlanningHealth(storyPoints: number | undefined | null): PlanningHealth {
  if (storyPoints == null) return "healthy";
  if (storyPoints >= 13) return "needs_decomposition";
  if (storyPoints === 8) return "at_risk";
  return "healthy";
}

export interface InjectionInput {
  remainingPointsAtStart: number;
  completedPointsThisSprint: number;
  remainingPointsAtEnd: number;
}

export interface InjectionResult {
  injectedPoints: number;
  injectionRate: number;
}

/**
 * Scenario A — in-scope (automatic) injection.
 * injectedPoints = remainingAtEnd - (remainingAtStart - completedThisSprint)
 * Positive = scope added during the sprint. Zero = plan held. Negative = scope removed.
 */
export function computeInjection(input: InjectionInput): InjectionResult {
  const { remainingPointsAtStart, completedPointsThisSprint, remainingPointsAtEnd } = input;
  const injectedPoints = remainingPointsAtEnd - (remainingPointsAtStart - completedPointsThisSprint);
  const injectionRate = remainingPointsAtStart > 0 ? injectedPoints / remainingPointsAtStart : 0;
  return { injectedPoints, injectionRate };
}

async function getProjectScopeCounts(projectId: string): Promise<{ remainingPoints: number; totalPoints: number; workItemCount: number }> {
  const epics = await Epic.find({ projectId }).lean();
  const totalPoints = epics.reduce((sum, e) => sum + e.totalPoints, 0);
  const completedPoints = epics.reduce((sum, e) => sum + e.completedPoints, 0);
  const workItems = await WorkItem.find({ projectId }).lean();
  const workItemCount = workItems.filter((w) => !w.isComplete).length;
  return { remainingPoints: totalPoints - completedPoints, totalPoints, workItemCount };
}

/**
 * Opens a sprint snapshot for an integrated project — captures current scope
 * as the sprint-start baseline. Idempotent: no-op if a snapshot already exists.
 */
export async function openSprintSnapshot(projectId: string, sprintId: string): Promise<void> {
  await connectDB();
  const existing = await ProjectSprintSnapshot.findOne({ projectId, sprintId });
  if (existing) return;

  const project = await Project.findById(projectId).lean();
  if (!project) throw new Error(`Project ${projectId} not found`);
  const { remainingPoints, totalPoints, workItemCount } = await getProjectScopeCounts(projectId);

  await ProjectSprintSnapshot.create({
    organizationId: project.organizationId,
    projectId,
    sprintId,
    remainingPointsAtStart: remainingPoints,
    totalPointsAtStart: totalPoints,
    workItemCountAtStart: workItemCount,
    status: "open",
    snapshotTakenAt: new Date(),
  });
}

/**
 * Closes an open sprint snapshot — captures end-of-sprint scope and computes
 * Scenario A injection. Idempotent: no-op if already closed or never opened.
 */
export async function closeSprintSnapshot(projectId: string, sprintId: string): Promise<void> {
  await connectDB();
  const snapshot = await ProjectSprintSnapshot.findOne({ projectId, sprintId, status: "open" });
  if (!snapshot) return;

  const { remainingPoints, totalPoints, workItemCount } = await getProjectScopeCounts(projectId);
  const completedAtStart = snapshot.totalPointsAtStart - snapshot.remainingPointsAtStart;
  const completedAtEnd = totalPoints - remainingPoints;
  const completedPointsThisSprint = Math.max(0, completedAtEnd - completedAtStart);

  const { injectedPoints, injectionRate } = computeInjection({
    remainingPointsAtStart: snapshot.remainingPointsAtStart,
    completedPointsThisSprint,
    remainingPointsAtEnd: remainingPoints,
  });

  snapshot.completedPointsThisSprint = completedPointsThisSprint;
  snapshot.remainingPointsAtEnd = remainingPoints;
  snapshot.totalPointsAtEnd = totalPoints;
  snapshot.workItemCountAtEnd = workItemCount;
  snapshot.injectedPoints = injectedPoints;
  snapshot.injectedWorkItemCount = workItemCount - snapshot.workItemCountAtStart;
  snapshot.injectionRate = injectionRate;
  snapshot.status = "closed";
  snapshot.closedAt = new Date();
  await snapshot.save();

  await recomputeForecast(projectId);
}

/**
 * Runs sprint boundary detection for one project: opens a snapshot if the
 * current sprint has started and none exists yet; closes the previous
 * sprint's snapshot if it has ended and is still open.
 */
export async function checkSprintBoundary(projectId: string, organizationId: string): Promise<void> {
  await connectDB();
  const now = new Date();

  const currentSprint = await Sprint.findOne({ organizationId, startDate: { $lte: now }, endDate: { $gte: now } }).lean();
  const endedSprints = await Sprint.find({ organizationId, endDate: { $lt: now } }).sort({ endDate: -1 }).limit(1).lean();

  if (endedSprints[0]) {
    await closeSprintSnapshot(projectId, endedSprints[0]._id.toString());
  }
  if (currentSprint) {
    await openSprintSnapshot(projectId, currentSprint._id.toString());
  }
}
