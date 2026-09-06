/** Student Notepad static reference data — no I/O, pure constants. Display strings resolve via
 *  i18n (`notepad.*` message keys); this module holds **stable keys only** so a later catalog
 *  wording change never breaks stored student tags (US-SN-003, US-SN-015).
 *
 *  Source: `docs/student-notes.md` (House Purpose table + planet significations) and
 *  `specs/business-analysis/data-model.md` (House Purpose Catalog, Planet Signification Catalog,
 *  TagColor enum). */

/** One house-purpose parent tag: `parentTag` 0 = Other (no sub-tags), 1-12 = house number.
 *  `sanskritName` is an i18n key suffix → `t("notepad.housePurpose.{parentTag}.sanskrit")`.
 *  `subTags` are stable signification keys → `t("notepad.housePurpose.subTags.{key}")`. */
export interface HousePurposeEntry {
    parentTag: number;
    sanskritName: string;
    subTags: string[];
}

/** The 13 house-purpose parents, ordered 1-12 (house number order) with 0/Other **last** — the
 *  parent strip renders in catalog order (QA UT-SN-001). Use `housePurposeEntryFor(parentTag)`
 *  instead of indexing by `parentTag`. */
export const HOUSE_PURPOSE_CATALOG: readonly HousePurposeEntry[] = [
    {
        parentTag: 1,
        sanskritName: "tanuLagna",
        subTags: ["self", "body", "personality", "identity", "vitality", "appearance", "overallLifeDirection"],
    },
    {
        parentTag: 2,
        sanskritName: "dhana",
        subTags: ["wealth", "accumulatedResources", "family", "speech", "food", "values"],
    },
    {
        parentTag: 3,
        sanskritName: "sahaja",
        subTags: ["courage", "effort", "skills", "communication", "youngerSiblings", "initiative"],
    },
    {
        parentTag: 4,
        sanskritName: "sukha",
        subTags: ["mother", "home", "property", "emotionalHappiness", "education", "vehicles", "innerPeace"],
    },
    {
        parentTag: 5,
        sanskritName: "putra",
        subTags: ["intelligence", "children", "creativity", "learning", "pastLifeMerit", "mantra"],
    },
    {
        parentTag: 6,
        sanskritName: "ari",
        subTags: ["enemies", "disease", "debts", "service", "competition", "obstacles", "litigation"],
    },
    {
        parentTag: 7,
        sanskritName: "kalatra",
        subTags: ["marriage", "spouse", "partnerships", "sexuality", "businessPartnerships", "publicDealings"],
    },
    {
        parentTag: 8,
        sanskritName: "randhra",
        subTags: ["longevity", "transformation", "death", "inheritance", "secrets", "occultKnowledge", "suddenEvents"],
    },
    {
        parentTag: 9,
        sanskritName: "dharma",
        subTags: ["dharma", "fortune", "father", "guru", "higherKnowledge", "pilgrimage", "blessings"],
    },
    {
        parentTag: 10,
        sanskritName: "karma",
        subTags: ["career", "profession", "status", "authority", "achievements", "actionsInTheWorld"],
    },
    {
        parentTag: 11,
        sanskritName: "labha",
        subTags: ["gains", "income", "fulfillmentOfDesires", "elderSiblings", "networks", "largeOrganizations"],
    },
    {
        parentTag: 12,
        sanskritName: "vyaya",
        subTags: ["expenditure", "loss", "foreignPlaces", "isolation", "sleep", "spiritualLiberation", "lettingGo"],
    },
    { parentTag: 0, sanskritName: "other", subTags: [] },
];

/** Find the catalog entry by `parentTag` (0-12). O(n) over 13 entries — fine for both the route's
 *  per-request validation and the client. */
export function housePurposeEntryFor(parentTag: number): HousePurposeEntry | undefined {
    return HOUSE_PURPOSE_CATALOG.find((entry) => entry.parentTag === parentTag);
}

/** One planet-signification entry: numeric Planet enum (1-9) → stable signification keys. */
export interface PlanetSignificationEntry {
    planet: number;
    significations: string[];
}

/** The 9 planets (Sun..Ketu) with their significations. Data-model authoritative (the docs example
 *  swaps Mercury/Jupiter/Venus lines — the data model table wins). */
export const PLANET_SIGNIFICATION_CATALOG: readonly PlanetSignificationEntry[] = [
    { planet: 1, significations: ["self", "soul", "father", "authority", "government", "status"] },
    { planet: 2, significations: ["mind", "mother", "emotions", "happiness", "nourishment"] },
    { planet: 3, significations: ["courage", "strength", "youngerSiblings", "land", "competition"] },
    { planet: 4, significations: ["intelligence", "speech", "communication", "business", "calculation"] },
    { planet: 5, significations: ["wisdom", "guru", "children", "wealth", "dharma", "higherKnowledge"] },
    { planet: 6, significations: ["marriage", "spouse", "love", "relationships", "pleasures", "vehicles"] },
    { planet: 7, significations: ["work", "service", "labor", "suffering", "delays", "longevity"] },
    { planet: 8, significations: ["foreignMatters", "obsession", "unconventionalThings", "materialDesires"] },
    { planet: 9, significations: ["detachment", "spirituality", "moksha", "occultKnowledge", "separation"] },
];

/** The unified tag-color palette (6 colors, white → yellow order) shared by the whole notepad.
 *  System observation tags carry these as string `ObservationColor`s; student tags store them as
 *  the numeric `TagColor` enum 1-6 in the same order (1 white, 2 lightRed, 3 darkRed, 4 lightGreen,
 *  5 darkGreen, 6 yellow). Display names resolve per-locale via
 *  `notepad.observation.classification.*` (system) / `notepad.tagColors.{1..6}` (student).
 *  Rendered tags may also carry the DERIVED colors `"green"`/`"red"` (classifier output, not
 *  selectable); `ObservationColor` is the union of derived + palette, while `isObservationColor`
 *  restricts persisted overrides to the palette only. */
export const OBSERVATION_COLOR_CATALOG = ["white", "lightRed", "darkRed", "lightGreen", "darkGreen", "yellow"] as const;

export type ObservationColor = (typeof OBSERVATION_COLOR_CATALOG)[number] | "green" | "red";

/** Validation helper shared by the API route and the client (the route must not import the
 *  derivation module — IT-SN-224 — so the palette lives here, in notepadCatalogs). Accepts only
 *  the selectable palette colors — derived colors like "green"/"red" are never stored overrides. */
export function isObservationColor(value: unknown): value is ObservationColor {
    return typeof value === "string" && (OBSERVATION_COLOR_CATALOG as readonly string[]).includes(value);
}

/** The TagColor palette (numeric enum 1-6) — the same six colors as OBSERVATION_COLOR_CATALOG, in
 *  the same order. Display names resolve per-locale via `notepad.tagColors.{1..6}`. */
export const TAG_COLOR_CATALOG = [1, 2, 3, 4, 5, 6] as const;

export type TagColor = (typeof TAG_COLOR_CATALOG)[number];

/** Default tag color — White (1) — applied to newly created student tags (QA UT-SN-009). */
export const DEFAULT_TAG_COLOR: TagColor = 1;

/** Proposed geometry bounds + length caps (BA Open Question 12 — provisional). Adjust values here
 *  only; the route and components read the constants, never hardcode bounds. */
export const NOTEPAD_MIN_WIDTH = 320;
export const NOTEPAD_MIN_HEIGHT = 400;
export const NOTEPAD_MAX_WIDTH = 900;
export const NOTEPAD_MAX_HEIGHT = 1200;
export const NOTEPAD_TAG_TEXT_MAX = 500;
export const NOTEPAD_NOTE_TEXT_MAX = 2000;
export const NOTEPAD_TAGS_MAX = 200;
export const NOTEPAD_NOTES_MAX = 100;

/** Reverse lookup: every planet (numeric enum, ascending) whose signification list contains the
 *  sub-tag key — all matches render (US-SN-006). Empty when no planet matches. Frozen so callers
 *  (React keys, render-time identity) can rely on immutability (UT-SN-010). */
export function planetsForSubTag(subTagKey: string): readonly number[] {
    if (typeof subTagKey !== "string" || subTagKey.length === 0) {
        return Object.freeze([]);
    }
    return Object.freeze(
        PLANET_SIGNIFICATION_CATALOG.filter((entry) => entry.significations.includes(subTagKey))
            .map((entry) => entry.planet)
            .sort((a, b) => a - b),
    );
}

/** Validation helper shared by the API route and the client: integer 0-12 (0 = Other). */
export function isValidParentTag(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 12;
}

/** Validation helper: `subTag` is valid when it is null/undefined (no sub-topic — valid for every
 *  parent, incl. parent-level tags and the selection "parent chosen, no sub-tag yet") or when it is
 *  a catalog key of that parent. Non-null keys are never valid for parentTag 0/Other (UT-SN-005:
 *  Other has no sub-tags → `subTag` must be null). */
export function isValidSubTag(parentTag: number, subTag: string | null | undefined): boolean {
    if (!isValidParentTag(parentTag)) return false;
    if (subTag === null || subTag === undefined) return true;
    if (parentTag === 0) return false;
    const entry = housePurposeEntryFor(parentTag);
    if (!entry) return false;
    return entry.subTags.includes(subTag);
}

/** Validation helper: integer 1-6 (the TagColor palette). */
export function isValidTagColor(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

/** The per-planet strength factors (TODO #26 — planet section). Each factor is a stable key; the
 *  sub-tags that explain a planet's strength ratio. Order = display order in the strength panel.
 *
 *  Factor semantics (user-confirmed 2026-08-17): every tag carries MEANING — the "always present"
 *  polarity factors (`sign`/`navamsa`/`house`) are green/red/white by value; the bala and karaka/
 *  varga flag factors are presence tags — `{quality}` in green/red when present and `{quality} netha`
 *  / `not {quality}` in white when absent. Only GREEN factors count toward a planet's strength
 *  ratio (`{ green, green + red }`); white tags are informational and never affect the ratio. */
export const PLANET_STRENGTH_FACTORS = [
    "sign",
    "navamsa",
    "house",
    "dig",
    "kala",
    "cheshta",
    "naisargika",
    "retrograde",
    "combust",
    "atmakaraka",
    "yogakaraka",
    "maranakaraka",
    "maraka",
    "badhaka",
    "wargoththama",
    "pushkara",
    "gandantha",
    "gandamula",
    "ashtamansha",
    "nidhanamsha",
] as const;

export type PlanetStrengthFactorKey = (typeof PLANET_STRENGTH_FACTORS)[number];

/** Validation helper shared by the API route and the client: a known factor key. */
export function isPlanetStrengthFactorKey(value: unknown): value is PlanetStrengthFactorKey {
    return typeof value === "string" && (PLANET_STRENGTH_FACTORS as readonly string[]).includes(value);
}

/** The three classifications a student may set a factor to (toggle cycle green → red → white).
 *  Derived factors are always one of these three — never a palette colour. */
export const PLANET_FACTOR_COLORS = ["green", "red", "white"] as const;

export type PlanetFactorColor = (typeof PLANET_FACTOR_COLORS)[number];

/** Validation helper: a factor override value is exactly one of the three classifications. */
export function isPlanetFactorColor(value: unknown): value is PlanetFactorColor {
    return typeof value === "string" && (PLANET_FACTOR_COLORS as readonly string[]).includes(value);
}

/** Max planet keys (the 9 planets) and per-planet factor keys in a `planetFactorOverrides` map. */
export const PLANET_FACTOR_OVERRIDES_MAX_PLANETS = 9;

/** Every sub-tag key across the house-purpose catalog (for i18n parity + route validation). */
export function allSubTagKeys(): string[] {
    const keys = new Set<string>();
    for (const entry of HOUSE_PURPOSE_CATALOG) {
        for (const key of entry.subTags) keys.add(key);
    }
    return [...keys];
}

// Immutability contract (QA UT-SN-010): catalogs are deep-frozen so accidental mutation (which
// would silently diverge the client from the API validation) fails loudly in strict mode.
function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
        Object.freeze(value);
        for (const key of Object.keys(value) as Array<keyof T>) {
            deepFreeze(value[key]);
        }
    }
    return value;
}

deepFreeze(HOUSE_PURPOSE_CATALOG);
deepFreeze(PLANET_SIGNIFICATION_CATALOG);
Object.freeze(TAG_COLOR_CATALOG);
Object.freeze(OBSERVATION_COLOR_CATALOG);
