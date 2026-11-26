import mongoose, { Document, Model, Schema } from "mongoose";

import type { TablePreferences } from "@/lib/tableColumns";

export interface IUser extends Document {
    id: string;
    /** Set once the user has signed in with Google. At least one provider id is always present. */
    googleId?: string;
    /** Set once the user has signed in with Facebook. */
    facebookId?: string;
    email: string;
    name: string;
    role: "student" | "super-admin";
    preferredLanguage: "si" | "en";
    /** Column layouts of the Houses/Planets tables (Charts + Calculations tabs), applied to every
     *  horoscope. Absent → the defaults. Shape and validation: src/lib/tableColumns.ts. */
    tablePreferences?: TablePreferences;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        googleId: { type: String, required: false, unique: true, sparse: true },
        facebookId: { type: String, required: false, unique: true, sparse: true },
        email: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, enum: ["student", "super-admin"], default: "student" },
        preferredLanguage: { type: String, enum: ["si", "en"], default: "si" },
        tablePreferences: { type: Schema.Types.Mixed, required: false },
    },
    { timestamps: true },
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
