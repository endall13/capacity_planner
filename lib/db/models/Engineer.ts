import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IVelocityHistoryEntry {
  baseVelocity: number;
  effectiveFromSprintId: Types.ObjectId;
  setAt: Date;
  setByUserId: Types.ObjectId;
}

export interface IProjectHistoryEntry {
  projectId: Types.ObjectId;
  assignedAt: Date;
  releasedAt?: Date;
}

export interface IEngineer extends Document {
  organizationId: Types.ObjectId;
  name: string;
  assignedProjectId: Types.ObjectId | null;
  baseVelocity: number;
  velocityHistory: IVelocityHistoryEntry[];
  projectHistory: IProjectHistoryEntry[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VelocityHistorySchema = new Schema<IVelocityHistoryEntry>(
  {
    baseVelocity: { type: Number, required: true },
    effectiveFromSprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    setAt: { type: Date, required: true },
    setByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const ProjectHistorySchema = new Schema<IProjectHistoryEntry>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    assignedAt: { type: Date, required: true },
    releasedAt: { type: Date },
  },
  { _id: false }
);

const EngineerSchema = new Schema<IEngineer>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    assignedProjectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    baseVelocity: { type: Number, required: true },
    velocityHistory: { type: [VelocityHistorySchema], default: [] },
    projectHistory: { type: [ProjectHistorySchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EngineerSchema.index({ organizationId: 1, assignedProjectId: 1 });
EngineerSchema.index({ organizationId: 1, isActive: 1 });

const Engineer: Model<IEngineer> =
  mongoose.models.Engineer || mongoose.model<IEngineer>("Engineer", EngineerSchema);

export default Engineer;
