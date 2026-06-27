import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Engineer from "@/lib/db/models/Engineer";
import Sprint from "@/lib/db/models/Sprint";
import { recomputeForecast } from "@/lib/services/forecast.service";

const UpdateEngineerSchema = z.object({
  name: z.string().min(1).optional(),
  baseVelocity: z.number().nonnegative().optional(),
  assignedProjectId: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateEngineerSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const engineer = await Engineer.findOne({ _id: id, organizationId: ctx.organizationId });
  if (!engineer) return Errors.NOT_FOUND("Engineer");

  const previousProjectId = engineer.assignedProjectId?.toString() ?? null;

  // Velocity history is append-only: push the old value before overwriting.
  if (parsed.data.baseVelocity !== undefined && parsed.data.baseVelocity !== engineer.baseVelocity) {
    const currentSprint = await Sprint.findOne({ organizationId: ctx.organizationId, isCurrent: true }).lean();
    if (currentSprint) {
      engineer.velocityHistory.push({
        baseVelocity: engineer.baseVelocity,
        effectiveFromSprintId: currentSprint._id,
        setAt: new Date(),
        setByUserId: new Types.ObjectId(ctx.userId),
      });
    }
    engineer.baseVelocity = parsed.data.baseVelocity;
  }

  if (parsed.data.name !== undefined) engineer.name = parsed.data.name;

  if (parsed.data.assignedProjectId !== undefined) {
    if (previousProjectId && parsed.data.assignedProjectId !== previousProjectId) {
      engineer.projectHistory.push({ projectId: engineer.assignedProjectId!, assignedAt: new Date(), releasedAt: new Date() });
    }
    engineer.assignedProjectId = parsed.data.assignedProjectId ? new Types.ObjectId(parsed.data.assignedProjectId) : null;
  }

  await engineer.save();

  const affectedProjectIds = new Set([previousProjectId, engineer.assignedProjectId?.toString() ?? null].filter(Boolean) as string[]);
  await Promise.all([...affectedProjectIds].map((projectId) => recomputeForecast(projectId).catch(() => null)));

  return successResponse(engineer);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  await connectDB();
  const engineer = await Engineer.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!engineer) return Errors.NOT_FOUND("Engineer");

  return successResponse(engineer);
}
