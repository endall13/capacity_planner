"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Holiday {
  date: string;
  name: string;
}

export function OrgSettingsForm({
  initialAvgStoryPoints,
  initialHolidays,
  initialLocalAuthEnabled,
}: {
  initialAvgStoryPoints: number;
  initialHolidays: Holiday[];
  initialLocalAuthEnabled: boolean;
}) {
  const [avgStoryPoints, setAvgStoryPoints] = useState(initialAvgStoryPoints);
  const [localAuthEnabled, setLocalAuthEnabled] = useState(initialLocalAuthEnabled);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addHoliday() {
    if (!newDate || !newName) return;
    setHolidays((prev) => [...prev, { date: newDate, name: newName }]);
    setNewDate("");
    setNewName("");
  }

  function removeHoliday(idx: number) {
    setHolidays((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holidays, settings: { avgStoryPoints, localAuthEnabled } }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <Card>
      <div className="mb-3 text-sm font-medium">Organization Settings</div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Default avg story points</label>
          <Input type="number" min={1} value={avgStoryPoints} onChange={(e) => setAvgStoryPoints(Number(e.target.value))} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={localAuthEnabled} onChange={(e) => setLocalAuthEnabled(e.target.checked)} />
          Allow local (non-SSO) login
        </label>

        <div>
          <div className="mb-1 text-sm font-medium">Holidays</div>
          <div className="flex flex-col gap-1">
            {holidays.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>
                  {h.date} — {h.name}
                </span>
                <button onClick={() => removeHoliday(i)} className="text-xs" style={{ color: "var(--color-rag-red-text)" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <Input placeholder="Holiday name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button variant="secondary" onClick={addHoliday}>
              + Add
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saved && <span className="text-xs" style={{ color: "var(--color-rag-green-text)" }}>Saved</span>}
        </div>
      </div>
    </Card>
  );
}
