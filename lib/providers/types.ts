import type { IntegrationProvider } from "@/lib/db/models/Integration";
import type { WorkItemType, PlanningHealth } from "@/lib/db/models/WorkItem";

export interface ProviderProject {
  id: string;
  name: string;
}

export interface ProviderEpic {
  externalId: string;
  providerProjectId: string;
  title: string;
  state: string;
}

export interface ProviderFeature {
  externalId: string;
  epicExternalId: string;
  title: string;
  state: string;
}

export interface ProviderWorkItem {
  externalId: string;
  featureExternalId: string;
  providerProjectId: string;
  type: WorkItemType;
  title: string;
  state: string;
  storyPoints?: number;
  isComplete: boolean;
  planningHealth: PlanningHealth;
}

export interface SyncResult {
  epicsProcessed: number;
  featuresProcessed: number;
  workItemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: number;
}

/**
 * Every work item provider (ADO, Jira, future providers) implements this interface.
 * The rest of the system (sync worker, forecast engine, API routes) depends only
 * on this contract — never on a concrete provider implementation.
 */
export interface WorkItemProvider {
  getProjects(): Promise<ProviderProject[]>;
  getEpics(projectId: string): Promise<ProviderEpic[]>;
  getFeatures(epicId: string): Promise<ProviderFeature[]>;
  getWorkItems(featureId: string): Promise<ProviderWorkItem[]>;
  syncAll(projectId: string): Promise<SyncResult>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: IntegrationProvider) {
    super(`Provider "${provider}" is not implemented yet`);
    this.name = "ProviderNotImplementedError";
  }
}
