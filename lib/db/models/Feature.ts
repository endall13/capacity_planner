import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type FeatureSource = "manual" | "jira" | "ado";
export type FeatureDerivedStatus = "not_started" | "in_progress" | "complete";

export interface IFeature extends Document {
  organizationId: Types.ObjectId;
  epicId: Types.ObjectId;
  projectId: Types.ObjectId;
  source: FeatureSource;
  integrationId?: Types.ObjectId;
  externalId?: string;
  title: string;
  state: string;
  // Manual mode fields
  storyCount?: number;
  completedStoryCount?: number;
  // Points (computed by mode)
  totalPoints: number;
  completedPoints: number;
  derivedStatus: FeatureDerivedStatus;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureSchema = new Schema<IFeature>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    epicId: { type: Schema.Types.ObjectId, ref: "Epic", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    source: { type: String, enum: ["manual", "jira", "ado"], required: true },
    integrationId: { type: Schema.Types.ObjectId, ref: "Integration" },
    externalId: { type: String },
    title: { type: String, required: true },
    state: { type: String, required: true, default: "active" },
    storyCount: { type: Number },
    completedStoryCount: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
    derivedStatus: {
      type: String,
      enum: ["not_started", "in_progress", "complete"],
      default: "not_started",
    },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

FeatureSchema.index({ organizationId: 1, epicId: 1 });
FeatureSchema.index({ organizationId: 1, projectId: 1 });
FeatureSchema.index(
  { organizationId: 1, externalId: 1, integrationId: 1 },
  { sparse: true }
);

const Feature: Model<IFeature> =
  mongoose.models.Feature || mongoose.model<IFeature>("Feature", FeatureSchema);

export default Feature;
