import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ISavedFilter extends Document {
    id: string;
    user: { id: string };
    name: string;
    query: string;
    filterConfig: Record<string, unknown>;
    lastRunAt: Date | null;
    resultCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const SavedFilterSchema = new Schema<ISavedFilter>(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            default: (): string => uuidv4(),
        },
        user: {
            id: { type: String, required: true },
        },
        name: { type: String, default: "" },
        query: { type: String, default: "" },
        filterConfig: { type: Schema.Types.Mixed, default: {} },
        lastRunAt: { type: Date, default: null },
        resultCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

SavedFilterSchema.index({ "user.id": 1, lastRunAt: -1 });

export const SavedFilter: Model<ISavedFilter> =
    mongoose.models.SavedFilter || mongoose.model<ISavedFilter>("SavedFilter", SavedFilterSchema);
