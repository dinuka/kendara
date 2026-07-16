import mongoose, { Document, Model, Schema } from "mongoose";

export interface IShareLink extends Document {
    id: string;
    horoscope: { id: string };
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>({
    horoscope: {
        id: { type: String, required: true },
    },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});

export const ShareLink: Model<IShareLink> =
    mongoose.models.ShareLink || mongoose.model<IShareLink>("ShareLink", ShareLinkSchema);
