import type { IIntegration } from "@/lib/db/models/Integration";
import type { WorkItemProvider } from "@/lib/providers/types";
import { ProviderNotImplementedError } from "@/lib/providers/types";
import { AdoProvider } from "@/lib/providers/ado/ado.provider";
import { JiraProvider } from "@/lib/providers/jira/jira.provider";

/**
 * Single point of entry for resolving a WorkItemProvider from an integration
 * config. Callers (sync worker, forecast service, provider browser routes)
 * depend only on this function and the WorkItemProvider interface — never
 * on a concrete provider class.
 */
export function getProvider(integration: IIntegration): WorkItemProvider {
  switch (integration.provider) {
    case "ado":
      return new AdoProvider(integration);
    case "jira":
      return new JiraProvider(integration);
    default:
      throw new ProviderNotImplementedError(integration.provider);
  }
}
