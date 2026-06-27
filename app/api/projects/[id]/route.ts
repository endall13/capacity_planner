import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";
import { recomputeForecast } from "@/lib/services/forecast.service";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  lifecycleStatus: z.enum(["planned", "active", "completed"]).optional(),
  proposedStartDate: z.coerce.date().optional(),
  proposedEndDate: z.coerce.date().optional(),
  avgStoryPoints: z.number().positive().optional(),
  scopedEpicIds: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const project = await Project.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  if (!project) return Errors.NOT_FOUND("Project");

  return successResponse(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const project = await Project.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: parsed.data },
    { new: true }
  );
  if (!project) return Errors.NOT_FOUND("Project");

  if (project.type === "project") await recomputeForecast(project._id.toString());

  return successResponse(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  await connectDB();
  const project = await Project.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!project) return Errors.NOT_FOUND("Project");

  return successResponse(project);
}
