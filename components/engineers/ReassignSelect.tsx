"use client";

import { useRouter } from "next/navigation";

export function ReassignSelect({
  engineerId,
  currentProjectId,
  options,
}: {
  engineerId: string;
  currentProjectId: string | null;
  options: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function handleChange(value: string) {
    await fetch(`/api/engineers/${engineerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedProjectId: value === "" ? null : value }),
    });
    router.refresh();
  }

  return (
    <select
      defaultValue={currentProjectId ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded px-2 py-1 text-xs"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <option value="">Reserve (unassigned)</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
