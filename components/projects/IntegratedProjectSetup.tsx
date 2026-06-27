"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Integration {
  _id: string;
  displayName: string;
  provider: string;
}

interface ProviderProject {
  id: string;
  name: string;
}

interface ProviderEpic {
  externalId: string;
  title: string;
}

export function IntegratedProjectSetup() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationId, setIntegrationId] = useState("");
  const [providerProjects, setProviderProjects] = useState<ProviderProject[]>([]);
  const [providerProjectId, setProviderProjectId] = useState("");
  const [epics, setEpics] = useState<ProviderEpic[]>([]);
  const [scopedEpicIds, setScopedEpicIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/integrations")
      .then((r) => r.json())
      .then((body) => setIntegrations(body.data ?? []));
  }, []);

  async function browseProjects(id: string) {
    setIntegrationId(id);
    setProviderProjects([]);
    setEpics([]);
    setError(null);
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/providers/projects?integrationId=${id}`);
    const body = await res.json();
    setLoading(false);
    if (body.error) setError(body.error.message);
    else setProviderProjects(body.data ?? []);
  }

  async function browseEpics(pid: string) {
    setProviderProjectId(pid);
    setEpics([]);
    setError(null);
    if (!pid) return;
    setLoading(true);
    const res = await fetch(`/api/providers/epics?integrationId=${integrationId}&providerProjectId=${pid}`);
    const body = await res.json();
    setLoading(false);
    if (body.error) setError(body.error.message);
    else setEpics(body.data ?? []);
  }

  function toggleEpic(id: string) {
    setScopedEpicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type: "project",
        mode: "integrated",
        integrationId,
        providerProjectId,
        scopedEpicIds: [...scopedEpicIds],
        lifecycleStatus: "active",
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (body.data?._id) router.push(`/projects/${body.data._id}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-semibold">New Integrated Project</h1>
      <Card>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Project name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Integration</label>
            <select
              value={integrationId}
              onChange={(e) => browseProjects(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <option value="">Select integration...</option>
              {integrations.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.displayName} ({i.provider})
                </option>
              ))}
            </select>
            {integrations.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                No integrations configured. Add one in Admin → Integrations first.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded px-3 py-2 text-sm" style={{ background: "var(--color-rag-amber-bg)", color: "var(--color-rag-amber-text)" }}>
              {error}
            </div>
          )}

          {integrationId && !error && (
            <div>
              <label className="mb-1 block text-sm font-medium">Provider project</label>
              <select
                value={providerProjectId}
                onChange={(e) => browseEpics(e.target.value)}
                className="w-full rounded px-3 py-2 text-sm"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <option value="">{loading ? "Loading..." : "Select provider project..."}</option>
                {providerProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {epics.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Scope — select epics</label>
              <div className="flex flex-col gap-1">
                {epics.map((e) => (
                  <label key={e.externalId} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={scopedEpicIds.has(e.externalId)} onChange={() => toggleEpic(e.externalId)} />
                    {e.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button onClick={submit} disabled={!name || !integrationId || !providerProjectId || submitting}>
            {submitting ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
