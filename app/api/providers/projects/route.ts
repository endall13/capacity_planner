import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Integration from "@/lib/db/models/Integration";
import { getProvider } from "@/lib/providers/registry";
import { ProviderNotImplementedError } from "@/lib/providers/types";

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const integrationId = req.nextUrl.searchParams.get("integrationId");
  if (!integrationId) return Errors.BAD_REQUEST("integrationId is required");

  await connectDB();
  const integration = await Integration.findOne({ _id: integrationId, organizationId: ctx.organizationId });
  if (!integration) return Errors.NOT_FOUND("Integration");

  try {
    const projects = await getProvider(integration).getProjects();
    return successResponse(projects);
  } catch (err) {
    if (err instanceof ProviderNotImplementedError) return Errors.BAD_REQUEST(err.message);
    throw err;
  }
}
