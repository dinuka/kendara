import mongoose, { Document, Model, Schema } from "mongoose";

import type { PlanetAspectsMap } from "@/lib/planetAspects";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";

export interface RecalcStatus {
    status: "idle" | "running" | "completed" | "failed";
    /** Settings version this run targets. */
    settingsVersion?: number;
    startedAt?: Date;
    finishedAt?: Date;
    /** Id set size (fixed at run start). */
    total?: number;
    processed?: number;
    succeeded?: number;
    failed?: number;
    /** Resume cursor. */
    lastProcessedHoroscopeId?: string;
    /** Set at completion when failed > 0. */
    failedHoroscopeIds?: string[];
    /** Run-level failure message (status "failed"). */
    error?: string;
}

export interface AuditEntry {
    id: string;
    /** Settings version AFTER the change. */
    version: number;
    changedBy: { id: string; name?: string };
    changedAt: Date;
    changes: {
        planetaryOrbs?: { from: unknown; to: unknown };
        planetAspects?: { from: unknown; to: unknown };
        rashiAspects?: { from: unknown; to: unknown };
    };
}

export interface RecalcRunEntry {
    id: string;
    settingsVersion: number;
    triggeredBy: { id: string; name?: string };
    startedAt: Date;
    finishedAt?: Date;
    total: number;
    succeeded: number;
    failed: number;
    /** Present only when failed > 0 (capped at 100 per run). */
    failedHoroscopeIds?: string[];
}

export interface IAstrologySettings extends Document {
    id: string;
    planetaryOrbs: Record<string, number>;
    planetAspects?: PlanetAspectsMap;
    rashiAspects?: RashiAspectsSetting;
    recalcStatus?: RecalcStatus;
    auditLog?: AuditEntry[];
    recalcHistory?: RecalcRunEntry[];
    version: number;
    updatedBy?: { id: string; name?: string };
    lastRecalculatedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** Schema variant where `_id` is the fixed `"system"` string singleton key. */
type AstrologySettingsSchemaDoc = Omit<IAstrologySettings, "_id"> & { _id: string };

const AstrologySettingsSchema = new Schema<AstrologySettingsSchemaDoc>(
    {
        // Fixed singleton key (data-model `id: "system"`); versionKey disabled so our own
        // `version` never collides with Mongoose's `__v`.
        _id: { type: String },
        planetaryOrbs: { type: Schema.Types.Mixed },
        // Stored only when a real per-planet override exists (never as an empty {} placeholder).
        planetAspects: { type: Schema.Types.Mixed },
        // Stored as { enabled: true } at seed; the empty overrides map is omitted until set.
        rashiAspects: { type: Schema.Types.Mixed },
        // Absent until a recalculation run starts (never persisted as { status: "idle" }).
        recalcStatus: { type: Schema.Types.Mixed },
        // Created by the first capped $push; never seeded as [].
        auditLog: { type: [Schema.Types.Mixed] },
        recalcHistory: { type: [Schema.Types.Mixed] },
        version: { type: Number, default: 1 },
        // Absent until the first admin update; never null.
        updatedBy: { type: Schema.Types.Mixed },
        // Absent until a recalculation completes.
        lastRecalculatedAt: { type: Date },
    },
    { versionKey: false, timestamps: true },
);

export const AstrologySettings: Model<IAstrologySettings> =
    mongoose.models.AstrologySettings ||
    mongoose.model<AstrologySettingsSchemaDoc>("AstrologySettings", AstrologySettingsSchema);
