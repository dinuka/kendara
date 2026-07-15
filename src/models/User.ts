import mongoose, { Schema, Model, Document } from "mongoose";

export interface IUser extends Document {
  id: string;
  googleId: string;
  email: string;
  name: string;
  role: "student" | "super-admin";
  preferredLanguage: "si" | "en";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["student", "super-admin"], default: "student" },
    preferredLanguage: { type: String, enum: ["si", "en"], default: "si" },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
