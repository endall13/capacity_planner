import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import { connectDB } from "@/lib/db/connection";
import Feature from "@/lib/db/models/Feature";
import { updateFeature, deleteFeature } from "@/lib/services/manual.service";

const UpdateFeatureSchema = z.object({
  title: z.string().min(1).optional(),
  storyCount: z.number().nonnegative().optional(),
  completedStoryCount: z.number().nonnegative().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateFeatureSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const owned = await Feature.exists({ _id: id, organizationId: ctx.organizationId });
  if (!owned) return Errors.NOT_FOUND("Feature");

  const feature = await updateFeature(id, parsed.data);
  return successResponse(feature);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  await connectDB();
  const owned = await Feature.exists({ _id: id, organizationId: ctx.organizationId });
  if (!owned) return Errors.NOT_FOUND("Feature");

  await deleteFeature(id);
  return new NextResponse(null, { status: 204 });
}
