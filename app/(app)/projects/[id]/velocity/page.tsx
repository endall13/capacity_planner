import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import Engineer from "@/lib/db/models/Engineer";
import Sprint from "@/lib/db/models/Sprint";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";
import WorkItem from "@/lib/db/models/WorkItem";
import { Card } from "@/components/ui/Card";
import { VelocityTrendChart } from "@/components/charts/VelocityTrendChart";

export default async function VelocityHealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const { organizationId, role } = session!.user;

  if (role !== "engineering_manager") redirect(`/projects/${id}`);

  await connectDB();
  const project = await Project.findOne({ _id: id, organizationId }).lean();
  if (!project) notFound();

  const recentSprints = await Sprint.find({ organizationId }).sort({ startDate: -1 }).limit(6).lean();
  const sprintsAsc = [...recentSprints].reverse();
  const sprintIds = recentSprints.map((s) => s._id);
  const sprintNameById = new Map(recentSprints.map((s) => [s._id.toString(), s.name]));

  const entries = await SprintCapacityEntry.find({ projectId: id, sprintId: { $in: sprintIds } }).lean();
  const engineers = await Engineer.find({ assignedProjectId: id }).lean();
  const engineerNameById = new Map(engineers.map((e) => [e._id.toString(), e.name]));

  const byEngineer = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.engineerId.toString();
    byEngineer.set(key, [...(byEngineer.get(key) ?? []), entry]);
  }

  const engineerSeries = [...byEngineer.entries()].map(([engineerId, engEntries]) => {
    const bySprintId = new Map(engEntries.map((e) => [e.sprintId.toString(), e]));
    return {
      engineerId,
      engineerName: engineerNameById.get(engineerId) ?? "Unknown",
      sprints: sprintsAsc.map((s) => ({
        sprintName: s.name,
        effectiveVelocity: bySprintId.get(s._id.toString())?.effectiveVelocity ?? 0,
      })),
    };
  });

  const injectionScenarioB = entries
    .filter((e) => e.injectionPoints > 0)
    .map((e) => ({
      sprintName: sprintNameById.get(e.sprintId.toString()) ?? "Unknown",
      engineerName: engineerNameById.get(e.engineerId.toString()) ?? "Unknown",
      injectionPoints: e.injectionPoints,
      injectionNote: e.injectionNote,
    }));

  const avgBaseVelocity = engineers.length > 0 ? Math.round(engineers.reduce((s, e) => s + e.baseVelocity, 0) / engineers.length) : 0;

  let planningHealth: { healthy: number; at_risk: number; needs_decomposition: number } | null = null;
  if (project.mode === "integrated") {
    const workItems = await WorkItem.find({ projectId: id }).lean();
    planningHealth = {
      healthy: workItems.filter((w) => w.planningHealth === "healthy").length,
      at_risk: workItems.filter((w) => w.planningHealth === "at_risk").length,
      needs_decomposition: workItems.filter((w) => w.planningHealth === "needs_decomposition").length,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Velocity Health</h1>
        <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: "#FFF3DC", color: "#B35C00" }}>
          EM ONLY
        </span>
      </div>

      <Card>
        <div className="mb-2 text-sm font-medium">Engineer Velocity Trend</div>
        <VelocityTrendChart engineers={engineerSeries} baseVelocity={avgBaseVelocity} />
      </Card>

      <Card>
        <div className="mb-2 text-sm font-medium">Injection History (Scenario B — out of scope)</div>
        {injectionScenarioB.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            No injection events recorded.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <th className="text-left">Sprint</th>
                <th className="text-left">Engineer</th>
                <th className="text-right">Points</th>
                <th className="text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {injectionScenarioB.map((row, i) => (
                <tr key={i}>
                  <td className="py-1">{row.sprintName}</td>
                  <td className="py-1">{row.engineerName}</td>
                  <td className="py-1 text-right">{row.injectionPoints}</td>
                  <td className="py-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {row.injectionNote ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {planningHealth && (
        <Card>
          <div className="mb-2 text-sm font-medium">Planning Health</div>
          <div className="flex gap-4 text-sm">
            <span>✅ Healthy: {planningHealth.healthy}</span>
            <span>🟡 At risk: {planningHealth.at_risk}</span>
            <span>🔴 Needs decomposition: {planningHealth.needs_decomposition}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
