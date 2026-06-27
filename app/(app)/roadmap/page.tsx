import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import { Card } from "@/components/ui/Card";
import { RoadmapChart, type RoadmapBar } from "@/components/roadmap/RoadmapChart";
import { PlanProjectPanel } from "@/components/roadmap/PlanProjectPanel";

export default async function RoadmapPage() {
  const session = await getServerSession(authOptions);
  const { organizationId, role } = session!.user;
  const canPlan = role === "admin" || role === "engineering_manager";

  await connectDB();
  const projects = await Project.find({ organizationId, isActive: true }).lean();

  const bars: RoadmapBar[] = [];
  const now = new Date();
  const oneYearOut = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  for (const p of projects) {
    if (p.type === "sustaining") {
      bars.push({ id: p._id.toString(), name: p.name, start: now.toISOString(), end: oneYearOut.toISOString(), kind: "sustaining" });
    } else if (p.lifecycleStatus === "active" && p.forecast) {
      bars.push({
        id: p._id.toString(),
        name: p.name,
        start: p.createdAt.toISOString(),
        end: p.forecast.projectedCompleteDate.toISOString(),
        kind: "active",
        status: p.status,
      });
    } else if (p.lifecycleStatus === "planned" && p.proposedStartDate && p.proposedEndDate) {
      bars.push({
        id: p._id.toString(),
        name: p.name,
        start: p.proposedStartDate.toISOString(),
        end: p.proposedEndDate.toISOString(),
        kind: "planned",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Roadmap</h1>
        {canPlan && <PlanProjectPanel />}
      </div>

      <Card>
        {bars.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            No projects to show yet.
          </div>
        ) : (
          <RoadmapChart bars={bars} />
        )}
      </Card>
    </div>
  );
}
