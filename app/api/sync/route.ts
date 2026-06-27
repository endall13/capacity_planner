import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";
import Integration from "@/lib/db/models/Integration";
import SyncLog from "@/lib/db/models/SyncLog";
import { getProvider } from "@/lib/providers/registry";
import { checkSprintBoundary } from "@/lib/services/sync.service";

const SyncSchema = z.object({
  projectId: z.string(),
});

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const project = await Project.findOne({ _id: parsed.data.projectId, organizationId: ctx.organizationId }).lean();
  if (!project) return Errors.NOT_FOUND("Project");
  if (project.mode !== "integrated" || !project.integrationId) {
    return Errors.BAD_REQUEST("Project is not in integrated mode");
  }

  const integration = await Integration.findOne({ _id: project.integrationId, organizationId: ctx.organizationId });
  if (!integration) return Errors.NOT_FOUND("Integration");

  const syncLog = await SyncLog.create({
    organizationId: ctx.organizationId,
    integrationId: integration._id,
    triggeredBy: "manual",
    triggeredByUserId: ctx.userId,
    providerProjectId: project.providerProjectId,
    startedAt: new Date(),
    status: "running",
    summary: { epicsProcessed: 0, featuresProcessed: 0, workItemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, errors: 0 },
  });

  // Fire-and-forget — the actual sync runs out-of-band; the API responds immediately.
  getProvider(integration)
    .syncAll(project.providerProjectId!)
    .then(async (result) => {
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        $set: { status: "success", completedAt: new Date(), summary: result },
      });
    })
    .catch(async (err: Error) => {
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        $set: { status: "error", completedAt: new Date(), errorDetails: err.message },
      });
    })
    .finally(() => checkSprintBoundary(project._id.toString(), ctx.organizationId).catch(() => null));

  return successResponse({ syncLogId: syncLog._id.toString(), message: "Sync started" }, undefined, 202);
}
