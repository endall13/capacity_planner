import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type UserRole =
  | "admin"
  | "engineering_manager"
  | "product_manager"
  | "director"
  | "vp";

export type AuthProvider = "azure_ad" | "local";

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  authProvider: AuthProvider;
  azureOid?: string;
  passwordHash?: string;
  managedProjectIds: Types.ObjectId[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "engineering_manager", "product_manager", "director", "vp"],
      required: true,
    },
    authProvider: { type: String, enum: ["azure_ad", "local"], required: true },
    azureOid: { type: String },
    passwordHash: { type: String },
    managedProjectIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
UserSchema.index({ organizationId: 1, azureOid: 1 }, { sparse: true });
UserSchema.index({ organizationId: 1, role: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
