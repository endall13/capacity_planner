import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type EpicSource = "manual" | "jira" | "ado";

export interface IEpic extends Document {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  source: EpicSource;
  integrationId?: Types.ObjectId;
  externalId?: string;
  providerProjectId?: string;
  title: string;
  state: string;
  totalPoints: number;
  completedPoints: number;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EpicSchema = new Schema<IEpic>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    source: { type: String, enum: ["manual", "jira", "ado"], required: true },
    integrationId: { type: Schema.Types.ObjectId, ref: "Integration" },
    externalId: { type: String },
    providerProjectId: { type: String },
    title: { type: String, required: true },
    state: { type: String, required: true, default: "active" },
    totalPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

EpicSchema.index({ organizationId: 1, projectId: 1 });
EpicSchema.index(
  { organizationId: 1, externalId: 1, integrationId: 1 },
  { sparse: true }
);

const Epic: Model<IEpic> =
  mongoose.models.Epic || mongoose.model<IEpic>("Epic", EpicSchema);

export default Epic;
