import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ISearchBookmark extends Document {
    id: string;
    user: { id: string };
    horoscope: { id: string };
    notes?: string;
    queryContext?: string;
    createdAt: Date;
}

const SearchBookmarkSchema = new Schema<ISearchBookmark>({
    id: {
        type: String,
        required: true,
        unique: true,
        default: (): string => uuidv4(),
    },
    user: {
        id: { type: String, required: true },
    },
    horoscope: {
        id: { type: String, required: true },
    },
    notes: { type: String },
    queryContext: { type: String },
    createdAt: { type: Date, default: Date.now },
});

SearchBookmarkSchema.index({ "user.id": 1, createdAt: -1 });
SearchBookmarkSchema.index({ "user.id": 1, "horoscope.id": 1 }, { unique: true });

export const SearchBookmark: Model<ISearchBookmark> =
    mongoose.models.SearchBookmark || mongoose.model<ISearchBookmark>("SearchBookmark", SearchBookmarkSchema);
