import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
    id: string;
    googleId: string;
    email: string;
    name: string;
    role: "student" | "super-admin";
    preferredLanguage: "si" | "en";
    planetaryOrbs: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}

const DEFAULT_ORBS: Record<string, number> = {
    "1": 15,
    "2": 12,
    "3": 8,
    "4": 7,
    "5": 9,
    "6": 7,
    "7": 9,
    "8": 0,
    "9": 0,
};

const UserSchema = new Schema<IUser>(
    {
        googleId: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, enum: ["student", "super-admin"], default: "student" },
        preferredLanguage: { type: String, enum: ["si", "en"], default: "si" },
        planetaryOrbs: { type: Schema.Types.Mixed, default: { ...DEFAULT_ORBS } },
    },
    { timestamps: true },
);

export { DEFAULT_ORBS };
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
