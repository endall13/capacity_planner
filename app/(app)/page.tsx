import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import Engineer from "@/lib/db/models/Engineer";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  const organizationId = session!.user.organizationId;

  await connectDB();
  const [projects, engineers] = await Promise.all([
    Project.find({ organizationId, isActive: true }).lean(),
    Engineer.find({ organizationId, isActive: true }).lean(),
  ]);

  const activeProjects = projects.filter((p) => p.type === "project" && p.lifecycleStatus === "active");
  const plannedProjects = projects.filter((p) => p.type === "project" && p.lifecycleStatus === "planned");
  const sustaining = projects.filter((p) => p.type === "sustaining");

  const engineersByProject = new Map<string, typeof engineers>();
  const reserve: typeof engineers = [];
  for (const e of engineers) {
    if (!e.assignedProjectId) {
      reserve.push(e);
      continue;
    }
    const key = e.assignedProjectId.toString();
    engineersByProject.set(key, [...(engineersByProject.get(key) ?? []), e]);
  }

  const totalVelocity = engineers.reduce((sum, e) => sum + e.baseVelocity, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <Link
          href="/projects/new"
          className="rounded px-3 py-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          + New Project
        </Link>
      </div>

      <Card>
        <div className="mb-2 text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
          ORG CAPACITY — {engineers.length} ENGINEERS · {totalVelocity} PTS TOTAL
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded">
          {[...activeProjects, ...sustaining].map((p) => {
            const count = engineersByProject.get(p._id.toString())?.length ?? 0;
            const pts = (engineersByProject.get(p._id.toString()) ?? []).reduce((s, e) => s + e.baseVelocity, 0);
            const widthPct = totalVelocity > 0 ? (pts / totalVelocity) * 100 : 0;
            return (
              <div
                key={p._id.toString()}
                title={`${p.name} — ${pts} pts (${count} eng)`}
                style={{ width: `${widthPct}%`, background: p.type === "sustaining" ? "#F4B740" : "var(--color-primary)" }}
              />
            );
          })}
          {reserve.length > 0 && (
            <div
              style={{
                width: `${totalVelocity > 0 ? (reserve.reduce((s, e) => s + e.baseVelocity, 0) / totalVelocity) * 100 : 0}%`,
                background: "var(--color-border)",
              }}
            />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeProjects.map((p) => {
          const team = engineersByProject.get(p._id.toString()) ?? [];
          const progressPct = p.forecast && p.forecast.totalPoints > 0 ? Math.round((p.forecast.completedPoints / p.forecast.totalPoints) * 100) : 0;
          return (
            <Link key={p._id.toString()} href={`/projects/${p._id}`}>
              <Card className="h-full hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  {p.status && <Badge variant={p.status} />}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {p.mode === "integrated" ? "Integrated" : "Manual"}
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded" style={{ background: "var(--color-border)" }}>
                  <div className="h-full" style={{ width: `${progressPct}%`, background: "var(--color-primary)" }} />
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {progressPct}% complete
                </div>
                {p.forecast && (
                  <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                    <div style={{ color: "var(--color-text-secondary)" }}>Completes</div>
                    <div>{new Date(p.forecast.projectedCompleteDate).toLocaleDateString()}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>Velocity</div>
                    <div>{p.forecast.currentTeamVelocity} pts</div>
                  </div>
                )}
                <div className="mt-3 flex gap-1">
                  {team.map((e) => (
                    <div
                      key={e._id.toString()}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--color-border)" }}
                    >
                      {initials(e.name)}
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {sustaining.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
            SUSTAINING
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sustaining.map((p) => (
              <Card key={p._id.toString()}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.name}</div>
                  <span
                    className="rounded px-2 py-0.5 text-xs font-semibold"
                    style={{ background: "#FFF3DC", color: "#B35C00" }}
                  >
                    SUSTAINING
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {(engineersByProject.get(p._id.toString()) ?? []).length} engineers
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {plannedProjects.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
            PLANNED
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plannedProjects.map((p) => (
              <Card key={p._id.toString()} className="border-dashed">
                <div className="font-medium">{p.name}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Proposed: {p.proposedStartDate ? new Date(p.proposedStartDate).toLocaleDateString() : "TBD"} –{" "}
                  {p.proposedEndDate ? new Date(p.proposedEndDate).toLocaleDateString() : "TBD"}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {reserve.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">👤 Reserve Pool — {reserve.length} engineers available</div>
            <Link href="/engineers" className="text-sm" style={{ color: "var(--color-primary)" }}>
              Assign Engineers →
            </Link>
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {reserve.map((e) => e.name).join(" · ")}
          </div>
        </Card>
      )}
    </div>
  );
}
