import type { TableDevice } from "./tableColumns";

/** What a Dasha row can show besides the planet itself. */
export const DASHA_FIELDS = [
    "levelName",
    "ownNumbers",
    "nakshatraNumbers",
    "conjunctionNumbers",
    "planetTags",
    "dates",
    "age",
    "duration",
] as const;

export type DashaField = (typeof DASHA_FIELDS)[number];

/** Tree levels, top-down. `depth` N shows the first N (1 = Mahadasha only … 5 = down to Prana). */
export const DASHA_LEVELS = ["mahadasha", "antardasha", "vidasa", "sukshama", "prana"] as const;

export interface DashaDisplay {
    fields: Record<DashaField, boolean>;
    depth: number;
}

export type DashaDisplayPreferences = Record<TableDevice, DashaDisplay>;

const allFields = (on: boolean): Record<DashaField, boolean> =>
    Object.fromEntries(DASHA_FIELDS.map((field) => [field, on])) as Record<DashaField, boolean>;

/** Desktop shows everything (the historical rows). Phones start lean: own house numbers, dates
 *  and duration — the rest is a tap away in the Display menu. */
export const DEFAULT_DASHA_DISPLAY: DashaDisplayPreferences = {
    desktop: { fields: allFields(true), depth: DASHA_LEVELS.length },
    mobile: {
        fields: { ...allFields(false), ownNumbers: true, dates: true, duration: true },
        depth: DASHA_LEVELS.length,
    },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

const isDepth = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= DASHA_LEVELS.length;

/** Lenient: unknown/invalid values fall back to the default; never throws. */
export function normalizeDashaDisplay(raw: unknown, fallback: DashaDisplay): DashaDisplay {
    const source = isPlainObject(raw) ? raw : {};
    const fieldsRaw = isPlainObject(source.fields) ? source.fields : {};
    const fields = { ...fallback.fields };
    for (const field of DASHA_FIELDS) {
        if (typeof fieldsRaw[field] === "boolean") fields[field] = fieldsRaw[field];
    }
    return { fields, depth: isDepth(source.depth) ? source.depth : fallback.depth };
}

export function normalizeDashaPreferences(raw: unknown): DashaDisplayPreferences {
    const source = isPlainObject(raw) ? raw : {};
    return {
        desktop: normalizeDashaDisplay(source.desktop, DEFAULT_DASHA_DISPLAY.desktop),
        mobile: normalizeDashaDisplay(source.mobile, DEFAULT_DASHA_DISPLAY.mobile),
    };
}

/** Strict (API input): unknown keys or wrong types reject the payload. Partial objects are fine. */
export function isValidDashaPreferences(raw: unknown): boolean {
    if (!isPlainObject(raw)) return false;
    return Object.entries(raw).every(([device, display]) => {
        if (device !== "desktop" && device !== "mobile") return false;
        if (!isPlainObject(display)) return false;
        for (const key of Object.keys(display)) if (key !== "fields" && key !== "depth") return false;
        if (display.depth !== undefined && !isDepth(display.depth)) return false;
        if (display.fields === undefined) return true;
        if (!isPlainObject(display.fields)) return false;
        return Object.entries(display.fields).every(
            ([field, value]) => DASHA_FIELDS.includes(field as DashaField) && typeof value === "boolean",
        );
    });
}

export function dashaDisplaysEqual(a: DashaDisplay, b: DashaDisplay): boolean {
    return a.depth === b.depth && DASHA_FIELDS.every((field) => a.fields[field] === b.fields[field]);
}
