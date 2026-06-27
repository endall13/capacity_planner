import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import cron from "node-cron";
import { Types } from "mongoose";

// Next.js auto-loads .env.local; this worker runs standalone, so load it ourselves.
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim();
  }
}

import { connectDB } from "@/lib/db/connection";
import Project, { type IProject } from "@/lib/db/models/Project";
import Integration from "@/lib/db/models/Integration";
import SyncLog from "@/lib/db/models/SyncLog";
import { getProvider } from "@/lib/providers/registry";
import { checkSprintBoundary } from "@/lib/services/sync.service";

export interface SyncCycleResult {
  projectsProcessed: number;
  succeeded: number;
  failed: number;
}

/**
 * Syncs one integrated project: calls the provider's syncAll(), logs the
 * result, then runs sprint boundary detection regardless of sync outcome —
 * boundary detection operates on whatever scope is already in our DB, so a
 * failed provider call shouldn't block snapshot open/close.
 */
type SyncableProject = Pick<IProject, "_id" | "organizationId" | "integrationId" | "providerProjectId">;

async function syncProject(project: SyncableProject): Promise<boolean> {
  const integration = await Integration.findOne({ _id: project.integrationId, organizationId: project.organizationId });
  if (!integration) return false;

  const syncLog = await SyncLog.create({
    organizationId: project.organizationId,
    integrationId: integration._id,
    triggeredBy: "scheduled",
    providerProjectId: project.providerProjectId,
    startedAt: new Date(),
    status: "running",
    summary: { epicsProcessed: 0, featuresProcessed: 0, workItemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, errors: 0 },
  });

  let succeeded = false;
  try {
    const result = await getProvider(integration).syncAll(project.providerProjectId!);
    await SyncLog.findByIdAndUpdate(syncLog._id, { $set: { status: "success", completedAt: new Date(), summary: result } });
    succeeded = true;
  } catch (err) {
    await SyncLog.findByIdAndUpdate(syncLog._id, {
      $set: { status: "error", completedAt: new Date(), errorDetails: err instanceof Error ? err.message : String(err) },
    });
  }

  await checkSprintBoundary((project._id as Types.ObjectId).toString(), (project.organizationId as Types.ObjectId).toString());
  return succeeded;
}

/** Runs one sync cycle across all active integrated projects, all orgs. */
export async function runSyncCycle(): Promise<SyncCycleResult> {
  await connectDB();
  const projects: SyncableProject[] = await Project.find({
    type: "project",
    mode: "integrated",
    isActive: true,
    lifecycleStatus: "active",
  }).lean();

  let succeeded = 0;
  let failed = 0;
  for (const project of projects) {
    const ok = await syncProject(project);
    if (ok) succeeded++;
    else failed++;
  }

  return { projectsProcessed: projects.length, succeeded, failed };
}

function startScheduler(): void {
  const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? "15");
  console.log(`[sync.worker] starting — interval ${intervalMinutes}m`);

  runSyncCycle()
    .then((r) => console.log(`[sync.worker] initial cycle: ${r.succeeded}/${r.projectsProcessed} succeeded`))
    .catch((err) => console.error("[sync.worker] initial cycle failed:", err));

  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    runSyncCycle()
      .then((r) => console.log(`[sync.worker] cycle: ${r.succeeded}/${r.projectsProcessed} succeeded`))
      .catch((err) => console.error("[sync.worker] cycle failed:", err));
  });
}

// Run directly (e.g. `tsx worker/sync.worker.ts` or as a separate deployed process) —
// not imported as a module by the Next.js app, which only calls runSyncCycle() on demand.
const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  startScheduler();
}
