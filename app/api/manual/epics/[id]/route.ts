import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import { connectDB } from "@/lib/db/connection";
import Epic from "@/lib/db/models/Epic";
import { updateEpic } from "@/lib/services/manual.service";

const UpdateEpicSchema = z.object({
  title: z.string().min(1).optional(),
  state: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateEpicSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const owned = await Epic.exists({ _id: id, organizationId: ctx.organizationId });
  if (!owned) return Errors.NOT_FOUND("Epic");

  const epic = await updateEpic(id, parsed.data);
  return successResponse(epic);
}
