"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function GenerateScheduleButton({ year }: { year: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    await fetch("/api/sprints/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={submitting}>
      {submitting ? "Generating..." : `Generate ${year} Schedule`}
    </Button>
  );
}
