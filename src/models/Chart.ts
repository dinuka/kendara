import mongoose, { Schema, Model, Document } from "mongoose";

export interface IChart extends Document {
  id: string;
  horoscope: { id: string };
  type:
    | "birth"
    | "house"
    | "navamsa-d9"
    | "drekkana-d3"
    | "dasamsa-d10"
    | "shodasha-vargas"
    | "chandra-lagna"
    | "surya-lagna";
  data: Record<string, unknown>;
  imageKey: string;
  createdAt: Date;
}

const ChartSchema = new Schema<IChart>({
  horoscope: {
    id: { type: String, required: true },
  },
  type: {
    type: String,
    enum: [
      "birth",
      "house",
      "navamsa-d9",
      "drekkana-d3",
      "dasamsa-d10",
      "shodasha-vargas",
      "chandra-lagna",
      "surya-lagna",
    ],
    required: true,
  },
  data: { type: Schema.Types.Mixed },
  imageKey: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

ChartSchema.index({ "horoscope.id": 1 });

export const Chart: Model<IChart> =
  mongoose.models.Chart || mongoose.model<IChart>("Chart", ChartSchema);
