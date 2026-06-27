import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SyncTrigger = "scheduled" | "manual";
export type SyncStatus = "running" | "success" | "error";

export interface ISyncSummary {
  epicsProcessed: number;
  featuresProcessed: number;
  workItemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: number;
}

export interface ISyncLog extends Document {
  organizationId: Types.ObjectId;
  integrationId: Types.ObjectId;
  triggeredBy: SyncTrigger;
  triggeredByUserId?: Types.ObjectId;
  providerProjectId: string;
  startedAt: Date;
  completedAt?: Date;
  status: SyncStatus;
  summary: ISyncSummary;
  errorDetails?: string;
}

const SyncSummarySchema = new Schema<ISyncSummary>(
  {
    epicsProcessed: { type: Number, default: 0 },
    featuresProcessed: { type: Number, default: 0 },
    workItemsProcessed: { type: Number, default: 0 },
    itemsCreated: { type: Number, default: 0 },
    itemsUpdated: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
  },
  { _id: false }
);

const SyncLogSchema = new Schema<ISyncLog>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  integrationId: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
  triggeredBy: { type: String, enum: ["scheduled", "manual"], required: true },
  triggeredByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  providerProjectId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date },
  status: {
    type: String,
    enum: ["running", "success", "error"],
    required: true,
    default: "running",
  },
  summary: { type: SyncSummarySchema, required: true },
  errorDetails: { type: String },
});

SyncLogSchema.index({ organizationId: 1, integrationId: 1, startedAt: -1 });
SyncLogSchema.index({ organizationId: 1, status: 1 });

const SyncLog: Model<ISyncLog> =
  mongoose.models.SyncLog || mongoose.model<ISyncLog>("SyncLog", SyncLogSchema);

export default SyncLog;
