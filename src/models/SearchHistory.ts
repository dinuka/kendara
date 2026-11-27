import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ISearchHistory extends Document {
    id: string;
    user: { id: string };
    query: string;
    parsedConditions?: object;
    resultCount: number;
    language: "si" | "en";
    source: "manual" | "saved-filter" | "bookmark";
    savedFilter?: { id: string };
    createdAt: Date;
}

const SearchHistorySchema = new Schema<ISearchHistory>({
    id: {
        type: String,
        required: true,
        unique: true,
        default: (): string => uuidv4(),
    },
    user: {
        id: { type: String, required: true },
    },
    query: { type: String, required: true },
    parsedConditions: { type: Schema.Types.Mixed },
    resultCount: { type: Number, required: true, default: 0 },
    language: { type: String, enum: ["si", "en"], required: true },
    source: {
        type: String,
        enum: ["manual", "saved-filter", "bookmark"],
        default: "manual",
    },
    savedFilter: {
        id: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
});

SearchHistorySchema.index({ "user.id": 1, createdAt: -1 });
SearchHistorySchema.index({ "user.id": 1, query: 1, createdAt: -1 });

export const SearchHistory: Model<ISearchHistory> =
    mongoose.models.SearchHistory || mongoose.model<ISearchHistory>("SearchHistory", SearchHistorySchema);
