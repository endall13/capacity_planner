import { describe, it, expect } from "vitest";
import { getProvider } from "./registry";
import { AdoProvider } from "./ado/ado.provider";
import { JiraProvider } from "./jira/jira.provider";
import type { IIntegration } from "@/lib/db/models/Integration";

function fakeIntegration(provider: "ado" | "jira"): IIntegration {
  return { provider } as IIntegration;
}

describe("getProvider registry", () => {
  it("resolves ado integrations to AdoProvider", () => {
    expect(getProvider(fakeIntegration("ado"))).toBeInstanceOf(AdoProvider);
  });

  it("resolves jira integrations to JiraProvider", () => {
    expect(getProvider(fakeIntegration("jira"))).toBeInstanceOf(JiraProvider);
  });

  it("stubbed provider methods reject with ProviderNotImplementedError", async () => {
    const provider = getProvider(fakeIntegration("ado"));
    await expect(provider.getProjects()).rejects.toThrow('Provider "ado" is not implemented yet');
  });
});
