"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface EngineerRow {
  _id: string;
  name: string;
  baseVelocity: number;
}

interface CapacityDraft {
  ptoDays: number;
  sickDays: number;
  injectionPoints: number;
  injectionNote: string;
}

type Step = "roster" | "absences" | "injection" | "confirm";

export default function SprintCapacityWizardPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId");

  const [step, setStep] = useState<Step>("roster");
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CapacityDraft>>({});
  const [sprintName, setSprintName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [sprintRes, engineersRes] = await Promise.all([
        fetch(`/api/sprints/${params.id}`),
        fetch(`/api/engineers?assignedTo=${projectId}`),
      ]);
      const sprintBody = await sprintRes.json();
      const engineersBody = await engineersRes.json();
      setSprintName(sprintBody.data?.name ?? "");
      const list: EngineerRow[] = engineersBody.data ?? [];
      setEngineers(list);
      setDrafts(
        Object.fromEntries(
          list.map((e) => [e._id, { ptoDays: 0, sickDays: 0, injectionPoints: 0, injectionNote: "" }])
        )
      );
      setLoaded(true);
    })();
  }, [params.id, projectId]);

  function updateDraft(engineerId: string, patch: Partial<CapacityDraft>) {
    setDrafts((prev) => ({ ...prev, [engineerId]: { ...prev[engineerId], ...patch } }));
  }

  function effectiveVelocity(e: EngineerRow): number {
    const d = drafts[e._id];
    if (!d) return e.baseVelocity;
    const dailyRate = e.baseVelocity / 10;
    const planned = dailyRate * Math.max(0, 10 - d.ptoDays - d.sickDays);
    return Math.max(0, Math.round((planned - d.injectionPoints) * 10) / 10);
  }

  const teamVelocity = engineers.reduce((sum, e) => sum + effectiveVelocity(e), 0);

  async function saveAndClose() {
    setSaving(true);
    await Promise.all(
      engineers.map((e) => {
        const d = drafts[e._id];
        return fetch(`/api/capacity/${e._id}/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ptoDays: d.ptoDays,
            sickDays: d.sickDays,
            injectionPoints: d.injectionPoints,
            injectionNote: d.injectionNote || undefined,
          }),
        });
      })
    );
    setSaving(false);
    router.push(projectId ? `/projects/${projectId}` : "/");
  }

  if (!projectId) {
    return <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Missing projectId — open this wizard from a project's "Update Sprint" link.</div>;
  }

  if (!loaded) return <div className="text-sm">Loading...</div>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Sprint Capacity — {sprintName}</h1>
      <div className="flex gap-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {(["roster", "absences", "injection", "confirm"] as Step[]).map((s) => (
          <span key={s} style={s === step ? { color: "var(--color-primary)", fontWeight: 600 } : undefined}>
            {s}
          </span>
        ))}
      </div>

      {step === "roster" && (
        <Card>
          <div className="mb-2 text-sm font-medium">Step 1 — Review Team</div>
          <div className="flex flex-col gap-1 text-sm">
            {engineers.map((e) => (
              <div key={e._id} className="flex justify-between">
                <span>{e.name}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>{e.baseVelocity} pts</span>
              </div>
            ))}
            {engineers.length === 0 && <div style={{ color: "var(--color-text-secondary)" }}>No engineers assigned.</div>}
          </div>
        </Card>
      )}

      {step === "absences" && (
        <Card>
          <div className="mb-2 text-sm font-medium">Step 2 — Absences</div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <th className="text-left">Engineer</th>
                <th className="text-right">PTO Days</th>
                <th className="text-right">Sick Days</th>
              </tr>
            </thead>
            <tbody>
              {engineers.map((e) => (
                <tr key={e._id}>
                  <td className="py-1">{e.name}</td>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={drafts[e._id]?.ptoDays ?? 0}
                      onChange={(ev) => updateDraft(e._id, { ptoDays: Number(ev.target.value) })}
                      className="w-16 rounded px-1 text-right"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={drafts[e._id]?.sickDays ?? 0}
                      onChange={(ev) => updateDraft(e._id, { sickDays: Number(ev.target.value) })}
                      className="w-16 rounded px-1 text-right"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {step === "injection" && (
        <Card>
          <div className="mb-2 text-sm font-medium">Step 3 — Injection</div>
          <p className="mb-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Did any engineers get pulled to work outside this project this sprint?
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <th className="text-left">Engineer</th>
                <th className="text-right">Injection pts</th>
                <th className="text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {engineers.map((e) => (
                <tr key={e._id}>
                  <td className="py-1">{e.name}</td>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      value={drafts[e._id]?.injectionPoints ?? 0}
                      onChange={(ev) => updateDraft(e._id, { injectionPoints: Number(ev.target.value) })}
                      className="w-16 rounded px-1 text-right"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="text"
                      placeholder="e.g. prod hotfix"
                      value={drafts[e._id]?.injectionNote ?? ""}
                      onChange={(ev) => updateDraft(e._id, { injectionNote: ev.target.value })}
                      className="w-full rounded px-2"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {step === "confirm" && (
        <Card>
          <div className="mb-2 text-sm font-medium">Confirm</div>
          <div className="text-sm">
            Team velocity for this sprint: <strong>{Math.round(teamVelocity * 10) / 10} pts</strong>
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="secondary"
          disabled={step === "roster"}
          onClick={() => setStep((s) => (s === "absences" ? "roster" : s === "injection" ? "absences" : "injection"))}
        >
          Back
        </Button>
        {step === "confirm" ? (
          <Button onClick={saveAndClose} disabled={saving}>
            {saving ? "Saving..." : "Save & Close"}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => (s === "roster" ? "absences" : s === "absences" ? "injection" : "confirm"))}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
