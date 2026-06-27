import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse, Errors } from "@/lib/utils/api";
import Sprint from "@/lib/db/models/Sprint";

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const now = new Date();
  const sprint = await Sprint.findOne({
    organizationId: ctx.organizationId,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).lean();

  if (!sprint) return Errors.NOT_FOUND("Current sprint");
  return successResponse(sprint);
}
