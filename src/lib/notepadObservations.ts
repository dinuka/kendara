/** Student Notepad system observations — pure derivation, no ephemeris, no I/O (same contract as
 *  `shadBalaya.ts` / `bhavaSuchika.ts` / `wargaKendara.ts`). Renders the seven observation sections
 *  for a selected (parent, sub-tag) straight from the page-held `CalculatedDetails` payload
 *  (incl. `wargaKendara`), so the same module runs on the client at render time — system
 *  observations are never stored (US-SN-016) and never hit an API route (IT-SN-224).
 *
 *  Structural contract (see `specs/architecture/20260816-1559-student-notes-architecture.md`):
 *  - Every section derives in its own try/catch; a failure degrades that section to a single
 *    neutral `not available` tag and is `console.warn`-logged — the function never throws.
 *  - `calculatedDetails: null` → every section renders its not-available tag.
 *  - Colors come from the pluggable classifier (`classifyPlanetStrength` default): strength sign
 *    over the known `PlanetaryStrength` set — positive green, negative red, Sama/unknown white.
 *    The house-lord section instead uses its own position rule (`classifyHouseLordPosition`):
 *    relative position 6/8/12 red, 1/5/9 dark green, else light green.
 *  - Legacy documents without `wargaKendara` fall back through `resolveWargaKendara` (stored-first,
 *    warn + re-derive on corrupt values); docs without derivable chart data degrade to
 *    not-available for the warga-backed sections while the D1 sections still work.
 *
 *  Deviations from the architecture spec (documented in
 *  `specs/development/20260816-1831-student-notes-implementation.md`):
 *  - Stored planet rows and warga chart rows use `name` (the repo's real field — the architecture's
 *    abstract `planet` is a spec typo); emitted tags keep the `planet` field per the spec contract.
 *  - `nakshatra.moonNakshatra` is stored as an object `{ id, pada, lord }`, not a number — read
 *    `.id` for the nakshatra param and the Moon planet row's `pada` for the pada.
 *  - Load-tag `params` follow the QA test plan (`{ house, count }` / `{ nakshatra, count }`);
 *    the position sign / nakshatra pada ride as top-level tag fields for the label composition.
 *  - Empty sections render their localized empty-state text (UX decision) instead of being omitted. */
import { type ObservationColor, isValidParentTag, planetsForSubTag } from "@/lib/notepadCatalogs";
import type { WargaChartEntry, WargaChartKey, WargaKendara, WargaPlanetRow } from "@/lib/wargaKendara";
import { resolveWargaKendara } from "@/lib/wargaKendara";

/** One rendered tag. `labelKey`/`params` follow the ShadBalaya reason-object convention and are
 *  present on load / not-available tags only; planet/house/lagna/d1LoadInWarga tags carry their
 *  structured numeric-enum fields and the component composes the label from the existing
 *  `astrology.*` display maps. */
export interface ObservationTagBase {
    kind: "planet" | "house" | "lagna" | "load" | "d1LoadInWarga" | "lord" | "lordDetail";
    color: ObservationColor;
    labelKey?: string;
    params?: Record<string, number>;
    planet?: number;
    sign?: number;
    house?: number;
    strength?: number;
    nakshatra?: number;
    pada?: number;
    chart?: WargaChartKey;
    lagnaSign?: number;
    loadCount?: number;
    planets?: number[];
    /** House lord tag: relative position of the lord from the house it rules (own house = 1). */
    position?: number;
    /** House lord detail discriminator (kind "lordDetail"). */
    detail?: HouseLordDetail;
    /** Houses owned by the lord (ownsHouses detail). */
    houses?: number[];
    /** Conjunction / aspect target planet (conjuncts / aspectsMade / aspectsReceived details). */
    target?: number;
    /** Positive/negative flag for boolean details (kalaBala / cheshtaBala / retrograde / combust). */
    flag?: boolean;
    /** Bhava Suchika value for the lord (bhavaSuchika detail). */
    bhavaSuchikaHouse?: number;
}

export type HouseLordDetail =
    | "ownsHouses"
    | "inSign"
    | "inNakshatra"
    | "strength"
    | "retrograde"
    | "combust"
    | "navamsa"
    | "ashtamamsha"
    | "ashtamansha"
    | "kalaBala"
    | "cheshtaBala"
    | "conjuncts"
    | "aspectsMade"
    | "aspectsReceived"
    | "bhavaSuchika"
    | "atmakaraka"
    | "yogakaraka"
    | "maranakaraka"
    | "maraka"
    | "badhaka"
    | "nidhanamsha"
    | "wargoththama"
    | "gandantha"
    | "gandamula"
    | "pushkara"
    | "drekkanaLord"
    | "navamsaLord";

export type ObservationSectionKey =
    | "planetsInHouse"
    | "houseLord"
    | "nakshatraLoad"
    | "subTagPlanet"
    | "chandraLagnaHouse"
    | "suryaLagnaHouse"
    | "wargaKendara";

export interface ObservationSection {
    key: ObservationSectionKey;
    tags: ObservationTagBase[];
    /** `{ green, total }` over the section's subject planets (green = classifier-green among them).
     *  Empty sections report `{ 0, 0 }` and render their empty-state text without a badge;
     *  degraded (not-available) sections report `{ 0, 1 }` and show the `(0/1)` badge. */
    ratio: { green: number; total: number };
}

/** Stable content-based identity for a rendered system tag — the persistence key for a student's
 *  color override (recorded per horoscope in the note doc, see `Notepad.observationTagOverrides`).
 *  Deterministic for unchanged chart data, so the same tag maps to the same key across reloads;
 *  two tags in one section whose display content is identical collapse to one key (semantically
 *  they are the same tag). */
export function observationTagId(sectionKey: ObservationSectionKey, tag: ObservationTagBase): string {
    const parts = [
        sectionKey,
        tag.kind,
        tag.planet ?? "",
        tag.detail ?? "",
        tag.target ?? "",
        tag.house ?? "",
        tag.position ?? "",
        tag.sign ?? "",
        tag.chart ?? "",
        tag.nakshatra ?? "",
        tag.pada ?? "",
        tag.labelKey ?? "",
        tag.bhavaSuchikaHouse ?? "",
        (tag.houses ?? []).join(","),
        tag.flag === true ? "1" : tag.flag === false ? "0" : "",
    ];
    return parts.join(":");
}

export interface NotepadObservation {
    sections: ObservationSection[];
}

export type ClassifyObservation = (o: ObservationTagBase) => ObservationColor;

/** Permissive view of the stored planet rows — legacy/corrupt docs may lack fields, every access
 *  below degrades gracefully. The real `Planet` uses `name` (not the architecture's `planet`). */
export interface PlanetLike {
    name?: number;
    sign?: number;
    house?: number;
    degree?: number;
    absoluteDegree?: number;
    nakshatra?: number;
    pada?: number;
    strength?: number | string | null;
    navamsaSign?: number;
    navamsaStrength?: number | string | null;
    retrograde?: boolean;
    combustion?: boolean;
    aspects?: Array<{ planetName?: number; isBeneficial?: boolean; aspectType?: number }> | null;
}

/** Permissive view of the `CalculatedDetails` payload the page already holds. */
export interface CalculatedDetailsLike {
    ascendant?: { sign?: number; degree?: number; lord?: number } | null;
    houses?: Array<{ houseNumber?: number; sign?: number; aspectingPlanets?: number[] }> | null;
    planets?: PlanetLike[] | null;
    nakshatra?: { moonNakshatra?: { id?: number; pada?: number } | number | null } | null;
    wargaKendara?: unknown;
    manualHousePlacements?: unknown;
    /** Bhava Suchika (භාව සුචික) per planet, keyed by planet enum string ("1".."9"). */
    bhavaSuchika?: Record<string, number> | null;
    /** ShadBala per planet, keyed by planet enum string then bala key (`digBala`, `kalaBala`,
     *  `cheshtaBala`, `naisargikaBala`, ...). Permissive — any key/value degrades gracefully. */
    shadbalaya?: Record<string, Record<string, { value?: boolean }>> | null;
    ashtamanshaPlanets?: number[] | null;
    wargoththamaPlanets?: number[] | null;
    gandanthaPlanets?: number[] | null;
    gandamulaPlanets?: number[] | null;
    pushkaraPlanets?: number[] | null;
    maranakaraka?: number[] | null;
    yogakaraka?: number[] | null;
    atmakaraka?: number | null;
    marakaPlanets?: number[] | null;
    badhakaPlanet?: number[] | null;
    nidhanamshaPlanets?: number[] | null;
    lord22ndDrekkana?: number | null;
    lord64thNavamsa?: number | null;
}

const SECTION_KEYS: ObservationSectionKey[] = [
    "planetsInHouse",
    "houseLord",
    "nakshatraLoad",
    "subTagPlanet",
    "chandraLagnaHouse",
    "suryaLagnaHouse",
    "wargaKendara",
];

/** The known numeric `PlanetaryStrength` enum values (see astrologyEnums.ts). Anything outside this
 *  set (NaN, future enum values, legacy strings) is unknown → neutral white (UT-SN-108). */
const KNOWN_STRENGTHS = new Set<number>([1.25, 1, -1, -1.25, 0.75, 0.5, 0.1, -0.1, 0]);

/** Default classifier: strength sign over the known set — positive green, negative red, Sama (0)
 *  / unknown white. Pluggable per `resolveNotepadObservation` so a confirmed domain rule slots in
 *  without touching the section builders (UT-SN-108). */
export function classifyPlanetStrength(o: ObservationTagBase): ObservationColor {
    const s = o.strength;
    if (typeof s !== "number" || !KNOWN_STRENGTHS.has(s)) return "white";
    return s > 0 ? "green" : s < 0 ? "red" : "white";
}

/** The neutral `not available` tag every degraded section renders (single tag, `(0/1)` badge). */
export const NOT_AVAILABLE_LABEL_KEY = "notepad.observation.notAvailable";

function notAvailableTag(): ObservationTagBase {
    return { kind: "load", color: "white", labelKey: NOT_AVAILABLE_LABEL_KEY };
}

/** Whole-sign sign of `houseNumber` (1-12) from the given lagna sign. */
function wholeSignOf(lagnaSign: number | undefined, houseNumber: number): number | undefined {
    if (typeof lagnaSign !== "number" || !Number.isInteger(lagnaSign) || lagnaSign < 1 || lagnaSign > 12) {
        return undefined;
    }
    return ((lagnaSign - 1 + houseNumber - 1) % 12) + 1;
}

/** Stored planet rows with a numeric `name` — the rows every section can reference. */
function validPlanetRows(planets: PlanetLike[] | null | undefined): PlanetLike[] {
    if (!Array.isArray(planets)) return [];
    return planets.filter((p) => typeof p?.name === "number");
}

/** Planet tags share one shape across `planetsInHouse` / `subTagPlanet` (UT-SN-100/106). */
function planetTag(p: PlanetLike, house: number, classify: ClassifyObservation): ObservationTagBase {
    const tag: ObservationTagBase = {
        kind: "planet",
        color: "white",
        planet: p.name,
        sign: p.sign,
        house,
        ...(typeof p.strength === "number" ? { strength: p.strength } : {}),
        ...(typeof p.nakshatra === "number" ? { nakshatra: p.nakshatra } : {}),
        ...(typeof p.pada === "number" ? { pada: p.pada } : {}),
    };
    return { ...tag, color: classify(tag) };
}

/** The neutral `load` tag shared by house-load sections (D1 + chart houses). `params` follow the
 *  QA contract (`{ house, count }`); the position sign rides as a top-level field. */
function houseLoadTag(parentTag: number, count: number, sign: number | undefined): ObservationTagBase {
    return {
        kind: "load",
        color: "white",
        labelKey: "notepad.observation.houseLoad",
        params: { house: parentTag, count },
        ...(sign !== undefined ? { sign } : {}),
    };
}

/** `{ green, total }` over the subject planets, classified via the shared classifier. */
function ratioOf(
    subjects: Array<Pick<PlanetLike, "strength">>,
    classify: ClassifyObservation,
): ObservationSection["ratio"] {
    let green = 0;
    for (const subject of subjects) {
        if (
            classify({
                kind: "planet",
                color: "white",
                ...(typeof subject.strength === "number" ? { strength: subject.strength } : {}),
            }) === "green"
        ) {
            green += 1;
        }
    }
    return { green, total: subjects.length };
}

/** `{ green, total }` over the section's own tags (1:1 with the ratio subjects), skipping any tag
 *  the student marked not relevant (TODO #26). The ratio still counts the CLASSIFIER color, never a
 *  student color override — exclusion is the only student influence on the ratio. */
function ratioOverTags(
    tags: ObservationTagBase[],
    sectionKey: ObservationSectionKey,
    irrelevant: ReadonlySet<string> | undefined,
    classify: ClassifyObservation,
): ObservationSection["ratio"] {
    let green = 0;
    let total = 0;
    for (const tag of tags) {
        if (irrelevant?.has(observationTagId(sectionKey, tag))) continue;
        total += 1;
        if (classify(tag) === "green") green += 1;
    }
    return { green, total };
}

/** The D1 house-N planet names + their stored details: `wargaKendara.d1` houses are authoritative
 *  (whole-sign placement) when present; legacy/manual docs without warga fall back to the stored
 *  `planets[].house` filter — one source per render, never a mix (UT-SN-101/102/113b). */
function d1HousePlanets(
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    parentTag: number,
): { names: number[]; rows: PlanetLike[] } {
    const stored = validPlanetRows(calculated.planets);
    const wargaNames = warga?.d1?.houses?.[parentTag - 1]?.planets;
    const names =
        wargaNames !== undefined
            ? wargaNames
            : stored.filter((p) => p.house === parentTag).map((p) => p.name as number);
    const rows: PlanetLike[] = [];
    for (const name of names) {
        const row = stored.find((p) => p.name === name);
        if (row) rows.push(row);
    }
    return { names, rows };
}

function sectionPlanetsInHouse(
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    parentTag: number,
    classify: ClassifyObservation,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    const { rows } = d1HousePlanets(calculated, warga, parentTag);
    const tags = rows.map((p) => planetTag(p, parentTag, classify));
    return { key: "planetsInHouse", tags, ratio: ratioOverTags(tags, "planetsInHouse", irrelevant, classify) };
}

/** Sign lords by sign (1-12) — whole-sign Vedic lordship. Local copy (astrology.ts's is private). */
const SIGN_LORD: Record<number, number> = {
    1: 3,
    2: 6,
    3: 4,
    4: 2,
    5: 1,
    6: 4,
    7: 6,
    8: 3,
    9: 5,
    10: 7,
    11: 7,
    12: 5,
};

/** House-lord position colour rule (user-confirmed): relative position 6/8/12 → red, 1/5/9 →
 *  dark green, anything else → light green. */
export function classifyHouseLordPosition(position: number): ObservationColor {
    if (position === 6 || position === 8 || position === 12) return "red";
    if (position === 1 || position === 5 || position === 9) return "darkGreen";
    return "lightGreen";
}

/** The houses (whole-sign from the lagna) whose sign the given planet lords over. */
function ownedHousesOf(lagnaSign: number | undefined, lord: number): number[] {
    const houses: number[] = [];
    if (typeof lagnaSign !== "number") return houses;
    for (let house = 1; house <= 12; house += 1) {
        const sign = wholeSignOf(lagnaSign, house);
        if (sign !== undefined && SIGN_LORD[sign] === lord) houses.push(house);
    }
    return houses;
}

interface LordPlacement {
    house: number | undefined;
    row: PlanetLike | undefined;
}

/** The lord's D1 house + stored row. `wargaKendara.d1` whole-sign houses are authoritative when
 *  present; legacy/manual docs fall back to the stored `planets[].house`. */
function lordPlacement(
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    lord: number,
): LordPlacement {
    const stored = validPlanetRows(calculated.planets);
    const row = stored.find((p) => p.name === lord);
    const d1HouseIndex = warga?.d1?.houses?.findIndex((h) => Array.isArray(h?.planets) && h.planets.includes(lord));
    const house = d1HouseIndex !== undefined && d1HouseIndex >= 0 ? d1HouseIndex + 1 : row?.house;
    return { house, row };
}

interface LordCtx {
    calculated: CalculatedDetailsLike;
    warga?: WargaKendara;
    lord: number;
    row?: PlanetLike;
    lordHouse?: number;
}

const isInList = (list: number[] | null | undefined, planet: number): boolean =>
    Array.isArray(list) && list.includes(planet);

/** The lord's row in the D1 warga chart (whole-sign model — the chart the user sees), when present. */
function wargaLordRow(warga: WargaKendara | undefined, lord: number): WargaPlanetRow | undefined {
    return warga?.d1?.planets.find((row) => row.name === lord);
}

/** Benefic whole-sign aspect angles, mirroring BENEFICIAL_ASPECT_ANGLES (planetAspects.ts). */
const ASPECT_BENEFIC = new Set([60, 120]);

const aspectColorOf = (aspectType: number | undefined): ObservationColor =>
    typeof aspectType === "number" && ASPECT_BENEFIC.has(aspectType) ? "green" : "red";

type LordDetailBuilder = (ctx: LordCtx) => ObservationTagBase[];

const lordDetailOwnsHouses: LordDetailBuilder = ({ calculated, lord }) => {
    const houses = ownedHousesOf(calculated.ascendant?.sign, lord);
    if (houses.length <= 1) return [];
    return [{ kind: "lordDetail", color: "white", detail: "ownsHouses", planet: lord, houses }];
};

const lordDetailInSign: LordDetailBuilder = ({ lord, row }) => {
    if (typeof row?.sign !== "number") return [];
    return [{ kind: "lordDetail", color: "white", detail: "inSign", planet: lord, sign: row.sign }];
};

const lordDetailInNakshatra: LordDetailBuilder = ({ lord, row }) => {
    if (typeof row?.nakshatra !== "number") return [];
    return [
        {
            kind: "lordDetail",
            color: "white",
            detail: "inNakshatra",
            planet: lord,
            nakshatra: row.nakshatra,
            ...(typeof row.pada === "number" ? { pada: row.pada } : {}),
        },
    ];
};

const lordDetailStrength: LordDetailBuilder = ({ lord, row }) => {
    if (typeof row?.strength !== "number") return [];
    const color = classifyPlanetStrength({ kind: "planet", color: "white", strength: row.strength });
    return [{ kind: "lordDetail", color, detail: "strength", planet: lord, strength: row.strength }];
};

const lordDetailRetrograde: LordDetailBuilder = ({ lord, row }) =>
    row?.retrograde ? [{ kind: "lordDetail", color: "white", detail: "retrograde", planet: lord, flag: true }] : [];

const lordDetailCombust: LordDetailBuilder = ({ lord, row }) =>
    row?.combustion ? [{ kind: "lordDetail", color: "white", detail: "combust", planet: lord, flag: true }] : [];

const lordDetailNavamsa: LordDetailBuilder = ({ lord, row }) => {
    if (typeof row?.navamsaSign !== "number") return [];
    return [{ kind: "lordDetail", color: "white", detail: "navamsa", planet: lord, sign: row.navamsaSign }];
};

const lordDetailAshtamamsha: LordDetailBuilder = ({ lord, lordHouse }) =>
    lordHouse === 8 ? [{ kind: "lordDetail", color: "red", detail: "ashtamamsha", planet: lord, house: 8 }] : [];

const lordDetailAshtamansha: LordDetailBuilder = ({ calculated, lord }) =>
    isInList(calculated.ashtamanshaPlanets, lord)
        ? [{ kind: "lordDetail", color: "red", detail: "ashtamansha", planet: lord }]
        : [];

const lordBalaDetail =
    (bala: "kalaBala" | "cheshtaBala"): LordDetailBuilder =>
    ({ calculated, lord }) => {
        const value = calculated.shadbalaya?.[String(lord)]?.[bala]?.value;
        if (typeof value !== "boolean") return [];
        return [{ kind: "lordDetail", color: value ? "green" : "red", detail: bala, planet: lord, flag: value }];
    };

const lordDetailConjuncts: LordDetailBuilder = ({ calculated, warga, lord, row }) => {
    const tags: ObservationTagBase[] = [];
    const wargaRow = wargaLordRow(warga, lord);
    if (wargaRow && Array.isArray(wargaRow.conjunctions)) {
        for (const name of wargaRow.conjunctions) {
            tags.push({ kind: "lordDetail", color: "white", detail: "conjuncts", planet: lord, target: name });
        }
        return tags;
    }
    if (typeof row?.sign !== "number") return [];
    for (const p of validPlanetRows(calculated.planets)) {
        if (p.name === lord || p.sign !== row.sign) continue;
        tags.push({ kind: "lordDetail", color: "white", detail: "conjuncts", planet: lord, target: p.name });
    }
    return tags;
};

const lordDetailAspectsMade: LordDetailBuilder = ({ calculated, warga, lord, row }) => {
    const tags: ObservationTagBase[] = [];
    const wargaRow = wargaLordRow(warga, lord);
    if (wargaRow && Array.isArray(wargaRow.aspects)) {
        for (const aspect of wargaRow.aspects) {
            if (typeof aspect.planetName !== "number") continue;
            tags.push({
                kind: "lordDetail",
                color: aspectColorOf(aspect.aspectType),
                detail: "aspectsMade",
                planet: lord,
                target: aspect.planetName,
            });
        }
        return tags;
    }
    if (!Array.isArray(row?.aspects)) return [];
    for (const aspect of row.aspects) {
        if (typeof aspect.planetName !== "number") continue;
        tags.push({
            kind: "lordDetail",
            color: aspect.isBeneficial ? "green" : "red",
            detail: "aspectsMade",
            planet: lord,
            target: aspect.planetName,
        });
    }
    return tags;
};

const lordDetailAspectsReceived: LordDetailBuilder = ({ calculated, warga, lord }) => {
    const tags: ObservationTagBase[] = [];
    if (warga?.d1) {
        for (const p of warga.d1.planets ?? []) {
            if (p.name === lord) continue;
            const aspect = (p.aspects ?? []).find((a) => a.planetName === lord);
            if (!aspect) continue;
            tags.push({
                kind: "lordDetail",
                color: aspectColorOf(aspect.aspectType),
                detail: "aspectsReceived",
                planet: lord,
                target: p.name,
            });
        }
        return tags;
    }
    for (const p of validPlanetRows(calculated.planets)) {
        if (p.name === lord || !Array.isArray(p.aspects)) continue;
        const aspect = p.aspects.find((a) => a.planetName === lord);
        if (!aspect) continue;
        tags.push({
            kind: "lordDetail",
            color: aspect.isBeneficial ? "green" : "red",
            detail: "aspectsReceived",
            planet: lord,
            target: p.name,
        });
    }
    return tags;
};

const lordDetailBhavaSuchika: LordDetailBuilder = ({ calculated, lord }) => {
    const value = calculated.bhavaSuchika?.[String(lord)];
    if (typeof value !== "number") return [];
    return [{ kind: "lordDetail", color: "white", detail: "bhavaSuchika", planet: lord, bhavaSuchikaHouse: value }];
};

interface LordFlagEntry {
    detail: HouseLordDetail;
    color: ObservationColor;
    list: (calculated: CalculatedDetailsLike) => number[] | null | undefined;
}

const lordFlagEntries: LordFlagEntry[] = [
    {
        detail: "atmakaraka",
        color: "green",
        list: (c) => (typeof c.atmakaraka === "number" ? [c.atmakaraka] : null),
    },
    { detail: "yogakaraka", color: "green", list: (c) => c.yogakaraka },
    { detail: "maranakaraka", color: "red", list: (c) => c.maranakaraka },
    { detail: "maraka", color: "red", list: (c) => c.marakaPlanets },
    { detail: "badhaka", color: "red", list: (c) => c.badhakaPlanet },
    { detail: "nidhanamsha", color: "red", list: (c) => c.nidhanamshaPlanets },
    { detail: "wargoththama", color: "green", list: (c) => c.wargoththamaPlanets },
    { detail: "gandantha", color: "red", list: (c) => c.gandanthaPlanets },
    { detail: "gandamula", color: "red", list: (c) => c.gandamulaPlanets },
    { detail: "pushkara", color: "green", list: (c) => c.pushkaraPlanets },
];

const lordFlagDetail =
    ({ detail, color, list }: LordFlagEntry): LordDetailBuilder =>
    ({ calculated, lord }) =>
        isInList(list(calculated), lord) ? [{ kind: "lordDetail", color, detail, planet: lord }] : [];

const lordDetailDrekkanaLord: LordDetailBuilder = ({ calculated, lord }) =>
    calculated.lord22ndDrekkana === lord
        ? [{ kind: "lordDetail", color: "white", detail: "drekkanaLord", planet: lord }]
        : [];

const lordDetailNavamsaLord: LordDetailBuilder = ({ calculated, lord }) =>
    calculated.lord64thNavamsa === lord
        ? [{ kind: "lordDetail", color: "white", detail: "navamsaLord", planet: lord }]
        : [];

/** Every lord-detail builder, in display order. Each returns zero+ tags and degrades to none. */
const LORD_DETAIL_BUILDERS: LordDetailBuilder[] = [
    lordDetailOwnsHouses,
    lordDetailInSign,
    lordDetailInNakshatra,
    lordDetailStrength,
    lordDetailNavamsa,
    lordDetailRetrograde,
    lordDetailCombust,
    lordDetailConjuncts,
    lordDetailAspectsMade,
    lordDetailAspectsReceived,
    lordDetailAshtamamsha,
    lordDetailAshtamansha,
    lordBalaDetail("kalaBala"),
    lordBalaDetail("cheshtaBala"),
    lordDetailBhavaSuchika,
    ...lordFlagEntries.map(lordFlagDetail),
    lordDetailDrekkanaLord,
    lordDetailNavamsaLord,
];

/** The House Lord & position (භාවාධිපති හා පිහිටීම) section. Every house has a lord (the ruler of
 *  its whole-sign). Primary tag: `{planet} - {relativePosition}` coloured by position (6/8/12 red,
 *  1/5/9 dark green, else light green). Related tags surface every planet-table condition of the
 *  lord (other-house ownership, sign/nakshatra/strength, retrogression, combustion, navamsa,
 *  conjunctions, aspects, kala/cheshta bala, bhava suchika, atmakaraka/yogakaraka/maranakaraka,
 *  maraka/badhaka/nidhanamsha, wargoththama/gandantha/gandamula/pushkara, drekkana/navamsa lordship).
 *  Ratio counts the primary tag only (good = dark/light green). */
function sectionHouseLord(
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    parentTag: number,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    const houseSign = wholeSignOf(calculated.ascendant?.sign, parentTag);
    const lord = houseSign !== undefined ? SIGN_LORD[houseSign] : undefined;
    if (lord === undefined) {
        return { key: "houseLord", tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const { house, row } = lordPlacement(calculated, warga, lord);
    if (house === undefined) {
        return { key: "houseLord", tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const position = ((((house - parentTag) % 12) + 12) % 12) + 1;
    const color = classifyHouseLordPosition(position);
    const primary: ObservationTagBase = { kind: "lord", color, planet: lord, position, house };
    const ctx: LordCtx = { calculated, warga, lord, row, lordHouse: house };
    const tags = [primary, ...LORD_DETAIL_BUILDERS.flatMap((build) => build(ctx))];
    const good = color === "darkGreen" || color === "lightGreen";
    // Ratio counts the primary tag only; excluding it dismisses the section's ratio entirely.
    const ratio = irrelevant?.has(observationTagId("houseLord", primary))
        ? { green: 0, total: 0 }
        : { green: good ? 1 : 0, total: 1 };
    return { key: "houseLord", tags, ratio };
}

/** The Moon's nakshatra id + pada from the permissive `nakshatra.moonNakshatra` (object
 *  `{ id, pada }` on current docs, plain number on legacy) — the pada falls back to the Moon
 *  planet row (the architecture's source of truth). Null when nothing usable is present. */
function moonNakshatraOf(calculated: CalculatedDetailsLike): { id: number; pada?: number } | null {
    const moonNakshatra = calculated.nakshatra?.moonNakshatra;
    if (moonNakshatra === null || moonNakshatra === undefined) return null;
    const id = typeof moonNakshatra === "number" ? moonNakshatra : moonNakshatra.id;
    const objectPada = typeof moonNakshatra === "object" ? moonNakshatra.pada : undefined;
    if (typeof id !== "number") return null;
    const moonRow = validPlanetRows(calculated.planets).find((p) => p.name === 2);
    return { id, pada: moonRow?.pada ?? objectPada };
}

function sectionNakshatraLoad(
    calculated: CalculatedDetailsLike,
    classify: ClassifyObservation,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    const moon = moonNakshatraOf(calculated);
    if (moon === null) {
        return { key: "nakshatraLoad", tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const subjects = validPlanetRows(calculated.planets).filter((p) => p.nakshatra === moon.id);
    if (subjects.length === 0) {
        // Degenerate data (no planet in the Moon's own nakshatra) — degrade, never render a
        // misleading `count: 0` load tag.
        return { key: "nakshatraLoad", tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const tag: ObservationTagBase = {
        kind: "load",
        color: "white",
        labelKey: "notepad.observation.nakshatraLoad",
        params: { nakshatra: moon.id, count: subjects.length },
        ...(moon.pada !== undefined ? { pada: moon.pada } : {}),
    };
    // A single aggregated tag — excluding it dismisses the whole section's ratio.
    const ratio = irrelevant?.has(observationTagId("nakshatraLoad", tag))
        ? { green: 0, total: 0 }
        : ratioOf(subjects, classify);
    return { key: "nakshatraLoad", tags: [tag], ratio };
}

function sectionSubTagPlanet(
    calculated: CalculatedDetailsLike,
    subTag: string | null,
    classify: ClassifyObservation,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    if (subTag === null) return { key: "subTagPlanet", tags: [], ratio: { green: 0, total: 0 } };
    const stored = validPlanetRows(calculated.planets);
    const names = planetsForSubTag(subTag).filter((name) => stored.some((p) => p.name === name));
    const rows = names
        .map((name) => stored.find((p) => p.name === name))
        .filter((row): row is PlanetLike => row !== undefined);
    const tags = rows.map((p) => planetTag(p, p.house ?? 0, classify));
    return { key: "subTagPlanet", tags, ratio: ratioOverTags(tags, "subTagPlanet", irrelevant, classify) };
}

/** The chart house-N tag + its neutral load tag (Chandra/Surya Lagna sections). */
function chartHouseSection(
    key: ObservationSectionKey,
    chart: WargaChartKey,
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    parentTag: number,
    classify: ClassifyObservation,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    const entry = warga?.[chart];
    if (!entry) {
        return { key, tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const houseRow = entry.houses[parentTag - 1];
    const names = Array.isArray(houseRow?.planets) ? houseRow.planets : [];
    const rows = names
        .map((name) => entry.planets.find((row) => row.name === name))
        .filter((row): row is WargaPlanetRow => row !== undefined);
    const sign = houseRow?.sign ?? wholeSignOf(entry.lagnaSign, parentTag);
    const tags: ObservationTagBase[] = [
        { kind: "house", color: "white", chart, house: parentTag, planets: names, loadCount: names.length },
        houseLoadTag(parentTag, names.length, sign),
    ];
    // The `house` tag represents the ratio subjects — excluding it dismisses the section's ratio.
    const ratio = irrelevant?.has(observationTagId(key, tags[0])) ? { green: 0, total: 0 } : ratioOf(rows, classify);
    return { key, tags, ratio };
}

/** The D1 planets loading house N, each rendered at its `wargaKendara.d9.planets` position
 *  (sign/house/strength from the d9 row when present; a planet missing from the d9 rows renders at
 *  its D1 placement, strength omitted → neutral white). */
function d1LoadInWargaTags(
    calculated: CalculatedDetailsLike,
    d9: WargaChartEntry,
    parentTag: number,
    classify: ClassifyObservation,
): ObservationTagBase[] {
    const stored = validPlanetRows(calculated.planets).filter((p) => p.house === parentTag);
    const lagnaSign = calculated.ascendant?.sign;
    return stored.map((p) => {
        const d9Row = d9.planets.find((row) => row.name === p.name);
        const base: ObservationTagBase = {
            kind: "d1LoadInWarga",
            color: "white",
            chart: "d9",
            planet: p.name,
            sign: d9Row ? d9Row.sign : (p.sign ?? wholeSignOf(lagnaSign, parentTag)),
            house: d9Row ? d9Row.house : (p.house ?? parentTag),
            ...(d9Row ? { strength: d9Row.strength } : {}),
        };
        return { ...base, color: classify(base) };
    });
}

function sectionWargaKendara(
    calculated: CalculatedDetailsLike,
    warga: WargaKendara | undefined,
    parentTag: number,
    classify: ClassifyObservation,
    irrelevant: ReadonlySet<string> | undefined,
): ObservationSection {
    const d9 = warga?.d9;
    if (!d9) {
        return { key: "wargaKendara", tags: [notAvailableTag()], ratio: { green: 0, total: 1 } };
    }
    const tags: ObservationTagBase[] = [];

    // Sub-part 1 — warga lagna (degrades individually, UT-SN-112b).
    if (typeof d9.lagnaSign === "number") {
        tags.push({
            kind: "lagna",
            color: "white",
            chart: "d9",
            lagnaSign: d9.lagnaSign,
            loadCount: d9.houses[0]?.planets?.length ?? 0,
        });
    } else {
        tags.push(notAvailableTag());
    }

    // Sub-part 2 — related house N in the d9 chart.
    const houseRow = d9.houses[parentTag - 1];
    if (houseRow && Array.isArray(houseRow.planets)) {
        tags.push({
            kind: "house",
            color: "white",
            chart: "d9",
            house: parentTag,
            planets: houseRow.planets,
            loadCount: houseRow.planets.length,
        });
    } else {
        tags.push(notAvailableTag());
    }

    // Sub-part 3 — D1 planets loading house N, positioned in the d9 chart.
    tags.push(...d1LoadInWargaTags(calculated, d9, parentTag, classify));

    // Ratio reflects the warga planets: the D1 planets rendered in the d9 chart (classified by
    // their d9 strength, neutral when the d9 row is missing). Zero subject planets → no badge.
    // Each D1-load tag maps 1:1 to a subject — excluding one drops that planet from the ratio.
    const d1LoadTags = tags.filter((t) => t.kind === "d1LoadInWarga");
    const ratio = ratioOverTags(d1LoadTags, "wargaKendara", irrelevant, classify);
    return { key: "wargaKendara", tags, ratio };
}

/** The shared, ordered section builders — each wrapped in its own try/catch by the caller. */
const SECTION_BUILDERS: Array<{
    key: ObservationSectionKey;
    build: (ctx: {
        calculated: CalculatedDetailsLike;
        warga: WargaKendara | undefined;
        parentTag: number;
        subTag: string | null;
        classify: ClassifyObservation;
        irrelevant: ReadonlySet<string> | undefined;
    }) => ObservationSection;
}> = [
    {
        key: "planetsInHouse",
        build: (c) => sectionPlanetsInHouse(c.calculated, c.warga, c.parentTag, c.classify, c.irrelevant),
    },
    { key: "houseLord", build: (c) => sectionHouseLord(c.calculated, c.warga, c.parentTag, c.irrelevant) },
    { key: "nakshatraLoad", build: (c) => sectionNakshatraLoad(c.calculated, c.classify, c.irrelevant) },
    { key: "subTagPlanet", build: (c) => sectionSubTagPlanet(c.calculated, c.subTag, c.classify, c.irrelevant) },
    {
        key: "chandraLagnaHouse",
        build: (c) =>
            chartHouseSection(
                "chandraLagnaHouse",
                "chandraLagna",
                c.calculated,
                c.warga,
                c.parentTag,
                c.classify,
                c.irrelevant,
            ),
    },
    {
        key: "suryaLagnaHouse",
        build: (c) =>
            chartHouseSection(
                "suryaLagnaHouse",
                "suryaLagna",
                c.calculated,
                c.warga,
                c.parentTag,
                c.classify,
                c.irrelevant,
            ),
    },
    {
        key: "wargaKendara",
        build: (c) => sectionWargaKendara(c.calculated, c.warga, c.parentTag, c.classify, c.irrelevant),
    },
];

/** Derive the seven observation sections for a selected (parent, sub-tag) from the viewed
 *  horoscope's `CalculatedDetails`. Pure and deterministic (UT-SN-116); never throws (UT-SN-117).
 *  `calculatedDetails: null` → every section renders its not-available tag; `parentTag` 0/Other →
 *  no sections (the component shows only the student-tag area). `irrelevantTagIds` (per-student
 *  not-relevant markers, keyed by `observationTagId(...)`) excludes those tags from every section's
 *  ratio — the tags themselves still render (struck through by the component). */
export function resolveNotepadObservation(
    calculatedDetails: CalculatedDetailsLike | null | undefined,
    parentTag: number,
    subTag: string | null,
    classify: ClassifyObservation = classifyPlanetStrength,
    irrelevantTagIds?: ReadonlySet<string>,
): NotepadObservation {
    if (!calculatedDetails || parentTag === 0 || !isValidParentTag(parentTag)) {
        if (!calculatedDetails) {
            return {
                sections: SECTION_KEYS.map((key) => ({
                    key,
                    tags: [notAvailableTag()],
                    ratio: { green: 0, total: 1 },
                })),
            };
        }
        return { sections: [] };
    }

    const warga = resolveWargaKendara(calculatedDetails);
    const sections: ObservationSection[] = [];
    for (const { key, build } of SECTION_BUILDERS) {
        try {
            sections.push(
                build({
                    calculated: calculatedDetails,
                    warga,
                    parentTag,
                    subTag,
                    classify,
                    irrelevant: irrelevantTagIds,
                }),
            );
        } catch (error) {
            console.warn(`[notepadObservations] ${key} derivation failed`, error);
            sections.push({ key, tags: [notAvailableTag()], ratio: { green: 0, total: 1 } });
        }
    }
    return { sections };
}
