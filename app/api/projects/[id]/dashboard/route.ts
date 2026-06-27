import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse, Errors } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";
import Epic from "@/lib/db/models/Epic";
import Feature from "@/lib/db/models/Feature";
import ProjectSprintSnapshot from "@/lib/db/models/ProjectSprintSnapshot";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const project = await Project.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  if (!project) return Errors.NOT_FOUND("Project");

  const epics = await Epic.find({ projectId: id }).lean();
  const features = await Feature.find({ projectId: id }).lean();
  const snapshots = await ProjectSprintSnapshot.find({ projectId: id }).sort({ snapshotTakenAt: 1 }).lean();

  return successResponse({
    project,
    forecast: project.forecast ?? null,
    epics,
    features,
    sprintHistory: snapshots,
  });
}
