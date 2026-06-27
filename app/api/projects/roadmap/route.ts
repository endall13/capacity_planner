import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";
import Engineer from "@/lib/db/models/Engineer";

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const projects = await Project.find({ organizationId: ctx.organizationId, isActive: true }).lean();
  const engineers = await Engineer.find({ organizationId: ctx.organizationId, isActive: true }).lean();

  const engineerCountByProject = new Map<string, number>();
  for (const e of engineers) {
    if (!e.assignedProjectId) continue;
    const key = e.assignedProjectId.toString();
    engineerCountByProject.set(key, (engineerCountByProject.get(key) ?? 0) + 1);
  }

  const active = projects
    .filter((p) => p.type === "project" && p.lifecycleStatus === "active")
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      status: p.status,
      engineerCount: engineerCountByProject.get(p._id.toString()) ?? 0,
      projectedCompleteDate: p.forecast?.projectedCompleteDate ?? null,
      baselineCompleteDate: p.forecast?.baselineCompleteDate ?? null,
    }));

  const planned = projects
    .filter((p) => p.type === "project" && p.lifecycleStatus === "planned")
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      proposedStartDate: p.proposedStartDate ?? null,
      proposedEndDate: p.proposedEndDate ?? null,
    }));

  const sustaining = projects
    .filter((p) => p.type === "sustaining")
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      engineerCount: engineerCountByProject.get(p._id.toString()) ?? 0,
    }));

  return successResponse({ active, planned, sustaining });
}
