import mongoose, { Schema, Model, Document } from "mongoose";

export interface IMetadata extends Document {
  id: string;
  horoscope: { id: string };
  key: string;
  value: string;
  isPublic: boolean;
  createdBy: { id: string };
  createdAt: Date;
  updatedAt: Date;
}

const MetadataSchema = new Schema<IMetadata>(
  {
    horoscope: {
      id: { type: String, required: true },
    },
    key: { type: String, required: true },
    value: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    createdBy: {
      id: { type: String, required: true },
    },
  },
  { timestamps: true }
);

MetadataSchema.index({ "horoscope.id": 1 });
MetadataSchema.index({ key: 1 });

export const Metadata: Model<IMetadata> =
  mongoose.models.Metadata || mongoose.model<IMetadata>("Metadata", MetadataSchema);
