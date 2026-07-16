import mongoose, { Schema, Model, Document } from "mongoose";
import type { CalculationResult } from "@/lib/astrology";

export interface ICalculatedDetails extends Document, CalculationResult {
  id: string;
  horoscope: { id: string };
  createdAt: Date;
}

const CalculatedDetailsSchema = new Schema<ICalculatedDetails>({
  horoscope: {
    id: { type: String, required: true, unique: true },
  },
  ascendant: { type: Schema.Types.Mixed },
  houses: [{ type: Schema.Types.Mixed }],
  planets: [{ type: Schema.Types.Mixed }],
  nakshatra: { type: Schema.Types.Mixed },
  dashas: { type: Schema.Types.Mixed },
  lord22ndDrekkana: Number,
  lord64thNavamsa: Number,
  badhakaPlanet: [Number],
  marakaPlanets: [Number],
  atmakaraka: Number,
  yogas: [{ type: Schema.Types.Mixed }],
  doshas: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

export const CalculatedDetails: Model<ICalculatedDetails> =
  mongoose.models.CalculatedDetails ||
  mongoose.model<ICalculatedDetails>("CalculatedDetails", CalculatedDetailsSchema);
