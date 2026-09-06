import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { Horoscope } from "@/models/Horoscope";
import { HoroscopeNote } from "@/models/HoroscopeNote";
import type { NotepadState, ObservationTag, ResultNote } from "@/models/HoroscopeNote";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import {
    NOTEPAD_MAX_HEIGHT,
    NOTEPAD_MAX_WIDTH,
    NOTEPAD_MIN_HEIGHT,
    NOTEPAD_MIN_WIDTH,
    NOTEPAD_NOTES_MAX,
    NOTEPAD_NOTE_TEXT_MAX,
    NOTEPAD_TAGS_MAX,
    NOTEPAD_TAG_TEXT_MAX,
    PLANET_FACTOR_OVERRIDES_MAX_PLANETS,
    PLANET_STRENGTH_FACTORS,
    isObservationColor,
    isPlanetFactorColor,
    isPlanetStrengthFactorKey,
    isValidParentTag,
    isValidSubTag,
    isValidTagColor,
} from "@/lib/notepadCatalogs";

/** The caller's own note document is always the write/read target; the horoscope itself only gates
 *  viewability (owner / public / super-admin — the detail-page check). Cross-student access is
 *  impossible by construction: the query is keyed on `session.user.id`. */

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

/** Strict per-group validators — mirrors the model + data-model shapes. Any unknown field, wrong
 *  type, or out-of-range value rejects the whole group (no partial save). */

function parseNotepadState(value: unknown): NotepadState | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const position = raw.position as Record<string, unknown> | null | undefined;
    const size = raw.size as Record<string, unknown> | null | undefined;
    if (
        position === null ||
        position === undefined ||
        typeof position !== "object" ||
        Array.isArray(position) ||
        size === null ||
        size === undefined ||
        typeof size !== "object" ||
        Array.isArray(size)
    ) {
        return null;
    }
    const { x, y } = position as { x?: unknown; y?: unknown };
    const { width, height } = size as { width?: unknown; height?: unknown };
    if (!isInteger(x) || !isInteger(y) || !isInteger(width) || !isInteger(height)) return null;
    if (width < NOTEPAD_MIN_WIDTH || width > NOTEPAD_MAX_WIDTH) return null;
    if (height < NOTEPAD_MIN_HEIGHT || height > NOTEPAD_MAX_HEIGHT) return null;

    const parsed: NotepadState = {
        position: { x, y },
        size: { width, height },
    };
    if (raw.isOpen !== undefined) {
        if (typeof raw.isOpen !== "boolean") return null;
        parsed.isOpen = raw.isOpen;
    }
    if (raw.selectedParentTag !== undefined) {
        if (!isValidParentTag(raw.selectedParentTag)) return null;
        parsed.selectedParentTag = raw.selectedParentTag;
    }
    if (raw.selectedSubTag !== undefined) {
        if (raw.selectedSubTag !== null && typeof raw.selectedSubTag !== "string") return null;
        // A sub-tag only makes sense under an explicit parent (QA IT-SN-215).
        if (parsed.selectedParentTag === undefined) return null;
        if (!isValidSubTag(parsed.selectedParentTag, raw.selectedSubTag)) return null;
        parsed.selectedSubTag = raw.selectedSubTag;
    }
    return parsed;
}

function parseObservationTags(value: unknown): ObservationTag[] | null {
    if (!Array.isArray(value) || value.length > NOTEPAD_TAGS_MAX) return null;
    const parsed: ObservationTag[] = [];
    for (const entry of value) {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return null;
        const raw = entry as Record<string, unknown>;
        if (!isNonEmptyString(raw.id)) return null;
        if (!isValidParentTag(raw.parentTag)) return null;
        if (raw.subTag !== null && raw.subTag !== undefined && typeof raw.subTag !== "string") return null;
        if (!isValidSubTag(raw.parentTag, raw.subTag)) return null;
        if (!isNonEmptyString(raw.text) || (raw.text as string).length > NOTEPAD_TAG_TEXT_MAX) return null;
        if (!isValidTagColor(raw.color)) return null;
        if (!isNonEmptyString(raw.createdAt) || !isNonEmptyString(raw.updatedAt)) return null;
        parsed.push({
            id: raw.id as string,
            parentTag: raw.parentTag as number,
            subTag: (raw.subTag ?? null) as string | null,
            text: raw.text as string,
            color: raw.color as number,
            createdAt: raw.createdAt as string,
            updatedAt: raw.updatedAt as string,
        });
    }
    return parsed;
}

function parseResultNotes(value: unknown): ResultNote[] | null {
    if (!Array.isArray(value) || value.length > NOTEPAD_NOTES_MAX) return null;
    const parsed: ResultNote[] = [];
    for (const entry of value) {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return null;
        const raw = entry as Record<string, unknown>;
        if (!isNonEmptyString(raw.id)) return null;
        if (!isNonEmptyString(raw.text) || (raw.text as string).length > NOTEPAD_NOTE_TEXT_MAX) return null;
        if (!isNonEmptyString(raw.createdAt) || !isNonEmptyString(raw.updatedAt)) return null;
        parsed.push({
            id: raw.id as string,
            text: raw.text as string,
            createdAt: raw.createdAt as string,
            updatedAt: raw.updatedAt as string,
        });
    }
    return parsed;
}

/** Max stored color-override entries per note (one per system tag — far above what any section
 *  ever renders). */
const OBSERVATION_OVERRIDES_MAX = 500;

/** Max not-relevant tag ids per note, and the max length of one id (an `observationTagId(...)`
 *  encodes ~15 short fields, never near this). */
const IRRELEVANT_TAG_IDS_MAX = 200;
const IRRELEVANT_TAG_ID_MAX_LENGTH = 300;

/** `{ "<observationTagId>": "<ObservationColor>" }` — every key/value strictly validated, any
 *  invalid entry rejects the whole map (no partial save). */
function parseObservationTagOverrides(value: unknown): Record<string, string> | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (keys.length > OBSERVATION_OVERRIDES_MAX) return null;
    const parsed: Record<string, string> = {};
    for (const key of keys) {
        if (!isObservationColor(raw[key])) return null;
        parsed[key] = raw[key];
    }
    return parsed;
}

/** `["<observationTagId>", ...]` — every entry a trimmed non-empty string; duplicates collapse. */
function parseIrrelevantTagIds(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length > IRRELEVANT_TAG_IDS_MAX) return null;
    const parsed: string[] = [];
    for (const entry of value) {
        if (!isNonEmptyString(entry)) return null;
        const trimmed = (entry as string).trim();
        if (trimmed.length === 0 || trimmed.length > IRRELEVANT_TAG_ID_MAX_LENGTH) return null;
        if (!parsed.includes(trimmed)) parsed.push(trimmed);
    }
    return parsed;
}

/** `{ "1": { sign: "green" }, ... }` — keyed by numeric Planet enum string, then factor key, the
 *  value one of the three classifications (green/red/white). Every planet key and factor key/value
 *  strictly validated; any invalid entry rejects the whole map (no partial save). Mirrors the
 *  `observationTagOverrides` pattern but stays catalogue-validated (the route never imports the
 *  planetStrength derivation — IT-SN-224 spirit). */
function parsePlanetFactorOverrides(value: unknown): Record<string, Record<string, string>> | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const planets = Object.keys(raw);
    if (planets.length > PLANET_FACTOR_OVERRIDES_MAX_PLANETS) return null;
    const parsed: Record<string, Record<string, string>> = {};
    for (const planet of planets) {
        if (!isInteger(Number(planet)) || Number(planet) < 1 || Number(planet) > 9) return null;
        const factors = raw[planet];
        if (factors === null || typeof factors !== "object" || Array.isArray(factors)) return null;
        const factorKeys = Object.keys(factors as Record<string, unknown>);
        if (factorKeys.length > PLANET_STRENGTH_FACTORS.length) return null;
        const perPlanet: Record<string, string> = {};
        for (const key of factorKeys) {
            if (!isPlanetStrengthFactorKey(key)) return null;
            const color = (factors as Record<string, unknown>)[key];
            if (!isPlanetFactorColor(color)) return null;
            perPlanet[key] = color;
        }
        parsed[planet] = perPlanet;
    }
    return parsed;
}

interface ParsedNoteBody {
    notepadState?: NotepadState;
    observationTags?: ObservationTag[];
    resultNotes?: ResultNote[];
    observationTagOverrides?: Record<string, string>;
    irrelevantTagIds?: string[];
    planetFactorOverrides?: Record<string, Record<string, string>>;
}

/** `{ notepadState?, observationTags?, resultNotes?, observationTagOverrides?, irrelevantTagIds?,
 *  planetFactorOverrides? }` — at least one group required; unknown top-level fields are ignored
 *  (IT-SN-229). Returns null (400, no write) on any invalid group. */
function parseNoteBody(body: unknown): ParsedNoteBody | null {
    if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
    const raw = body as Record<string, unknown>;
    const hasState = raw.notepadState !== undefined;
    const hasTags = raw.observationTags !== undefined;
    const hasNotes = raw.resultNotes !== undefined;
    const hasOverrides = raw.observationTagOverrides !== undefined;
    const hasIrrelevant = raw.irrelevantTagIds !== undefined;
    const hasPlanetFactors = raw.planetFactorOverrides !== undefined;
    if (!hasState && !hasTags && !hasNotes && !hasOverrides && !hasIrrelevant && !hasPlanetFactors) return null;

    const parsed: ParsedNoteBody = {};
    if (hasState) {
        const notepadState = parseNotepadState(raw.notepadState);
        if (!notepadState) return null;
        parsed.notepadState = notepadState;
    }
    if (hasTags) {
        const observationTags = parseObservationTags(raw.observationTags);
        if (!observationTags) return null;
        parsed.observationTags = observationTags;
    }
    if (hasNotes) {
        const resultNotes = parseResultNotes(raw.resultNotes);
        if (!resultNotes) return null;
        parsed.resultNotes = resultNotes;
    }
    if (hasOverrides) {
        const observationTagOverrides = parseObservationTagOverrides(raw.observationTagOverrides);
        if (!observationTagOverrides) return null;
        parsed.observationTagOverrides = observationTagOverrides;
    }
    if (hasIrrelevant) {
        const irrelevantTagIds = parseIrrelevantTagIds(raw.irrelevantTagIds);
        if (!irrelevantTagIds) return null;
        parsed.irrelevantTagIds = irrelevantTagIds;
    }
    if (hasPlanetFactors) {
        const planetFactorOverrides = parsePlanetFactorOverrides(raw.planetFactorOverrides);
        if (!planetFactorOverrides) return null;
        parsed.planetFactorOverrides = planetFactorOverrides;
    }
    return parsed;
}

/** Detail-page viewability check: the horoscope must be the caller's, public, or the caller a
 *  super-admin. Returns an error response (with the note's privacy posture: 404, never 403) or null
 *  when the caller may read/write their own note for this horoscope. */
async function viewableHoroscopeOrError(sessionUserId: string, userRole: string | undefined, id: string) {
    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (horoscope.owner.id !== sessionUserId && !horoscope.isPublic && userRole !== "super-admin") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const notViewable = await viewableHoroscopeOrError(session.user.id, session.user.role, id);
    if (notViewable) return notViewable;

    const note = await HoroscopeNote.findOne({ "user.id": session.user.id, "horoscope.id": id }).lean();
    if (!note) {
        logger.debug("notepad GET: no note for user=%s horoscope=%s", session.user.id, id);
        // Lazy creation: GET never writes — the first PUT upserts (IT-SN-206).
        return NextResponse.json({
            notepadState: null,
            observationTags: [],
            resultNotes: [],
            observationTagOverrides: {},
            irrelevantTagIds: [],
            planetFactorOverrides: {},
        });
    }

    return NextResponse.json({
        notepadState: note.notepadState ?? null,
        observationTags: note.observationTags ?? [],
        resultNotes: note.resultNotes ?? [],
        observationTagOverrides: note.observationTagOverrides ?? {},
        irrelevantTagIds: note.irrelevantTagIds ?? [],
        planetFactorOverrides: note.planetFactorOverrides ?? {},
    });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const notViewable = await viewableHoroscopeOrError(session.user.id, session.user.role, id);
    if (notViewable) return notViewable;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        logger.warn("notepad PUT: malformed JSON body user=%s horoscope=%s", session.user.id, id);
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseNoteBody(body);
    if (!parsed) {
        logger.warn("notepad PUT: invalid body user=%s horoscope=%s", session.user.id, id);
        return NextResponse.json({ error: "Invalid note body" }, { status: 400 });
    }

    // Per-field-group $set: only the provided groups are written, untouched groups survive
    // (IT-SN-222); notepadState uses dotted paths so a partial state update never drops a field
    // the client did not send. Last-write-wins on concurrent PUTs (IT-SN-223/228).
    const set: Record<string, unknown> = {};
    if (parsed.notepadState) {
        const { position, size, isOpen, selectedParentTag, selectedSubTag } = parsed.notepadState;
        set["notepadState.position"] = position;
        set["notepadState.size"] = size;
        if (isOpen !== undefined) set["notepadState.isOpen"] = isOpen;
        if (selectedParentTag !== undefined) set["notepadState.selectedParentTag"] = selectedParentTag;
        if (selectedSubTag !== undefined) set["notepadState.selectedSubTag"] = selectedSubTag;
    }
    if (parsed.observationTags) set.observationTags = parsed.observationTags;
    if (parsed.resultNotes) set.resultNotes = parsed.resultNotes;
    if (parsed.observationTagOverrides) set.observationTagOverrides = parsed.observationTagOverrides;
    if (parsed.irrelevantTagIds) set.irrelevantTagIds = parsed.irrelevantTagIds;
    if (parsed.planetFactorOverrides) set.planetFactorOverrides = parsed.planetFactorOverrides;

    const note = await HoroscopeNote.findOneAndUpdate(
        { "user.id": session.user.id, "horoscope.id": id },
        { $set: set },
        { upsert: true, new: true },
    ).lean();

    logger.debug("notepad PUT saved user=%s horoscope=%s id=%s", session.user.id, id, note._id.toString());

    return NextResponse.json({
        id: note.id,
        user: note.user,
        horoscope: note.horoscope,
        notepadState: note.notepadState ?? null,
        observationTags: note.observationTags ?? [],
        resultNotes: note.resultNotes ?? [],
        observationTagOverrides: note.observationTagOverrides ?? {},
        irrelevantTagIds: note.irrelevantTagIds ?? [],
        planetFactorOverrides: note.planetFactorOverrides ?? {},
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
    });
}
