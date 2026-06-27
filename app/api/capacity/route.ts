import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const sprintId = req.nextUrl.searchParams.get("sprintId");
  if (!projectId || !sprintId) return Errors.BAD_REQUEST("projectId and sprintId are required");

  await connectDB();
  const entries = await SprintCapacityEntry.find({
    organizationId: ctx.organizationId,
    projectId,
    sprintId,
  }).lean();

  return successResponse(entries);
}
