"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FeatureDraft {
  _id: string;
  title: string;
  storyCount: number;
}

interface EpicBlock {
  _id: string;
  title: string;
  avgStoryPoints: number;
  features: FeatureDraft[];
}

export default function ScopeEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [avgStoryPoints, setAvgStoryPoints] = useState(5);
  const [epics, setEpics] = useState<EpicBlock[]>([]);
  const [newEpicTitle, setNewEpicTitle] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/projects/${params.id}`);
      const body = await res.json();
      setAvgStoryPoints(body.data?.avgStoryPoints ?? 5);
    })();
  }, [params.id]);

  async function addEpic() {
    if (!newEpicTitle.trim()) return;
    const res = await fetch("/api/manual/epics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: params.id, title: newEpicTitle }),
    });
    const body = await res.json();
    setEpics((prev) => [...prev, { _id: body.data._id, title: body.data.title, avgStoryPoints, features: [] }]);
    setNewEpicTitle("");
  }

  async function addFeature(epicId: string) {
    const res = await fetch("/api/manual/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epicId, title: "New feature", storyCount: 0 }),
    });
    const body = await res.json();
    setEpics((prev) =>
      prev.map((e) =>
        e._id === epicId
          ? { ...e, features: [...e.features, { _id: body.data._id, title: body.data.title, storyCount: 0 }] }
          : e
      )
    );
  }

  function updateFeatureLocal(epicId: string, featureId: string, patch: Partial<FeatureDraft>) {
    setEpics((prev) =>
      prev.map((e) =>
        e._id !== epicId
          ? e
          : { ...e, features: e.features.map((f) => (f._id === featureId ? { ...f, ...patch } : f)) }
      )
    );
  }

  async function saveFeature(featureId: string, patch: { title?: string; storyCount?: number }) {
    await fetch(`/api/manual/features/${featureId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Scope Entry</h1>
        <Button onClick={() => router.push(`/projects/${params.id}`)}>Done</Button>
      </div>

      {epics.map((epic) => (
        <Card key={epic._id}>
          <div className="mb-2 font-medium">Epic: {epic.title}</div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-text-secondary)" }}>
                <th className="text-left">Feature Name</th>
                <th className="text-right">Stories</th>
                <th className="text-right">Pts (auto)</th>
              </tr>
            </thead>
            <tbody>
              {epic.features.map((f) => (
                <tr key={f._id}>
                  <td className="py-1">
                    <input
                      value={f.title}
                      onChange={(e) => updateFeatureLocal(epic._id, f._id, { title: e.target.value })}
                      onBlur={(e) => saveFeature(f._id, { title: e.target.value })}
                      className="w-full rounded px-2 py-1"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      value={f.storyCount}
                      onChange={(e) => updateFeatureLocal(epic._id, f._id, { storyCount: Number(e.target.value) })}
                      onBlur={(e) => saveFeature(f._id, { storyCount: Number(e.target.value) })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || (e.key === "Tab" && f === epic.features[epic.features.length - 1])) {
                          if (e.key === "Enter") addFeature(epic._id);
                        }
                      }}
                      className="w-20 rounded px-2 py-1 text-right"
                      style={{ border: "1px solid var(--color-border)" }}
                    />
                  </td>
                  <td className="py-1 text-right" style={{ color: "var(--color-text-secondary)" }}>
                    {f.storyCount * epic.avgStoryPoints}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-1">
                  <button
                    onClick={() => addFeature(epic._id)}
                    className="text-xs"
                    style={{ color: "var(--color-primary)" }}
                  >
                    + Add feature — press Tab
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      ))}

      <Card>
        <div className="flex gap-2">
          <input
            value={newEpicTitle}
            onChange={(e) => setNewEpicTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEpic()}
            placeholder="New epic name"
            className="flex-1 rounded px-2 py-1.5 text-sm"
            style={{ border: "1px solid var(--color-border)" }}
          />
          <Button onClick={addEpic}>+ Add Epic</Button>
        </div>
      </Card>
    </div>
  );
}
