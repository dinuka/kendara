import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ILocation extends Document {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    isPublic: boolean;
    createdBy: { id: string };
    createdAt: Date;
    updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
    {
        id: { type: String, required: true, unique: true, default: (): string => uuidv4() },
        name: { type: String, required: true, trim: true },
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 },
        isPublic: { type: Boolean, required: true, default: false },
        createdBy: {
            id: { type: String, required: true },
        },
    },
    { timestamps: true },
);

LocationSchema.index({ "createdBy.id": 1 });
LocationSchema.index({ isPublic: 1 });
LocationSchema.index({ name: "text" });

export const Location: Model<ILocation> =
    mongoose.models.Location || mongoose.model<ILocation>("Location", LocationSchema);
