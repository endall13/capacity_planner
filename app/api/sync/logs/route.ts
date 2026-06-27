import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse } from "@/lib/utils/api";
import SyncLog from "@/lib/db/models/SyncLog";

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const integrationId = req.nextUrl.searchParams.get("integrationId");
  const status = req.nextUrl.searchParams.get("status");
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "25");

  await connectDB();
  const filter: Record<string, unknown> = { organizationId: ctx.organizationId };
  if (integrationId) filter.integrationId = integrationId;
  if (status) filter.status = status;

  const [logs, total] = await Promise.all([
    SyncLog.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SyncLog.countDocuments(filter),
  ]);

  return successResponse(logs, { page, limit, total });
}
