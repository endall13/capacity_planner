import type { IIntegration } from "@/lib/db/models/Integration";
import type {
  ProviderEpic,
  ProviderFeature,
  ProviderProject,
  ProviderWorkItem,
  SyncResult,
  WorkItemProvider,
} from "@/lib/providers/types";
import { ProviderNotImplementedError } from "@/lib/providers/types";

/**
 * Jira implementation of WorkItemProvider. Deferred — not built yet.
 * Stubbed out so the provider registry and downstream services (sync worker,
 * forecast engine) can wire against the interface before Jira support lands.
 */
export class JiraProvider implements WorkItemProvider {
  constructor(_integration: IIntegration) {}

  async getProjects(): Promise<ProviderProject[]> {
    throw new ProviderNotImplementedError("jira");
  }

  async getEpics(_projectId: string): Promise<ProviderEpic[]> {
    throw new ProviderNotImplementedError("jira");
  }

  async getFeatures(_epicId: string): Promise<ProviderFeature[]> {
    throw new ProviderNotImplementedError("jira");
  }

  async getWorkItems(_featureId: string): Promise<ProviderWorkItem[]> {
    throw new ProviderNotImplementedError("jira");
  }

  async syncAll(_projectId: string): Promise<SyncResult> {
    throw new ProviderNotImplementedError("jira");
  }
}
