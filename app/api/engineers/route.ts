import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Engineer from "@/lib/db/models/Engineer";

const CreateEngineerSchema = z.object({
  name: z.string().min(1),
  baseVelocity: z.number().nonnegative(),
  assignedProjectId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const assignedTo = req.nextUrl.searchParams.get("assignedTo");

  const filter: Record<string, unknown> = { organizationId: ctx.organizationId, isActive: true };
  if (assignedTo) filter.assignedProjectId = assignedTo;

  const engineers = await Engineer.find(filter).lean();
  return successResponse(engineers);
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateEngineerSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const engineer = await Engineer.create({
    organizationId: ctx.organizationId,
    name: parsed.data.name,
    baseVelocity: parsed.data.baseVelocity,
    assignedProjectId: parsed.data.assignedProjectId ?? null,
    isActive: true,
  });

  return successResponse(engineer, undefined, 201);
}
