"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PlanProjectPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [proposedStartDate, setProposedStartDate] = useState("");
  const [proposedEndDate, setProposedEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type: "project",
        lifecycleStatus: "planned",
        proposedStartDate: proposedStartDate || undefined,
        proposedEndDate: proposedEndDate || undefined,
      }),
    });
    setSubmitting(false);
    setOpen(false);
    setName("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Plan Project
      </Button>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-2">
        <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex gap-2">
          <Input type="date" value={proposedStartDate} onChange={(e) => setProposedStartDate(e.target.value)} />
          <Input type="date" value={proposedEndDate} onChange={(e) => setProposedEndDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!name || submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
