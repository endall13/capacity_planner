import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import { createEpic } from "@/lib/services/manual.service";

const CreateEpicSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateEpicSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const project = await Project.findOne({ _id: parsed.data.projectId, organizationId: ctx.organizationId }).lean();
  if (!project) return Errors.NOT_FOUND("Project");
  if (project.mode !== "manual") return Errors.BAD_REQUEST("Project is not in manual mode");

  const epic = await createEpic(parsed.data.projectId, parsed.data.title);
  return successResponse(epic, undefined, 201);
}
