import { Errors } from "@/lib/utils/api";
import type { UserRole } from "@/lib/db/models/User";
import type { AuthContext } from "./auth";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 5,
  engineering_manager: 4,
  product_manager: 3,
  director: 3,
  vp: 3,
};

/**
 * Returns error response if ctx.role is not in allowedRoles, otherwise null.
 * Usage: const err = requireRole(ctx, ["admin", "engineering_manager"]); if (err) return err;
 */
export function requireRole(
  ctx: AuthContext,
  allowedRoles: UserRole[]
): ReturnType<typeof Errors.FORBIDDEN> | null {
  if (!allowedRoles.includes(ctx.role)) {
    return Errors.FORBIDDEN();
  }
  return null;
}

/**
 * Returns error if ctx.role rank is below minimumRole.
 */
export function requireMinRole(
  ctx: AuthContext,
  minimumRole: UserRole
): ReturnType<typeof Errors.FORBIDDEN> | null {
  if (ROLE_HIERARCHY[ctx.role] < ROLE_HIERARCHY[minimumRole]) {
    return Errors.FORBIDDEN();
  }
  return null;
}

export { ROLE_HIERARCHY };
