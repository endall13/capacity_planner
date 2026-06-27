import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse, Errors } from "@/lib/utils/api";
import Sprint from "@/lib/db/models/Sprint";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const sprint = await Sprint.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  if (!sprint) return Errors.NOT_FOUND("Sprint");

  return successResponse(sprint);
}
