import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISprintCapacityEntry extends Document {
  organizationId: Types.ObjectId;
  sprintId: Types.ObjectId;
  engineerId: Types.ObjectId;
  projectId: Types.ObjectId;
  // Planned absences
  ptoDays: number;
  // Unplanned absences
  sickDays: number;
  // Mid-sprint join/leave
  sprintJoinDate?: Date;
  sprintLeaveDate?: Date;
  // Scenario B injection
  injectionPoints: number;
  injectionNote?: string;
  // Computed fields
  totalDaysOff: number;
  availableDays: number;
  plannedVelocity: number;
  effectiveVelocity: number;
  // Actuals (post-sprint)
  actualVelocity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SprintCapacityEntrySchema = new Schema<ISprintCapacityEntry>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    engineerId: { type: Schema.Types.ObjectId, ref: "Engineer", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    ptoDays: { type: Number, default: 0 },
    sickDays: { type: Number, default: 0 },
    sprintJoinDate: { type: Date },
    sprintLeaveDate: { type: Date },
    injectionPoints: { type: Number, default: 0 },
    injectionNote: { type: String },
    totalDaysOff: { type: Number, required: true, default: 0 },
    availableDays: { type: Number, required: true, default: 0 },
    plannedVelocity: { type: Number, required: true, default: 0 },
    effectiveVelocity: { type: Number, required: true, default: 0 },
    actualVelocity: { type: Number },
  },
  { timestamps: true }
);

SprintCapacityEntrySchema.index(
  { sprintId: 1, engineerId: 1, projectId: 1 },
  { unique: true }
);
SprintCapacityEntrySchema.index({ organizationId: 1, projectId: 1, sprintId: 1 });
SprintCapacityEntrySchema.index({ engineerId: 1, sprintId: 1 });

const SprintCapacityEntry: Model<ISprintCapacityEntry> =
  mongoose.models.SprintCapacityEntry ||
  mongoose.model<ISprintCapacityEntry>("SprintCapacityEntry", SprintCapacityEntrySchema);

export default SprintCapacityEntry;
