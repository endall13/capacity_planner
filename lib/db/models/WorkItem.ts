import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type WorkItemSource = "jira" | "ado";
export type WorkItemType = "story" | "bug" | "spike";
export type PlanningHealth = "healthy" | "at_risk" | "needs_decomposition";

export interface IWorkItem extends Document {
  organizationId: Types.ObjectId;
  integrationId: Types.ObjectId;
  featureId: Types.ObjectId;
  projectId: Types.ObjectId;
  source: WorkItemSource;
  externalId: string;
  providerProjectId: string;
  type: WorkItemType;
  title: string;
  state: string;
  planningHealth: PlanningHealth;
  storyPoints?: number;
  isComplete: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkItemSchema = new Schema<IWorkItem>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    integrationId: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
    featureId: { type: Schema.Types.ObjectId, ref: "Feature", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    source: { type: String, enum: ["jira", "ado"], required: true },
    externalId: { type: String, required: true },
    providerProjectId: { type: String, required: true },
    type: { type: String, enum: ["story", "bug", "spike"], required: true },
    title: { type: String, required: true },
    state: { type: String, required: true },
    planningHealth: {
      type: String,
      enum: ["healthy", "at_risk", "needs_decomposition"],
      required: true,
      default: "healthy",
    },
    storyPoints: { type: Number },
    isComplete: { type: Boolean, required: true, default: false },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

WorkItemSchema.index(
  { organizationId: 1, externalId: 1, integrationId: 1 },
  { unique: true }
);
WorkItemSchema.index({ organizationId: 1, featureId: 1 });
WorkItemSchema.index({ organizationId: 1, projectId: 1 });
WorkItemSchema.index({ integrationId: 1, isComplete: 1 });
WorkItemSchema.index({ organizationId: 1, planningHealth: 1 });

const WorkItem: Model<IWorkItem> =
  mongoose.models.WorkItem || mongoose.model<IWorkItem>("WorkItem", WorkItemSchema);

export default WorkItem;
