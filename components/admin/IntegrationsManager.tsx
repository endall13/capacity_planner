"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface IntegrationRow {
  _id: string;
  provider: "ado" | "jira";
  displayName: string;
  status: string;
  lastSyncStatus: string;
}

export function IntegrationsManager() {
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [provider, setProvider] = useState<"ado" | "jira">("ado");
  const [displayName, setDisplayName] = useState("");
  const [organizationUrl, setOrganizationUrl] = useState("");
  const [pat, setPat] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/integrations");
    const body = await res.json();
    setIntegrations(body.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addIntegration() {
    setSubmitting(true);
    const config = provider === "ado" ? { organizationUrl, pat, adoProjectIds: [] } : { siteUrl, apiToken, projectKeys: [] };
    await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, displayName, config }),
    });
    setSubmitting(false);
    setDisplayName("");
    setOrganizationUrl("");
    setPat("");
    setSiteUrl("");
    setApiToken("");
    load();
  }

  async function removeIntegration(id: string) {
    await fetch(`/api/admin/integrations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Card>
      <div className="mb-3 text-sm font-medium">Integrations</div>

      {integrations.length === 0 ? (
        <div className="mb-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          No integrations configured.
        </div>
      ) : (
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr style={{ color: "var(--color-text-secondary)" }}>
              <th className="text-left">Name</th>
              <th className="text-left">Provider</th>
              <th className="text-left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {integrations.map((i) => (
              <tr key={i._id}>
                <td className="py-1">{i.displayName}</td>
                <td className="py-1 uppercase">{i.provider}</td>
                <td className="py-1">{i.status}</td>
                <td className="py-1 text-right">
                  <button onClick={() => removeIntegration(i._id)} className="text-xs" style={{ color: "var(--color-rag-red-text)" }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Add Integration
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "ado" | "jira")}
          className="rounded px-3 py-2 text-sm"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <option value="ado">Azure DevOps</option>
          <option value="jira">Jira</option>
        </select>
        <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {provider === "ado" ? (
          <>
            <Input placeholder="Organization URL" value={organizationUrl} onChange={(e) => setOrganizationUrl(e.target.value)} />
            <Input placeholder="Personal Access Token" type="password" value={pat} onChange={(e) => setPat(e.target.value)} />
          </>
        ) : (
          <>
            <Input placeholder="Site URL" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            <Input placeholder="API Token" type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </>
        )}
        <Button onClick={addIntegration} disabled={!displayName || submitting}>
          {submitting ? "Adding..." : "Add Integration"}
        </Button>
      </div>
    </Card>
  );
}
