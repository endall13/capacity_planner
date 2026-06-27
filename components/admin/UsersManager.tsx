"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  authProvider: string;
  isActive: boolean;
}

const ROLES = ["admin", "engineering_manager", "product_manager", "director", "vp"];

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("product_manager");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    setUsers(body.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function inviteUser() {
    setSubmitting(true);
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setSubmitting(false);
    setName("");
    setEmail("");
    setPassword("");
    load();
  }

  async function updateRole(id: string, newRole: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    if (isActive) {
      await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
    }
    load();
  }

  return (
    <Card>
      <div className="mb-3 text-sm font-medium">Users</div>
      <table className="mb-4 w-full text-sm">
        <thead>
          <tr style={{ color: "var(--color-text-secondary)" }}>
            <th className="text-left">Name</th>
            <th className="text-left">Email</th>
            <th className="text-left">Role</th>
            <th className="text-left">Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td className="py-1">{u.name}</td>
              <td className="py-1">{u.email}</td>
              <td className="py-1">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u._id, e.target.value)}
                  className="rounded px-1 py-0.5 text-xs"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1">
                <button onClick={() => toggleActive(u._id, u.isActive)} className="text-xs" style={{ color: "var(--color-primary)" }}>
                  {u.isActive ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Invite User (local auth)
        </div>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Initial password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded px-3 py-2 text-sm"
          style={{ border: "1px solid var(--color-border)" }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button onClick={inviteUser} disabled={!name || !email || !password || submitting}>
          {submitting ? "Inviting..." : "Invite User"}
        </Button>
      </div>
    </Card>
  );
}
