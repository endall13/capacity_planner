import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SnapshotStatus = "open" | "closed";

export interface IProjectSprintSnapshot extends Document {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  sprintId: Types.ObjectId;
  // Sprint start capture
  remainingPointsAtStart: number;
  totalPointsAtStart: number;
  workItemCountAtStart: number;
  // Sprint end capture
  completedPointsThisSprint?: number;
  remainingPointsAtEnd?: number;
  totalPointsAtEnd?: number;
  workItemCountAtEnd?: number;
  // Computed injection metrics
  injectedPoints?: number;
  injectedWorkItemCount?: number;
  injectionRate?: number;
  // Status
  status: SnapshotStatus;
  snapshotTakenAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSprintSnapshotSchema = new Schema<IProjectSprintSnapshot>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    remainingPointsAtStart: { type: Number, required: true },
    totalPointsAtStart: { type: Number, required: true },
    workItemCountAtStart: { type: Number, required: true },
    completedPointsThisSprint: { type: Number },
    remainingPointsAtEnd: { type: Number },
    totalPointsAtEnd: { type: Number },
    workItemCountAtEnd: { type: Number },
    injectedPoints: { type: Number },
    injectedWorkItemCount: { type: Number },
    injectionRate: { type: Number },
    status: { type: String, enum: ["open", "closed"], required: true, default: "open" },
    snapshotTakenAt: { type: Date, required: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectSprintSnapshotSchema.index(
  { projectId: 1, sprintId: 1 },
  { unique: true }
);
ProjectSprintSnapshotSchema.index({ organizationId: 1, projectId: 1, status: 1 });
ProjectSprintSnapshotSchema.index({ sprintId: 1, status: 1 });

const ProjectSprintSnapshot: Model<IProjectSprintSnapshot> =
  mongoose.models.ProjectSprintSnapshot ||
  mongoose.model<IProjectSprintSnapshot>(
    "ProjectSprintSnapshot",
    ProjectSprintSnapshotSchema
  );

export default ProjectSprintSnapshot;
