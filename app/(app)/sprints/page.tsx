import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Sprint from "@/lib/db/models/Sprint";
import Project from "@/lib/db/models/Project";
import { Card } from "@/components/ui/Card";
import { GenerateScheduleButton } from "@/components/sprints/GenerateScheduleButton";

export default async function SprintCalendarPage() {
  const session = await getServerSession(authOptions);
  const { organizationId, role } = session!.user;
  const canManage = role === "admin" || role === "engineering_manager";
  const isAdmin = role === "admin";

  await connectDB();
  const sprints = await Sprint.find({ organizationId }).sort({ startDate: 1 }).lean();
  const myProject = canManage
    ? await Project.findOne({ organizationId, type: "project", lifecycleStatus: "active" }).lean()
    : null;

  const now = new Date();
  const byQuarter = new Map<string, typeof sprints>();
  for (const s of sprints) {
    const key = `${s.year}-Q${s.quarter}`;
    byQuarter.set(key, [...(byQuarter.get(key) ?? []), s]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sprint Calendar</h1>
        {isAdmin && <GenerateScheduleButton year={now.getFullYear()} />}
      </div>

      {sprints.length === 0 && (
        <Card>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            No sprint schedule generated yet.
          </div>
        </Card>
      )}

      {[...byQuarter.entries()].map(([quarter, qSprints]) => (
        <Card key={quarter}>
          <div className="mb-2 text-sm font-semibold">{quarter}</div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <th className="text-left">Sprint</th>
                <th className="text-left">Dates</th>
                <th className="text-right">Working Days</th>
                <th className="text-left">Holidays</th>
                <th className="text-right">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {qSprints.map((s) => {
                const isCurrent = s.startDate <= now && s.endDate >= now;
                return (
                  <tr
                    key={s._id.toString()}
                    style={isCurrent ? { background: "#EEF2FF", borderLeft: "3px solid var(--color-primary)" } : undefined}
                  >
                    <td className="py-1.5">
                      {s.name} {isCurrent && <span className="ml-1 text-xs font-semibold" style={{ color: "var(--color-primary)" }}>NOW</span>}
                    </td>
                    <td className="py-1.5" style={{ color: "var(--color-text-secondary)" }}>
                      {s.startDate.toLocaleDateString()} – {s.endDate.toLocaleDateString()}
                    </td>
                    <td className="py-1.5 text-right">{s.totalWorkingDays}</td>
                    <td className="py-1.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {s.holidays.map((h) => h.name).join(", ") || "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {canManage && myProject ? (
                        <Link
                          href={`/sprints/${s._id}/capacity?projectId=${myProject._id}`}
                          className="text-xs"
                          style={{ color: "var(--color-primary)" }}
                        >
                          ↻ Update capacity
                        </Link>
                      ) : (
                        <span style={{ color: "var(--color-text-disabled)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
