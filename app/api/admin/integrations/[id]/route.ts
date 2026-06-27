import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Integration from "@/lib/db/models/Integration";
import { encrypt } from "@/lib/utils/encryption";

const UpdateIntegrationSchema = z.object({
  displayName: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...config };
  for (const key of Object.keys(sanitized)) {
    if (key.toLowerCase().includes("pat") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateIntegrationSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const integration = await Integration.findOne({ _id: id, organizationId: ctx.organizationId });
  if (!integration) return Errors.NOT_FOUND("Integration");

  if (parsed.data.displayName !== undefined) integration.displayName = parsed.data.displayName;

  if (parsed.data.config) {
    const config = { ...integration.config, ...parsed.data.config };
    if (typeof config.pat === "string") {
      config.patEncrypted = encrypt(config.pat);
      delete config.pat;
    }
    if (typeof config.apiToken === "string") {
      config.apiTokenEncrypted = encrypt(config.apiToken);
      delete config.apiToken;
    }
    integration.config = config;
  }

  await integration.save();

  const result = { ...integration.toObject(), config: sanitizeConfig(integration.config) };
  return successResponse(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const { id } = await params;
  await connectDB();
  const integration = await Integration.findOneAndUpdate(
    { _id: id, organizationId: ctx.organizationId },
    { $set: { status: "disconnected" } },
    { new: true }
  );
  if (!integration) return Errors.NOT_FOUND("Integration");

  const result = { ...integration.toObject(), config: sanitizeConfig(integration.config) };
  return successResponse(result);
}
