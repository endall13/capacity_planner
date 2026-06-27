"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@/lib/db/models/User";

/** Returns the current user's role from the session, or null if not signed in. */
export function useRole(): UserRole | null {
  const { data: session } = useSession();
  return session?.user.role ?? null;
}
