import mongoose, { Document, Model, Schema } from "mongoose";

import type { CalculationResult } from "@/lib/astrology";

export interface ICalculatedDetails extends Document, CalculationResult {
    id: string;
    horoscope: { id: string };
    createdAt: Date;
}

const PranaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationHours: { type: Number, required: true },
    startAge: { type: Number, required: true },
});

const SukshamaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationDays: { type: Number, required: true },
    prana: { type: [PranaSchema], default: [] },
    startAge: { type: Number, required: true },
});

const VidasaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationDays: { type: Number, required: true },
    sukshama: { type: [SukshamaSchema], default: [] },
    startAge: { type: Number, required: true },
});

const AntardashaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    vidasa: { type: [VidasaSchema], default: [] },
    startAge: { type: Number, required: true },
});

const MahadashaSchema = new Schema({
    planet: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationYears: { type: Number, required: true },
    remainingYearsAtBirth: { type: Number, required: true },
    antardasha: { type: [AntardashaSchema], default: [] },
    startAge: { type: Number, required: true },
});

const CurrentPeriodSchema = new Schema({
    mahadashaLord: { type: Number, required: true },
    antardashaLord: { type: Number, required: true },
    vidasaLord: { type: Number, default: null },
    sukshamaLord: { type: Number, default: null },
    pranaLord: { type: Number, default: null },
});

const CalculatedDetailsSchema = new Schema<ICalculatedDetails>({
    horoscope: {
        id: { type: String, required: true, unique: true },
    },
    ascendant: { type: Schema.Types.Mixed },
    houses: [{ type: Schema.Types.Mixed }],
    planets: [{ type: Schema.Types.Mixed }],
    nakshatra: { type: Schema.Types.Mixed },
    dashas: {
        mahadasha: { type: [MahadashaSchema], default: [] },
        currentPeriod: { type: CurrentPeriodSchema, required: true },
    },
    lord22ndDrekkana: Number,
    lord64thNavamsa: Number,
    badhakaPlanet: [Number],
    marakaPlanets: [Number],
    nidhanamshaPlanets: [Number],
    ashtamanshaPlanets: [Number],
    isAscendantWargoththama: Boolean,
    wargoththamaPlanets: [Number],
    gandanthaPlanets: [Number],
    gandamulaPlanets: [Number],
    atmakaraka: Number,
    yogas: [{ type: Schema.Types.Mixed }],
    doshas: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
});

export const CalculatedDetails: Model<ICalculatedDetails> =
    mongoose.models.CalculatedDetails ||
    mongoose.model<ICalculatedDetails>("CalculatedDetails", CalculatedDetailsSchema);
