"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, type PillStatus } from "@/components/ui/Pill";

export interface FeatureRow {
  _id: string;
  epicId: string;
  title: string;
  storyCount?: number;
  completedStoryCount?: number;
  totalPoints: number;
  completedPoints: number;
  derivedStatus: PillStatus;
}

export interface EpicRow {
  _id: string;
  title: string;
  totalPoints: number;
  completedPoints: number;
}

export function FeatureList({
  epics,
  features,
  mode,
  canEdit,
}: {
  epics: EpicRow[];
  features: FeatureRow[];
  mode?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(epics.map((e) => e._id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(epicId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  }

  async function saveDone(feature: FeatureRow) {
    const value = Number(draft);
    if (Number.isNaN(value) || value < 0) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    await fetch(`/api/manual/features/${feature._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedStoryCount: value }),
    });
    setSaving(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {epics.map((epic) => {
        const epicFeatures = features.filter((f) => f.epicId === epic._id);
        const isOpen = expanded.has(epic._id);
        const epicProgress = epic.totalPoints > 0 ? Math.round((epic.completedPoints / epic.totalPoints) * 100) : 0;

        return (
          <div key={epic._id}>
            <button
              onClick={() => toggle(epic._id)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm font-medium"
              style={{ background: "var(--color-page-bg)" }}
            >
              <span>
                {isOpen ? "▾" : "▸"} {epic.title}{" "}
                <span style={{ color: "var(--color-text-secondary)" }}>({epicFeatures.length} features)</span>
              </span>
              <span style={{ color: "var(--color-text-secondary)" }}>{epicProgress}%</span>
            </button>

            {isOpen && (
              <div className="ml-4 mt-1 flex flex-col gap-1">
                {epicFeatures.map((f) => (
                  <div key={f._id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm">
                    <span>{f.title}</span>
                    <div className="flex items-center gap-3">
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {mode === "manual" && canEdit && editingId === f._id ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => saveDone(f)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveDone(f);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            disabled={saving}
                            className="w-14 rounded px-1 text-right"
                            style={{ border: "1px solid var(--color-border)" }}
                          />
                        ) : mode === "manual" && canEdit ? (
                          <button
                            onClick={() => {
                              setEditingId(f._id);
                              setDraft(String(f.completedStoryCount ?? 0));
                            }}
                            className="underline-offset-2 hover:underline"
                          >
                            {f.completedStoryCount ?? 0} / {f.storyCount ?? 0} stories
                          </button>
                        ) : (
                          `${f.completedPoints} / ${f.totalPoints} pts`
                        )}
                      </span>
                      <Pill status={f.derivedStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
