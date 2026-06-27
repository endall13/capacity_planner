import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import Epic from "@/lib/db/models/Epic";
import Feature from "@/lib/db/models/Feature";
import Engineer from "@/lib/db/models/Engineer";
import Sprint from "@/lib/db/models/Sprint";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BurndownChart, type BurndownPoint } from "@/components/charts/BurndownChart";
import { FeatureList } from "@/components/projects/FeatureList";

export default async function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const { organizationId, role } = session!.user;
  const canEdit = role === "admin" || role === "engineering_manager";

  await connectDB();
  const project = await Project.findOne({ _id: id, organizationId }).lean();
  if (!project) notFound();

  const [epics, features, engineers, sprints] = await Promise.all([
    Epic.find({ projectId: id }).lean(),
    Feature.find({ projectId: id }).lean(),
    Engineer.find({ organizationId, assignedProjectId: id, isActive: true }).lean(),
    Sprint.find({ organizationId }).sort({ startDate: 1 }).lean(),
  ]);

  const now = new Date();
  const currentSprint = sprints.find((s) => s.startDate <= now && s.endDate >= now) ?? null;
  const currentEntries = currentSprint
    ? await SprintCapacityEntry.find({ projectId: id, sprintId: currentSprint._id }).lean()
    : [];
  const entryByEngineer = new Map(currentEntries.map((e) => [e.engineerId.toString(), e]));

  const needsCapacityUpdate = currentSprint ? engineers.some((e) => !entryByEngineer.has(e._id.toString())) : false;

  const forecast = project.forecast;
  const futureSprints = sprints.filter((s) => s.endDate >= now).slice(0, forecast?.projectedSprintsRemaining ?? 6);
  const burndown: BurndownPoint[] = forecast
    ? futureSprints.map((s, i) => {
        const idealStep = forecast.remainingPoints / Math.max(futureSprints.length, 1);
        return {
          sprintName: s.name,
          remaining: Math.max(0, Math.round(forecast.remainingPoints - i * forecast.currentTeamVelocity)),
          ideal: Math.max(0, Math.round(forecast.remainingPoints - i * idealStep)),
          isCurrent: s._id.toString() === currentSprint?._id.toString(),
        };
      })
    : [];

  const epicRows = epics.map((e) => ({ _id: e._id.toString(), title: e.title, totalPoints: e.totalPoints, completedPoints: e.completedPoints }));
  const featureRows = features.map((f) => ({
    _id: f._id.toString(),
    epicId: f.epicId.toString(),
    title: f.title,
    storyCount: f.storyCount,
    completedStoryCount: f.completedStoryCount,
    totalPoints: f.totalPoints,
    completedPoints: f.completedPoints,
    derivedStatus: f.derivedStatus,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            ← Portfolio
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {project.mode === "integrated" ? "Integrated" : "Manual"}
          </span>
          {project.status && <Badge variant={project.status} />}
        </div>
        <div className="flex items-center gap-2">
          {currentSprint && needsCapacityUpdate && canEdit && (
            <Link
              href={`/sprints/${currentSprint._id}/capacity`}
              className="rounded px-3 py-2 text-sm font-medium text-white"
              style={{ background: "var(--color-primary)" }}
            >
              ↻ Update Sprint
            </Link>
          )}
          {role === "engineering_manager" && (
            <Link href={`/projects/${id}/velocity`} className="text-sm" style={{ color: "var(--color-primary)" }}>
              Health →
            </Link>
          )}
        </div>
      </div>

      {forecast && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Progress"
            value={`${forecast.totalPoints > 0 ? Math.round((forecast.completedPoints / forecast.totalPoints) * 100) : 0}%`}
          />
          <StatCard label="Completes" value={new Date(forecast.projectedCompleteDate).toLocaleDateString()} />
          <StatCard label="Team Velocity" value={`${forecast.currentTeamVelocity} pts`} />
          <StatCard label="Remaining" value={`${forecast.remainingPoints} pts`} />
          <StatCard label="Sprints Left" value={`${forecast.projectedSprintsRemaining}`} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <div className="mb-2 text-sm font-medium">Burndown</div>
            <BurndownChart data={burndown} />
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Scope</div>
              {canEdit && project.mode === "manual" && (
                <Link href={`/projects/${id}/scope`} className="text-xs" style={{ color: "var(--color-primary)" }}>
                  + Add Epic
                </Link>
              )}
            </div>
            <FeatureList epics={epicRows} features={featureRows} mode={project.mode} canEdit={canEdit} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {canEdit && currentSprint && (
            <Card>
              <div className="mb-2 text-sm font-medium">Team — Current Sprint</div>
              <div className="flex flex-col gap-1 text-sm">
                {engineers.map((e) => {
                  const entry = entryByEngineer.get(e._id.toString());
                  return (
                    <div key={e._id.toString()} className="flex items-center justify-between">
                      <span>{e.name}</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {entry ? `${entry.effectiveVelocity} / ${e.baseVelocity} pts` : "No entry yet"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </Card>
  );
}
