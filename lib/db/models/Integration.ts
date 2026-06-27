import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type IntegrationProvider = "jira" | "ado";
export type IntegrationStatus = "active" | "error" | "disconnected";
export type LastSyncStatus = "success" | "error" | "never";

export interface IIntegration extends Document {
  organizationId: Types.ObjectId;
  provider: IntegrationProvider;
  displayName: string;
  config: Record<string, unknown>;
  status: IntegrationStatus;
  lastSyncAt?: Date;
  lastSyncStatus: LastSyncStatus;
  lastSyncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    provider: { type: String, enum: ["jira", "ado"], required: true },
    displayName: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["active", "error", "disconnected"],
      default: "disconnected",
    },
    lastSyncAt: { type: Date },
    lastSyncStatus: {
      type: String,
      enum: ["success", "error", "never"],
      default: "never",
    },
    lastSyncError: { type: String },
  },
  { timestamps: true }
);

IntegrationSchema.index({ organizationId: 1, provider: 1 });
IntegrationSchema.index({ organizationId: 1, status: 1 });

const Integration: Model<IIntegration> =
  mongoose.models.Integration ||
  mongoose.model<IIntegration>("Integration", IntegrationSchema);

export default Integration;
