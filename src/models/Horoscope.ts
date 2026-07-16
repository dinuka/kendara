import mongoose, { Schema, Model, Document } from "mongoose";

export interface IHoroscope extends Document {
  id: string;
  owner: { id: string };
  name: string;
  displayName: boolean;
  birthDate: Date;
  birthTime: string;
  location: string;
  latitude: number;
  longitude: number;
  gender: "male" | "female" | "other";
  ayanamsha: "lahiri" | "raman" | "krishnamurti" | "yukteshwar";
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HoroscopeSchema = new Schema<IHoroscope>(
  {
    owner: {
      id: { type: String, required: true },
    },
    name: { type: String, required: true },
    displayName: { type: Boolean, default: true },
    birthDate: { type: Date, required: true },
    birthTime: { type: String, required: true },
    location: { type: String, default: "" },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    ayanamsha: {
      type: String,
      enum: ["lahiri", "raman", "krishnamurti", "yukteshwar"],
      default: "lahiri",
    },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HoroscopeSchema.index({ "owner.id": 1 });
HoroscopeSchema.index({ isPublic: 1 });
HoroscopeSchema.index({ createdAt: -1 });

export const Horoscope: Model<IHoroscope> = mongoose.models.Horoscope || mongoose.model<IHoroscope>("Horoscope", HoroscopeSchema);
