import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import Engineer from "@/lib/db/models/Engineer";
import { Card } from "@/components/ui/Card";
import { ReassignSelect } from "@/components/engineers/ReassignSelect";

export default async function EngineerRosterPage() {
  const session = await getServerSession(authOptions);
  const { organizationId, role } = session!.user;
  const canEdit = role === "admin" || role === "engineering_manager";

  await connectDB();
  const [projects, engineers] = await Promise.all([
    Project.find({ organizationId, isActive: true }).lean(),
    Engineer.find({ organizationId, isActive: true }).lean(),
  ]);

  const totalVelocity = engineers.reduce((sum, e) => sum + e.baseVelocity, 0);
  const assignableProjects = projects.filter((p) => p.lifecycleStatus !== "completed");
  const projectOptions = assignableProjects.map((p) => ({ id: p._id.toString(), name: p.name }));

  const groups = assignableProjects.map((p) => ({
    project: p,
    engineers: engineers.filter((e) => e.assignedProjectId?.toString() === p._id.toString()),
  }));
  const reserve = engineers.filter((e) => !e.assignedProjectId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Engineer Roster</h1>

      <Card>
        <div className="mb-2 text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
          ORG CAPACITY — {engineers.length} ENGINEERS · {totalVelocity} PTS TOTAL
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded">
          {groups.map(({ project: p, engineers: es }) => {
            const pts = es.reduce((s, e) => s + e.baseVelocity, 0);
            const widthPct = totalVelocity > 0 ? (pts / totalVelocity) * 100 : 0;
            return (
              <div
                key={p._id.toString()}
                title={`${p.name} — ${pts} pts`}
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

      {groups.map(({ project: p, engineers: es }) => (
        <Card key={p._id.toString()}>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            {p.name}
            {p.type === "sustaining" && (
              <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: "#FFF3DC", color: "#B35C00" }}>
                SUSTAINING
              </span>
            )}
          </div>
          {es.length === 0 ? (
            <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              No engineers assigned.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {es.map((e) => (
                  <tr key={e._id.toString()}>
                    <td className="py-1">{e.name}</td>
                    <td className="py-1 text-right" style={{ color: "var(--color-text-secondary)" }}>
                      {e.baseVelocity} pts
                    </td>
                    {canEdit && (
                      <td className="py-1 text-right">
                        <ReassignSelect
                          engineerId={e._id.toString()}
                          currentProjectId={p._id.toString()}
                          options={projectOptions.filter((o) => o.id !== p._id.toString())}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ))}

      <Card>
        <div className="mb-2 text-sm font-medium">Reserve Pool — {reserve.length} engineers</div>
        {reserve.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            No unassigned engineers.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {reserve.map((e) => (
                <tr key={e._id.toString()}>
                  <td className="py-1">{e.name}</td>
                  <td className="py-1 text-right" style={{ color: "var(--color-text-secondary)" }}>
                    {e.baseVelocity} pts
                  </td>
                  {canEdit && (
                    <td className="py-1 text-right">
                      <ReassignSelect engineerId={e._id.toString()} currentProjectId={null} options={projectOptions} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
