import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { successResponse } from "@/lib/utils/api";
import Engineer from "@/lib/db/models/Engineer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const engineers = await Engineer.find({ organizationId: ctx.organizationId, assignedProjectId: id, isActive: true }).lean();

  return successResponse(engineers);
}
