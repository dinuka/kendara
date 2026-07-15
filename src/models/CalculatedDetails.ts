import mongoose, { Schema, Model, Document } from "mongoose";

export interface ICalculatedDetails extends Document {
  id: string;
  horoscope: { id: string };
  ascendant: Record<string, unknown>;
  houses: Record<string, unknown>[];
  planets: Record<string, unknown>[];
  nakshatra: Record<string, unknown>;
  dashas: Record<string, unknown>;
  lord22ndDrekkana: number;
  lord64thNavamsa: number;
  badhakaPlanet: number[];
  marakaPlanets: number[];
  atmakaraka: number;
  yogas: Record<string, unknown>[];
  doshas: Record<string, unknown>;
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
