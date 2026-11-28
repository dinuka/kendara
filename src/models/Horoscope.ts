import mongoose, { Document, Model, Schema } from "mongoose";

import type { HoroscopeSeo } from "@/lib/seo";

export type HoroscopeSource = "auto" | "manual";

export interface IHoroscope extends Document {
    id: string;
    owner: { id: string };
    name: string;
    displayName: boolean;
    /** Present for `auto` horoscopes; omitted for `manual` (calculated-chart) horoscopes. */
    birthDate?: Date;
    birthTime?: string;
    location: { id: string } | null;
    locationName: string;
    latitude: number;
    longitude: number;
    gender: "male" | "female" | "other";
    ayanamsha: "lahiri" | "raman" | "krishnamurti" | "yukteshwar";
    /** `auto` = ephemeris-calculated from birth details (legacy); `manual` = entered calculated chart. */
    source: HoroscopeSource;
    isPublic: boolean;
    /** Search-engine data managed by super admins (title/description override, URL aliases). */
    seo?: HoroscopeSeo;
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
        birthDate: { type: Date },
        birthTime: { type: String },
        location: {
            id: { type: String },
        },
        locationName: { type: String, default: "" },
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
        source: {
            type: String,
            enum: ["auto", "manual"],
            default: "auto",
        },
        isPublic: { type: Boolean, default: false },
        seo: {
            type: new Schema(
                {
                    title: { type: String },
                    description: { type: String },
                    aliases: { type: [String], default: [] },
                    indexed: { type: Boolean, default: true },
                },
                { _id: false },
            ),
            default: undefined,
        },
    },
    { timestamps: true },
);

HoroscopeSchema.index({ "owner.id": 1 });
HoroscopeSchema.index({ isPublic: 1 });
HoroscopeSchema.index({ createdAt: -1 });
// each alias (/horoscopes/<alias>) resolves to exactly one horoscope
HoroscopeSchema.index({ "seo.aliases": 1 }, { unique: true, sparse: true });

export const Horoscope: Model<IHoroscope> =
    mongoose.models.Horoscope || mongoose.model<IHoroscope>("Horoscope", HoroscopeSchema);
