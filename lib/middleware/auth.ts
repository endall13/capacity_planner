import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { Errors } from "@/lib/utils/api";
import type { UserRole } from "@/lib/db/models/User";

export interface AuthContext {
  userId: string;
  role: UserRole;
  organizationId: string;
}

/**
 * Validates session and returns auth context. Call at the top of every route handler.
 * Returns { ctx } on success or { error } to return immediately.
 */
export async function requireAuth(): Promise<
  { ctx: AuthContext; error: null } | { ctx: null; error: ReturnType<typeof Errors.UNAUTHORIZED> }
> {
  const session = await getServerSession(authOptions);

  if (
    !session?.user?.userId ||
    !session.user.role ||
    !session.user.organizationId
  ) {
    return { ctx: null, error: Errors.UNAUTHORIZED() };
  }

  return {
    ctx: {
      userId: session.user.userId,
      role: session.user.role,
      organizationId: session.user.organizationId,
    },
    error: null,
  };
}
