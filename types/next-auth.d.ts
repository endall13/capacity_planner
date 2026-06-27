import "next-auth";
import "next-auth/jwt";
import { UserRole } from "@/lib/db/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      role: UserRole;
      organizationId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
    organizationId?: string;
  }
}
