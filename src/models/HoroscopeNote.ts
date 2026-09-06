import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

/** The per-horoscope notepad shell state: popup geometry (position/size) plus the restore-on-reopen
 *  selection. All values are numeric enums / stable catalog keys — never localized text. */
export interface NotepadState {
    position: { x: number; y: number };
    size: { width: number; height: number };
    /** Optional — restore the popup open state on reopen per horoscope (UX interaction). */
    isOpen?: boolean;
    /** 0 = Other, 1-12 = house number. */
    selectedParentTag?: number;
    /** Stable catalog key from HOUSE_PURPOSE_CATALOG; null only for parentTag 0 (Other). */
    selectedSubTag?: string | null;
}

/** One student-entered observation tag. `id` is a client-generated UUID; `color` is the numeric
 *  TagColor enum 1-6 (green/red/white/blue/yellow/purple). */
export interface ObservationTag {
    id: string;
    parentTag: number;
    /** Catalog key; always null for parentTag 0. */
    subTag: string | null;
    text: string;
    color: number;
    createdAt: string;
    updatedAt: string;
}

/** One student-entered result note (notepad-level, newest-first, plain text). */
export interface ResultNote {
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
}

export interface IHoroscopeNote extends Document {
    id: string;
    user: { id: string };
    horoscope: { id: string };
    /** Absent on legacy/empty notepads — the shell applies default geometry. */
    notepadState?: NotepadState;
    observationTags: ObservationTag[];
    resultNotes: ResultNote[];
    /** Per-horoscope color overrides for the derived system observation tags, keyed by
     *  `observationTagId(...)` (stable content-based identity). Absent/empty on legacy notes — the
     *  derived colors apply. */
    observationTagOverrides?: Record<string, string>;
    /** Per-horoscope list of derived system tags the student marked "not relevant" (TODO #26),
     *  keyed by `observationTagId(...)`. Excluded from every section's ratio and rendered struck
     *  through. Absent/empty on legacy notes — nothing is excluded. */
    irrelevantTagIds?: string[];
    /** Per-horoscope student determination of planet-strength factors (TODO #26), keyed by numeric
     *  Planet enum string ("1".."9") then factor key (see `PLANET_STRENGTH_FACTORS`) — the value is
     *  one of the three classifications (green/red/white). Only touched factors are present; the
     *  rest stay derived. Absent/empty on legacy notes — derived factors apply. */
    planetFactorOverrides?: Record<string, Record<string, string>>;
    createdAt: Date;
    updatedAt: Date;
}

const HoroscopeNoteSchema = new Schema<IHoroscopeNote>(
    {
        id: { type: String, required: true, unique: true, default: (): string => uuidv4() },
        user: { id: { type: String, required: true } },
        horoscope: { id: { type: String, required: true } },
        notepadState: { type: Schema.Types.Mixed },
        observationTags: { type: Schema.Types.Mixed, default: [] },
        resultNotes: { type: Schema.Types.Mixed, default: [] },
        observationTagOverrides: { type: Schema.Types.Mixed, default: {} },
        irrelevantTagIds: { type: [String], default: [] },
        planetFactorOverrides: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

HoroscopeNoteSchema.index({ "user.id": 1, "horoscope.id": 1 }, { unique: true });
HoroscopeNoteSchema.index({ "horoscope.id": 1 });

export const HoroscopeNoteModel: Model<IHoroscopeNote> =
    mongoose.models.HoroscopeNote || mongoose.model<IHoroscopeNote>("HoroscopeNote", HoroscopeNoteSchema);

export const HoroscopeNote: Model<IHoroscopeNote> = HoroscopeNoteModel;
