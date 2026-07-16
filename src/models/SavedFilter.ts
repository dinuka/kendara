import mongoose, { Schema, Model, Document } from "mongoose";

export interface ISavedFilter extends Document {
  id: string;
  user: { id: string };
  query: string;
  filterConfig: Record<string, boolean>;
  createdAt: Date;
}

const SavedFilterSchema = new Schema<ISavedFilter>({
  user: {
    id: { type: String, required: true },
  },
  query: { type: String, required: true },
  filterConfig: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const SavedFilter: Model<ISavedFilter> = mongoose.models.SavedFilter || mongoose.model<ISavedFilter>("SavedFilter", SavedFilterSchema);
