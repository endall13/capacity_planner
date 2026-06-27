import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import User from "@/lib/db/models/User";

const UpdateUserSchema = z.object({
  role: z.enum(["admin", "engineering_manager", "product_manager", "director", "vp"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const user = await User.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: parsed.data },
    { new: true }
  ).select("-passwordHash");
  if (!user) return Errors.NOT_FOUND("User");

  return successResponse(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  await connectDB();
  const user = await User.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: { isActive: false } },
    { new: true }
  ).select("-passwordHash");
  if (!user) return Errors.NOT_FOUND("User");

  return successResponse(user);
}
