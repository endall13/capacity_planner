import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";
import Engineer from "@/lib/db/models/Engineer";
import Sprint from "@/lib/db/models/Sprint";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";
import ProjectSprintSnapshot from "@/lib/db/models/ProjectSprintSnapshot";
import WorkItem from "@/lib/db/models/WorkItem";

const AT_RISK_VARIANCE = 0.1;
const OFF_TRACK_VARIANCE = 0.25;

function healthStatus(plannedOrEffective: number, actual: number | undefined | null): "green" | "yellow" | "red" | null {
  if (actual == null || plannedOrEffective === 0) return null;
  const variance = Math.abs(actual - plannedOrEffective) / plannedOrEffective;
  if (variance <= AT_RISK_VARIANCE) return "green";
  if (variance <= OFF_TRACK_VARIANCE) return "yellow";
  return "red";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id: projectId } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");

  await connectDB();
  const project = await Project.findOne({ _id: projectId, organizationId: ctx.organizationId }).lean();
  if (!project) return Errors.NOT_FOUND("Project");

  const recentSprints = await Sprint.find({ organizationId: ctx.organizationId })
    .sort({ startDate: -1 })
    .limit(limit)
    .lean();
  const sprintIds = recentSprints.map((s) => s._id);
  const sprintNameById = new Map(recentSprints.map((s) => [s._id.toString(), s.name]));

  const entries = await SprintCapacityEntry.find({ projectId, sprintId: { $in: sprintIds } }).lean();
  const engineers = await Engineer.find({ assignedProjectId: projectId }).lean();
  const engineerNameById = new Map(engineers.map((e) => [e._id.toString(), e.name]));

  const byEngineer = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.engineerId.toString();
    byEngineer.set(key, [...(byEngineer.get(key) ?? []), entry]);
  }

  const engineerVelocity = [...byEngineer.entries()].map(([engineerId, engEntries]) => ({
    engineerId,
    engineerName: engineerNameById.get(engineerId) ?? "Unknown",
    sprints: engEntries.map((e) => ({
      sprintName: sprintNameById.get(e.sprintId.toString()) ?? "Unknown",
      plannedVelocity: e.plannedVelocity,
      effectiveVelocity: e.effectiveVelocity,
      actualVelocity: e.actualVelocity ?? null,
      daysOff: e.totalDaysOff,
      injectionPoints: e.injectionPoints,
      healthStatus: healthStatus(e.effectiveVelocity, e.actualVelocity),
    })),
  }));

  // Scenario B — manual out-of-scope injection, from capacity entries
  const injectionScenarioB = entries
    .filter((e) => e.injectionPoints > 0)
    .map((e) => ({
      sprintName: sprintNameById.get(e.sprintId.toString()) ?? "Unknown",
      engineerId: e.engineerId.toString(),
      engineerName: engineerNameById.get(e.engineerId.toString()) ?? "Unknown",
      injectionPoints: e.injectionPoints,
      injectionNote: e.injectionNote ?? null,
    }));

  // Scenario A — in-scope automatic injection, from sprint snapshots
  const snapshots = await ProjectSprintSnapshot.find({ projectId, sprintId: { $in: sprintIds }, status: "closed" })
    .sort({ snapshotTakenAt: 1 })
    .lean();
  const injectionScenarioA = snapshots.map((s) => ({
    sprintName: sprintNameById.get(s.sprintId.toString()) ?? "Unknown",
    injectedPoints: s.injectedPoints ?? 0,
    injectionRate: s.injectionRate ?? 0,
  }));

  let planningHealthSummary = null;
  if (project.mode === "integrated") {
    const workItems = await WorkItem.find({ projectId }).lean();
    planningHealthSummary = {
      healthy: workItems.filter((w) => w.planningHealth === "healthy").length,
      at_risk: workItems.filter((w) => w.planningHealth === "at_risk").length,
      needs_decomposition: workItems.filter((w) => w.planningHealth === "needs_decomposition").length,
      atRiskItems: workItems
        .filter((w) => w.planningHealth !== "healthy")
        .map((w) => ({ externalId: w.externalId, title: w.title, storyPoints: w.storyPoints, planningHealth: w.planningHealth })),
    };
  }

  return successResponse({
    projectId,
    engineers: engineerVelocity,
    injectionScenarioA,
    injectionScenarioB,
    planningHealthSummary,
  });
}
