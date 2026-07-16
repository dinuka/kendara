import mongoose, { Document, Model, Schema } from "mongoose";

import { ChartType } from "@/lib/chartTypes";

export interface IChart extends Document {
    id: string;
    horoscope: { id: string };
    type: ChartType;
    data: Record<string, unknown>;
    imageKey: string;
    svgData: string;
    createdAt: Date;
}

const ChartSchema = new Schema<IChart>({
    horoscope: {
        id: { type: String, required: true },
    },
    type: {
        type: String,
        enum: Object.values(ChartType),
        required: true,
    },
    data: { type: Schema.Types.Mixed },
    imageKey: { type: String, default: "" },
    svgData: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
});

ChartSchema.index({ "horoscope.id": 1 });

export const Chart: Model<IChart> = mongoose.models.Chart || mongoose.model<IChart>("Chart", ChartSchema);
