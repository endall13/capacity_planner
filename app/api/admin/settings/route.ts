import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Organization from "@/lib/db/models/Organization";

const HolidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1),
});

const SettingsSchema = z.object({
  sprintAnchorDate: z.coerce.date().optional(),
  holidays: z.array(HolidaySchema).optional(),
  settings: z
    .object({
      localAuthEnabled: z.boolean().optional(),
      azureAdTenantId: z.string().optional(),
      syncIntervalMinutes: z.number().positive().optional(),
      avgStoryPoints: z.number().positive().optional(),
    })
    .optional(),
});

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  await connectDB();
  const org = await Organization.findById(ctx.organizationId).lean();
  if (!org) return Errors.NOT_FOUND("Organization");

  return successResponse(org);
}

export async function PUT(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const update: Record<string, unknown> = {};
  if (parsed.data.sprintAnchorDate) update.sprintAnchorDate = parsed.data.sprintAnchorDate;
  if (parsed.data.holidays) update.holidays = parsed.data.holidays;
  if (parsed.data.settings) {
    for (const [key, value] of Object.entries(parsed.data.settings)) {
      update[`settings.${key}`] = value;
    }
  }

  const org = await Organization.findByIdAndUpdate(ctx.organizationId, { $set: update }, { new: true });
  if (!org) return Errors.NOT_FOUND("Organization");

  return successResponse(org);
}
