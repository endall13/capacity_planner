import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import Integration from "@/lib/db/models/Integration";
import { encrypt } from "@/lib/utils/encryption";

const CreateIntegrationSchema = z.object({
  provider: z.enum(["ado", "jira"]),
  displayName: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

// Strips raw secret fields and replaces them with an "Encrypted" marker — never echo ciphertext either.
function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...config };
  for (const key of Object.keys(sanitized)) {
    if (key.toLowerCase().includes("pat") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  await connectDB();
  const integrations = await Integration.find({ organizationId: ctx.organizationId }).lean();
  const sanitized = integrations.map((i) => ({ ...i, config: sanitizeConfig(i.config) }));

  return successResponse(sanitized);
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateIntegrationSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  const config = { ...parsed.data.config };
  if (typeof config.pat === "string") {
    config.patEncrypted = encrypt(config.pat);
    delete config.pat;
  }
  if (typeof config.apiToken === "string") {
    config.apiTokenEncrypted = encrypt(config.apiToken);
    delete config.apiToken;
  }

  await connectDB();
  const integration = await Integration.create({
    organizationId: ctx.organizationId,
    provider: parsed.data.provider,
    displayName: parsed.data.displayName,
    config,
    status: "disconnected",
    lastSyncStatus: "never",
  });

  const result = { ...integration.toObject(), config: sanitizeConfig(integration.config) };
  return successResponse(result, undefined, 201);
}
