import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/middleware/auth";
import { requireRole } from "@/lib/middleware/roles";
import { successResponse, Errors } from "@/lib/utils/api";
import User from "@/lib/db/models/User";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "engineering_manager", "product_manager", "director", "vp"]),
  password: z.string().min(8),
});

export async function GET() {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  await connectDB();
  const users = await User.find({ organizationId: ctx.organizationId })
    .select("-passwordHash")
    .lean();

  return successResponse(users);
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAuth();
  if (error) return error;
  const roleError = requireRole(ctx, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return Errors.BAD_REQUEST(parsed.error.message);

  await connectDB();
  const existing = await User.findOne({ organizationId: ctx.organizationId, email: parsed.data.email });
  if (existing) return Errors.BAD_REQUEST("A user with this email already exists");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await User.create({
    organizationId: ctx.organizationId,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    authProvider: "local",
    passwordHash,
    isActive: true,
  });

  const { passwordHash: _omit, ...safeUser } = user.toObject();
  return successResponse(safeUser, undefined, 201);
}
