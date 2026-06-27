import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Engineer from "@/lib/db/models/Engineer";
import Sprint from "@/lib/db/models/Sprint";
import SprintCapacityEntry from "@/lib/db/models/SprintCapacityEntry";
import { calculateCapacity } from "@/lib/services/capacity.service";
import { recomputeForecast } from "@/lib/services/forecast.service";

const UpsertSchema = z.object({
  ptoDays: z.number().min(0).optional(),
  sickDays: z.number().min(0).optional(),
  injectionPoints: z.number().min(0).optional(),
  injectionNote: z.string().optional(),
  sprintJoinDate: z.coerce.date().nullable().optional(),
  sprintLeaveDate: z.coerce.date().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ engineerId: string; sprintId: string }> }
) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const { engineerId, sprintId } = await params;
  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const engineer = await Engineer.findOne({ _id: engineerId, organizationId: ctx.organizationId }).lean();
  if (!engineer) return Errors.NOT_FOUND("Engineer");
  if (!engineer.assignedProjectId) return Errors.BAD_REQUEST("Engineer is not assigned to a project");

  const sprint = await Sprint.findOne({ _id: sprintId, organizationId: ctx.organizationId }).lean();
  if (!sprint) return Errors.NOT_FOUND("Sprint");

  const existing = await SprintCapacityEntry.findOne({ engineerId, sprintId }).lean();

  const ptoDays = parsed.data.ptoDays ?? existing?.ptoDays ?? 0;
  const sickDays = parsed.data.sickDays ?? existing?.sickDays ?? 0;
  const injectionPoints = parsed.data.injectionPoints ?? existing?.injectionPoints ?? 0;
  const injectionNote = parsed.data.injectionNote ?? existing?.injectionNote;
  const sprintJoinDate = parsed.data.sprintJoinDate !== undefined ? parsed.data.sprintJoinDate : existing?.sprintJoinDate;
  const sprintLeaveDate = parsed.data.sprintLeaveDate !== undefined ? parsed.data.sprintLeaveDate : existing?.sprintLeaveDate;

  const computed = calculateCapacity({
    baseVelocity: engineer.baseVelocity,
    sprint: { startDate: sprint.startDate, endDate: sprint.endDate, totalWorkingDays: sprint.totalWorkingDays, holidays: sprint.holidays },
    ptoDays,
    sickDays,
    sprintJoinDate: sprintJoinDate ?? undefined,
    sprintLeaveDate: sprintLeaveDate ?? undefined,
    injectionPoints,
  });

  const entry = await SprintCapacityEntry.findOneAndUpdate(
    { engineerId, sprintId },
    {
      $set: {
        organizationId: ctx.organizationId,
        sprintId,
        engineerId,
        projectId: engineer.assignedProjectId,
        ptoDays,
        sickDays,
        injectionPoints,
        injectionNote,
        sprintJoinDate: sprintJoinDate ?? undefined,
        sprintLeaveDate: sprintLeaveDate ?? undefined,
        totalDaysOff: computed.totalDaysOff,
        availableDays: computed.availableDays,
        plannedVelocity: computed.plannedVelocity,
        effectiveVelocity: computed.effectiveVelocity,
      },
    },
    { upsert: true, new: true }
  );

  await recomputeForecast(engineer.assignedProjectId.toString());

  return successResponse(entry);
}
