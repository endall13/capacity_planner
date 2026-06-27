import { requireAuth } from "@/lib/middleware/auth";
import { successResponse } from "@/lib/utils/api";

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  return successResponse({ status: "ok", role: ctx.role, organizationId: ctx.organizationId });
}
