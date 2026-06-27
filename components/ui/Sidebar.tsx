"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { UserRole } from "@/lib/db/models/User";

const WORKSPACE_NAV = [
  { href: "/", label: "Portfolio" },
  { href: "/sprints", label: "Sprints" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/engineers", label: "Engineers" },
];

const ADMIN_ROLES: UserRole[] = ["admin", "engineering_manager"];

const ADMIN_NAV = [
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/settings", label: "Settings" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user.role;
  const showAdmin = role ? ADMIN_ROLES.includes(role) : false;

  return (
    <aside
      className="flex h-full w-60 flex-col text-sm"
      style={{ background: "var(--color-sidebar)", color: "#FFFFFF" }}
    >
      <div className="px-4 py-5">
        <div className="font-semibold">Capacity Planner</div>
      </div>

      <nav className="flex-1 px-2">
        <div className="px-2 py-1 text-xs font-semibold tracking-wide text-white/40">WORKSPACE</div>
        {WORKSPACE_NAV.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
        ))}

        {showAdmin && (
          <>
            <div className="mt-4 px-2 py-1 text-xs font-semibold tracking-wide text-white/40">ADMIN</div>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
            ))}
          </>
        )}
      </nav>

      {session?.user && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {initials(session.user.name ?? "?")}
            </div>
            <div className="flex-1">
              <div className="text-sm">{session.user.name}</div>
              <div className="text-xs text-white/50">{role}</div>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="mt-2 text-xs text-white/50 hover:text-white">
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="block rounded px-2 py-1.5 text-sm"
      style={active ? { background: "rgba(79,142,247,0.2)", color: "#FFFFFF" } : { color: "rgba(255,255,255,0.7)" }}
    >
      {label}
    </Link>
  );
}
