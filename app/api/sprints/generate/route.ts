import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Organization from "@/lib/db/models/Organization";
import { generateSprintSchedule } from "@/lib/services/sprint.service";

const GenerateSchema = z.object({
  year: z.number().int().min(2000).max(2200),
});

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const org = await Organization.findById(ctx.organizationId).lean();
  if (!org) return Errors.NOT_FOUND("Organization");

  const sprints = await generateSprintSchedule(ctx.organizationId, org.sprintAnchorDate, parsed.data.year, org.holidays);

  return successResponse({ sprintsGenerated: sprints.length }, undefined, 201);
}
