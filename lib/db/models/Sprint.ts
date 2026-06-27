import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { IHoliday } from "./Organization";

export interface ISprint extends Document {
  organizationId: Types.ObjectId;
  name: string;
  year: number;
  quarter: number;
  sprintIndexInQuarter: number;
  startDate: Date;
  endDate: Date;
  totalWorkingDays: number;
  holidays: IHoliday[];
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SprintHolidaySchema = new Schema<IHoliday>(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const SprintSchema = new Schema<ISprint>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    year: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    sprintIndexInQuarter: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalWorkingDays: { type: Number, required: true },
    holidays: { type: [SprintHolidaySchema], default: [] },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SprintSchema.index({ organizationId: 1, name: 1 }, { unique: true });
SprintSchema.index({ organizationId: 1, startDate: 1 });
SprintSchema.index({ organizationId: 1, isCurrent: 1 });

const Sprint: Model<ISprint> =
  mongoose.models.Sprint || mongoose.model<ISprint>("Sprint", SprintSchema);

export default Sprint;
