import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHoliday {
  date: Date;
  name: string;
}

export interface IOrganizationSettings {
  localAuthEnabled: boolean;
  azureAdTenantId?: string;
  syncIntervalMinutes: number;
  avgStoryPoints: number;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  sprintAnchorDate: Date;
  holidays: IHoliday[];
  settings: IOrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    sprintAnchorDate: { type: Date, required: true },
    holidays: { type: [HolidaySchema], default: [] },
    settings: {
      localAuthEnabled: { type: Boolean, default: true },
      azureAdTenantId: { type: String },
      syncIntervalMinutes: { type: Number, default: 15 },
      avgStoryPoints: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

OrganizationSchema.index({ slug: 1 }, { unique: true });

const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);

export default Organization;
