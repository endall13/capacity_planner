import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Project from "@/lib/db/models/Project";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["project", "sustaining"]).default("project"),
  mode: z.enum(["manual", "integrated"]).optional(),
  avgStoryPoints: z.number().positive().optional(),
  integrationId: z.string().optional(),
  providerProjectId: z.string().optional(),
  scopedEpicIds: z.array(z.string()).optional(),
  lifecycleStatus: z.enum(["planned", "active", "completed"]).default("planned"),
  proposedStartDate: z.coerce.date().optional(),
  proposedEndDate: z.coerce.date().optional(),
});

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const status = req.nextUrl.searchParams.get("status");

  const filter: Record<string, unknown> = { organizationId: ctx.organizationId, isActive: true };
  if (status) filter.status = status;

  const projects = await Project.find(filter).lean();
  return successResponse(projects);
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const project = await Project.create({
    organizationId: ctx.organizationId,
    ...parsed.data,
    scopedEpicIds: parsed.data.scopedEpicIds ?? [],
    isActive: true,
  });

  return successResponse(project, undefined, 201);
}
