import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ProjectType = "project" | "sustaining";
export type ProjectMode = "manual" | "integrated";
export type ProjectLifecycleStatus = "planned" | "active" | "completed";
export type ProjectStatus = "on_track" | "at_risk" | "off_track" | "complete";

export interface IProjectForecast {
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  currentTeamVelocity: number;
  projectedSprintsRemaining: number;
  projectedCompleteSprintName: string; // "" when no sprint schedule exists yet to project against
  projectedCompleteDate: Date;
  lastCalculatedAt: Date;
  // Set once on the first forecast calculation, never overwritten — the
  // reference point for RAG drift and the Roadmap baseline-drift marker.
  baselineCompleteDate?: Date;
}

export interface IProject extends Document {
  organizationId: Types.ObjectId;
  name: string;
  type: ProjectType;
  mode?: ProjectMode;
  integrationId?: Types.ObjectId;
  providerProjectId?: string;
  scopedEpicIds: string[];
  avgStoryPoints?: number;
  startSprintId?: Types.ObjectId;
  lifecycleStatus: ProjectLifecycleStatus;
  proposedStartDate?: Date;
  proposedEndDate?: Date;
  status?: ProjectStatus;
  forecast?: IProjectForecast;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ForecastSchema = new Schema<IProjectForecast>(
  {
    totalPoints: { type: Number, required: true },
    completedPoints: { type: Number, required: true },
    remainingPoints: { type: Number, required: true },
    currentTeamVelocity: { type: Number, required: true },
    projectedSprintsRemaining: { type: Number, required: true },
    projectedCompleteSprintName: { type: String, default: "" },
    projectedCompleteDate: { type: Date, required: true },
    lastCalculatedAt: { type: Date, required: true },
    baselineCompleteDate: { type: Date },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["project", "sustaining"], required: true },
    mode: { type: String, enum: ["manual", "integrated"] },
    integrationId: { type: Schema.Types.ObjectId, ref: "Integration" },
    providerProjectId: { type: String },
    scopedEpicIds: [{ type: String }],
    avgStoryPoints: { type: Number },
    startSprintId: { type: Schema.Types.ObjectId, ref: "Sprint" },
    lifecycleStatus: {
      type: String,
      enum: ["planned", "active", "completed"],
      required: true,
      default: "planned",
    },
    proposedStartDate: { type: Date },
    proposedEndDate: { type: Date },
    status: {
      type: String,
      enum: ["on_track", "at_risk", "off_track", "complete"],
    },
    forecast: { type: ForecastSchema },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ organizationId: 1, status: 1 });
ProjectSchema.index({ organizationId: 1, isActive: 1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);

export default Project;
