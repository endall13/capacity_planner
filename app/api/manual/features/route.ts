import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import { connectDB } from "@/lib/db/connection";
import Epic from "@/lib/db/models/Epic";
import { createFeature } from "@/lib/services/manual.service";

const CreateFeatureSchema = z.object({
  epicId: z.string(),
  title: z.string().min(1),
  storyCount: z.number().nonnegative(),
});

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin", "engineering_manager"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateFeatureSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const owned = await Epic.exists({ _id: parsed.data.epicId, organizationId: ctx.organizationId });
  if (!owned) return Errors.NOT_FOUND("Epic");

  const feature = await createFeature(parsed.data.epicId, { title: parsed.data.title, storyCount: parsed.data.storyCount });
  return successResponse(feature, undefined, 201);
}
