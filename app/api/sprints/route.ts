import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse } from "@/lib/utils/api";
import Sprint from "@/lib/db/models/Sprint";

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const sprints = await Sprint.find({ organizationId: ctx.organizationId }).sort({ startDate: 1 }).lean();
  return successResponse(sprints);
}
