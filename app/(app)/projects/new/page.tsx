"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IntegratedProjectSetup } from "@/components/projects/IntegratedProjectSetup";

type Mode = "manual" | "integrated" | null;

export default function NewProjectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [avgStoryPoints, setAvgStoryPoints] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function createManualProject() {
    setSubmitting(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "project", mode: "manual", avgStoryPoints, lifecycleStatus: "active" }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (body.data?._id) router.push(`/projects/${body.data._id}/scope`);
  }

  if (!mode) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 text-lg font-semibold">New Project</h1>
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-sm" onClick={() => setMode("manual")}>
            <div className="font-medium">Manual</div>
            <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Define scope directly — epics, features, story counts. No integration required.
            </div>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm" onClick={() => setMode("integrated")}>
            <div className="font-medium">Integrated</div>
            <div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Sync from ADO or Jira.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === "integrated") {
    return <IntegratedProjectSetup />;
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">New Manual Project</h1>
      <Card>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Project name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Avg story points</label>
            <Input
              type="number"
              min={1}
              value={avgStoryPoints}
              onChange={(e) => setAvgStoryPoints(Number(e.target.value))}
            />
          </div>
          <Button onClick={createManualProject} disabled={!name || submitting}>
            {submitting ? "Creating..." : "Create & Continue to Scope"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
