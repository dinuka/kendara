/** Warga Kendara (වර්ග කේනදර) — per-chart varga tables for the two-chart display on the horoscope
 *  page: the birth (D1) chart plus one selectable chart (Navamsa D9 / Surya Lagna / Chandra Lagna).
 *  Every entry carries its own whole-sign houses, planet rows, and per-chart derived values (maraka,
 *  maranakaraka, dig bala) so the tables render independently of the calculation pipeline.
 *
 *  Chart input:
 *    - d1: the stored calculation (auto) or synthesized result (manual) itself.
 *    - d9 (auto): navamsa signs from the stored planets — derived from the birth degree when the
 *      stored navamsaSign is missing on legacy docs; houses are whole-sign from the navamsa lagna.
 *    - d9 (manual): the entered navamsa placements, rows only for placed planets (strength SAMA).
 *    - suryaLagna / chandraLagna: the chart rotated via getChartData so the Sun/Moon sign becomes
 *      the first house.
 *
 *  Aspects and conjunctions are whole-sign diffs within each chart, mirroring the D1 houses-table
 *  rule (see getAspectsToHouse on the horoscope page): opposition (diff 6 → 180°) plus each
 *  planet's special-aspect diffs (120/240/90/210/60/270 per the shared table).
 *
 *  Per-chart derived values are recomputed fresh (deterministic — nothing is read back from stored
 *  result fields):
 *    - maraka: lords of the 2nd and 7th signs from the chart lagna.
 *    - maranakaraka: computeMaranakaraka with the chart houses when available (findHouse), falling
 *      back to the row house otherwise.
 *    - digBala: planets sitting on their dig bala target house (see shadBalaya.DIG_HOUSE).
 */

import type { CalculationResult, House, Planet } from "@/lib/astrology";
import { computeMaranakaraka, navamsaSign } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { getChartData } from "@/lib/chartDataTransform";
import { ChartType } from "@/lib/chartTypes";
import { SIGN_LORD, buildWholeSignHouses } from "@/lib/manualChart";
import { computeDigBalaPlanets } from "@/lib/shadBalaya";

/** One row of the per-chart Houses table (the chart's whole-sign houses, the planets occupying each
 *  house, and the planets aspecting it). */
export interface WargaHouseRow {
    houseNumber: number;
    sign: number;
    planets: number[];
    aspects: { planetName: number; aspectType: number }[];
}

/** One row of the per-chart Planets table. `strength` is the normalized numeric PlanetaryStrength
 *  enum, never a display string — names resolve per-locale at render time. */
export interface WargaPlanetRow {
    name: number;
    sign: number;
    strength: PlanetaryStrength;
    house: number;
    nakshatra?: number;
    pada?: number;
    conjunctions: number[];
    aspects: { planetName: number; aspectType: number }[];
}

/** One chart of the Warga Kendara. The D1 entry carries the twelve D1-only flags (wargoththama,
 *  pushkara, gandantha, gandamula, cheshta/kala bala, combust, badhaka, atmakaraka, the 22nd
 *  drekkana and 64th navamsa lords, ashtamansha); the other three entries carry only per-chart
 *  values and never these keys. */
export interface WargaChartEntry {
    lagnaSign: number;
    houses: WargaHouseRow[];
    planets: WargaPlanetRow[];
    wargoththamaPlanets?: number[];
    pushkaraPlanets?: number[];
    gandanthaPlanets?: number[];
    gandamulaPlanets?: number[];
    lord22ndDrekkana?: number;
    lord64thNavamsa?: number;
    cheshtaBalaPlanets?: number[];
    ashtamanshaPlanets?: number[];
    kalaBalaPlanets?: number[];
    atmakaraka?: number;
    combustPlanets?: number[];
    badhakaPlanets?: number[];
    marakaPlanets: number[];
    maranakaraka: number[];
    digBalaPlanets: number[];
}

/** The four charts of the Warga Kendara. Every key is present — null when that chart cannot be
 *  derived from the data (e.g. no navamsa lagna entered on a manual horoscope). */
export type WargaKendara = Record<WargaChartKey, WargaChartEntry | null>;

export type WargaChartKey = "d1" | "d9" | "suryaLagna" | "chandraLagna";

/** Context passed to computeWargaKendara: whether the result is an auto calculation or a manual
 *  entry, plus the manual placements (navamsa lagna / navamsa houses) when source is manual. */
export interface WargaKendaraContext {
    source: "auto" | "manual";
    manualHousePlacements?: WargaManualHousePlacements;
}

/** Structural subset of ManualHousePlacements (manualChart.ts) — the fields the warga derivation
 *  needs. Kept local so this module does not depend on the manual-chart validation types. */
export interface WargaManualHousePlacements {
    lagna: number;
    navamsaLagna?: number;
    navamsaHouses?: Array<{ houseNumber: number; sign: number; planets: number[] }> | null;
    validation?: unknown;
}

/** The 16 vargas of the static catalog, in canonical order. The Warga Kendara shows only D1 + one
 *  selected chart; the main-indication tag chips under each figure caption are the comma/semicolon-
 *  split `indication` of the displayed chart's own varga key, resolved per locale via the
 *  `astrology.wargaKendara.vargas.{key}.{name|indication}` message keys (d1 | d9 | suryaLagna |
 *  chandraLagna — the remaining keys exist for the catalog/parity but are not rendered). */
export interface VargaCatalogEntry {
    key: string;
    d: number;
}

export const VARGA_CATALOG: VargaCatalogEntry[] = [
    { key: "d1", d: 1 },
    { key: "d2", d: 2 },
    { key: "d3", d: 3 },
    { key: "d4", d: 4 },
    { key: "d7", d: 7 },
    { key: "d9", d: 9 },
    { key: "d10", d: 10 },
    { key: "d12", d: 12 },
    { key: "d16", d: 16 },
    { key: "d20", d: 20 },
    { key: "d24", d: 24 },
    { key: "d27", d: 27 },
    { key: "d30", d: 30 },
    { key: "d40", d: 40 },
    { key: "d45", d: 45 },
    { key: "d60", d: 60 },
];

/** Every varga key of the catalog (d1..d60) — the values a Warga Kendara figure/tag can resolve. */
export type WargaVargaKey = (typeof VARGA_CATALOG)[number]["key"];

/** Each planet's special-aspect diffs (whole-sign), mirroring the D1 houses-table rule. */
const SPECIAL_ASPECTS: Record<number, number[]> = {
    1: [2, 9],
    2: [2, 9],
    7: [2, 9],
    3: [3, 7],
    4: [3, 7],
    5: [4, 8],
    6: [4, 8],
};

/** Aspect type (degrees) for a whole-sign house diff: opposition (diff 6 → 180°) or one of the
 *  special-aspect diffs (120/240/90/210/60/270). Anything else → 0 (no aspect). */
function aspectTypeForDiff(diff: number): number {
    switch (diff) {
        case 6:
            return 180;
        case 4:
            return 120;
        case 8:
            return 240;
        case 3:
            return 90;
        case 7:
            return 210;
        case 2:
            return 60;
        case 9:
            return 270;
        default:
            return 0;
    }
}

/** Navamsa wedge index (1-9) containing the degree within a sign. */
function wedgeOf(degree: number | undefined): number {
    return Math.floor(((((degree ?? 0) % 30) + 30) % 30) / (30 / 9)) + 1;
}

/** Normalize a stored strength (numeric PlanetaryStrength enum or a legacy string like "Uchcha" /
 *  "OwnSign") to the numeric enum. Mirrors shadBalaya.normalizePlanetaryStrength exactly. */
function normalizeStrength(strength: number | string | undefined | null): PlanetaryStrength {
    if (typeof strength === "number") {
        const NUM_TO_STRENGTH: Record<number, PlanetaryStrength> = {
            1.25: PlanetaryStrength.ATHI_UCHCHA,
            1: PlanetaryStrength.UCHCHA,
            [-1]: PlanetaryStrength.NEECHA,
            [-1.25]: PlanetaryStrength.ATHI_NEECHA,
            0.75: PlanetaryStrength.MOOLATRIKONA,
            0.5: PlanetaryStrength.OWN_SIGN,
            0.1: PlanetaryStrength.MITRA,
            [-0.1]: PlanetaryStrength.SHATRU,
            0: PlanetaryStrength.SAMA,
        };
        return NUM_TO_STRENGTH[strength] ?? PlanetaryStrength.SAMA;
    }
    if (typeof strength === "string") {
        const STR_TO_ENUM: Record<string, PlanetaryStrength> = {
            athiuchcha: PlanetaryStrength.ATHI_UCHCHA,
            uchcha: PlanetaryStrength.UCHCHA,
            exalted: PlanetaryStrength.UCHCHA,
            neecha: PlanetaryStrength.NEECHA,
            debilitated: PlanetaryStrength.NEECHA,
            athineecha: PlanetaryStrength.ATHI_NEECHA,
            moolatrikona: PlanetaryStrength.MOOLATRIKONA,
            ownsign: PlanetaryStrength.OWN_SIGN,
            mitra: PlanetaryStrength.MITRA,
            friendly: PlanetaryStrength.MITRA,
            shatru: PlanetaryStrength.SHATRU,
            enemy: PlanetaryStrength.SHATRU,
            sama: PlanetaryStrength.SAMA,
            neutral: PlanetaryStrength.SAMA,
        };
        return STR_TO_ENUM[strength.toLowerCase().replace(/[\s_-]/g, "")] ?? PlanetaryStrength.SAMA;
    }
    return PlanetaryStrength.SAMA;
}

/** A planet row source: the fields the chart builders need, tolerant of missing legacy fields. */
interface WargaPlanetSource {
    name: number;
    sign: number;
    house: number;
    strength?: number | string | null;
    nakshatra?: number;
    pada?: number;
}

/** Planets (by enum, ascending) that aspect the given house from their row houses, with the
 *  whole-sign aspect type (diff 6 → 180°, special-aspect diffs → their angles). */
function aspectingPlanets(planets: WargaPlanetSource[], targetHouse: number): WargaHouseRow["aspects"] {
    return planets
        .filter((p) => {
            const diff = (targetHouse - p.house + 12) % 12;
            return diff === 6 || (SPECIAL_ASPECTS[p.name]?.includes(diff) ?? false);
        })
        .map((p) => {
            const diff = (targetHouse - p.house + 12) % 12;
            return { planetName: p.name, aspectType: aspectTypeForDiff(diff) };
        })
        .sort((a, b) => a.planetName - b.planetName);
}

/** Whole-sign house rows for a chart (always 12 when the chart's house wheel is present). */
function buildHouseRows(
    houses: Array<Pick<House, "houseNumber" | "sign">>,
    planets: WargaPlanetSource[],
): WargaHouseRow[] {
    return houses.map((h) => ({
        houseNumber: h.houseNumber,
        sign: h.sign,
        planets: planets
            .filter((p) => p.house === h.houseNumber)
            .map((p) => p.name)
            .sort((a, b) => a - b),
        aspects: aspectingPlanets(planets, h.houseNumber),
    }));
}

/** Planet rows for a chart, sorted by planet enum (1-9). Conjunctions are the planets sharing the
 *  row's house; aspects are the other planets aspecting it (whole-sign rule). */
function buildPlanetRows(planets: WargaPlanetSource[]): WargaPlanetRow[] {
    return planets
        .map((p) => {
            const conjunctions = planets
                .filter((q) => q.name !== p.name && q.house === p.house)
                .map((q) => q.name)
                .sort((a, b) => a - b);
            const aspects: WargaPlanetRow["aspects"] = [];
            for (const q of planets) {
                if (q.name === p.name) continue;
                const diff = (q.house - p.house + 12) % 12;
                if (diff !== 6 && !(SPECIAL_ASPECTS[p.name]?.includes(diff) ?? false)) continue;
                const aspectType = aspectTypeForDiff(diff);
                if (aspectType === 0) continue;
                aspects.push({ planetName: q.name, aspectType });
            }
            return {
                name: p.name,
                sign: p.sign,
                strength: normalizeStrength(p.strength),
                house: p.house,
                ...(p.nakshatra !== undefined ? { nakshatra: p.nakshatra } : {}),
                ...(p.pada !== undefined ? { pada: p.pada } : {}),
                conjunctions,
                aspects,
            };
        })
        .sort((a, b) => a.name - b.name);
}

/** The three shared row collections of a chart entry. */
interface WargaChartShape {
    lagnaSign: number;
    houses: WargaHouseRow[];
    planets: WargaPlanetRow[];
}

function buildChartShape(lagnaSign: number, houses: House[], planets: WargaPlanetSource[]): WargaChartShape {
    return {
        lagnaSign,
        houses: buildHouseRows(houses, planets),
        planets: buildPlanetRows(planets),
    };
}

/** Maraka (මාරක) planets of a chart: the lords of the 2nd and 7th signs from its lagna. Mirrors
 *  calculation.computeMaraka so the per-chart tables are self-contained. */
export function computeWargaMaraka(ascSign: number): number[] {
    const secondSign = ((ascSign + 1) % 12) || 12;
    const seventhSign = ((ascSign + 6) % 12) || 12;
    return [SIGN_LORD[secondSign] || 1, SIGN_LORD[seventhSign] || 1];
}

/** Planets (by enum, ascending) whose stored Shad Bala entry has the given bala flag set to true
 *  (cheshta/kala bala are the only per-planet booleans the D1 tables surface). */
function balaFlagPlanets(
    shadbalaya:
        | Record<string, { cheshtaBala?: { value?: boolean }; kalaBala?: { value?: boolean } }>
        | undefined
        | null,
    bala: "cheshtaBala" | "kalaBala",
): number[] {
    if (!shadbalaya) return [];
    return Object.entries(shadbalaya)
        .filter(([, value]) => value?.[bala]?.value === true)
        .map(([key]) => Number(key))
        .filter((name) => name >= 1 && name <= 9)
        .sort((a, b) => a - b);
}

/** Permissive view of the calculation result for legacy documents — fields added after older
 *  documents were written may be missing, and every access below degrades gracefully. */
interface ResultLike {
    ascendant?: { sign?: number; degree?: number };
    houses?: House[];
    planets?: Array<Partial<Planet>>;
    shadbalaya?: Record<string, { cheshtaBala?: { value?: boolean }; kalaBala?: { value?: boolean } }> | null;
    wargoththamaPlanets?: number[];
    pushkaraPlanets?: number[];
    gandanthaPlanets?: number[];
    gandamulaPlanets?: number[];
    lord22ndDrekkana?: number;
    lord64thNavamsa?: number;
    ashtamanshaPlanets?: number[];
    atmakaraka?: number;
    badhakaPlanet?: number[];
}

/** Planet row sources from the D1 chart, skipping rows with corrupted enum fields. */
function d1PlanetSources(res: ResultLike): WargaPlanetSource[] {
    return (res.planets ?? [])
        .filter((p) => typeof p.name === "number" && typeof p.sign === "number" && typeof p.house === "number")
        .map((p) => ({
            name: p.name as number,
            sign: p.sign as number,
            house: p.house as number,
            strength: p.strength,
            nakshatra: p.nakshatra,
            pada: p.pada,
        }));
}

/** D1 entry from the result itself. The D1-only flags come straight from the stored calculation
 *  result fields (absent on legacy docs → treated as empty). */
function buildD1Entry(res: ResultLike): WargaChartEntry {
    const sources = d1PlanetSources(res);
    const houses = res.houses ?? [];
    const shape = buildChartShape(res.ascendant?.sign ?? 1, houses, sources);
    const maranakaraka = computeMaranakaraka(
        (res.planets ?? [])
            .filter(
                (p) =>
                    typeof p.name === "number" &&
                    typeof p.house === "number" &&
                    typeof p.absoluteDegree === "number",
            )
            .map((p) => ({
                name: p.name as number,
                house: p.house as number,
                absoluteDegree: p.absoluteDegree as number,
            })),
        houses,
    );
    return {
        ...shape,
        wargoththamaPlanets: res.wargoththamaPlanets ?? [],
        pushkaraPlanets: res.pushkaraPlanets ?? [],
        gandanthaPlanets: res.gandanthaPlanets ?? [],
        gandamulaPlanets: res.gandamulaPlanets ?? [],
        lord22ndDrekkana: res.lord22ndDrekkana,
        lord64thNavamsa: res.lord64thNavamsa,
        cheshtaBalaPlanets: balaFlagPlanets(res.shadbalaya, "cheshtaBala"),
        ashtamanshaPlanets: res.ashtamanshaPlanets ?? [],
        kalaBalaPlanets: balaFlagPlanets(res.shadbalaya, "kalaBala"),
        atmakaraka: res.atmakaraka,
        combustPlanets: (res.planets ?? [])
            .filter((p) => p.combustion === true)
            .map((p) => p.name as number),
        badhakaPlanets: res.badhakaPlanet ?? [],
        marakaPlanets: computeWargaMaraka(shape.lagnaSign),
        maranakaraka,
        digBalaPlanets: computeDigBalaPlanets(shape.planets.map((r) => ({ name: r.name, house: r.house }))),
    };
}

/** Navamsa (D9) entry for an auto calculation: navamsa signs from the stored planets, whole-sign
 *  houses from the navamsa lagna (the 9th navamsa wedge of the ascendant degree). */
function buildAutoD9Entry(res: ResultLike): WargaChartEntry | null {
    const ascSign = typeof res.ascendant?.sign === "number" ? res.ascendant.sign : 1;
    const ascNavSign = navamsaSign(ascSign, wedgeOf(res.ascendant?.degree));
    const houses = buildWholeSignHouses(ascNavSign);
    const sources: WargaPlanetSource[] = (res.planets ?? [])
        .filter((p) => typeof p.name === "number")
        .map((p) => {
            const navSign =
                typeof p.navamsaSign === "number" ? p.navamsaSign : navamsaSign(p.sign ?? 1, wedgeOf(p.degree));
            return {
                name: p.name as number,
                sign: navSign,
                house: ((navSign - ascNavSign + 12) % 12) + 1,
                strength: normalizeStrength(p.navamsaStrength),
            };
        });
    if (sources.length === 0) return null;
    const shape = buildChartShape(ascNavSign, houses, sources);
    return {
        ...shape,
        marakaPlanets: computeWargaMaraka(ascNavSign),
        maranakaraka: computeMaranakaraka(
            sources.map((s) => ({ name: s.name, house: s.house, absoluteDegree: (s.sign - 1) * 30 + 15 })),
            houses,
        ),
        digBalaPlanets: computeDigBalaPlanets(shape.planets.map((r) => ({ name: r.name, house: r.house }))),
    };
}

/** Navamsa (D9) entry for a manual horoscope: the entered navamsa placements only (rows for placed
 *  planets, strength SAMA — the manual entry never records strengths). Null when no navamsa lagna
 *  was entered (or it is stored as null on legacy docs). */
function buildManualD9Entry(ctx: WargaKendaraContext): WargaChartEntry | null {
    const mhp = ctx.manualHousePlacements;
    const navamsaLagna = mhp?.navamsaLagna;
    if (mhp === undefined || typeof navamsaLagna !== "number") return null;
    const houses = buildWholeSignHouses(navamsaLagna);
    const sources: WargaPlanetSource[] = (mhp.navamsaHouses ?? [])
        .filter((h) => typeof h.houseNumber === "number" && typeof h.sign === "number" && Array.isArray(h.planets))
        .flatMap((h) =>
            h.planets.map((name) => ({
                name,
                sign: h.sign,
                house: h.houseNumber,
                strength: PlanetaryStrength.SAMA,
            })),
        );
    const shape = buildChartShape(navamsaLagna, houses, sources);
    return {
        ...shape,
        marakaPlanets: computeWargaMaraka(navamsaLagna),
        maranakaraka: computeMaranakaraka(
            sources.map((s) => ({ name: s.name, house: s.house, absoluteDegree: (s.sign - 1) * 30 })),
        ),
        digBalaPlanets: computeDigBalaPlanets(shape.planets.map((r) => ({ name: r.name, house: r.house }))),
    };
}

/** Surya/Chandra Lagna entry: the chart rotated so the Sun/Moon sign becomes the first house
 *  (getChartData). Maranakaraka uses the rotated row houses (no houses wheel — same as manual). */
function buildRotatedEntry(
    res: ResultLike,
    type: ChartType.SURYA_LAGNA | ChartType.CHANDRA_LAGNA,
): WargaChartEntry | null {
    if (!Array.isArray(res.planets) || res.planets.length === 0) return null;
    const chart = getChartData(res as CalculationResult, type);
    if (
        !Array.isArray(chart.planets) ||
        !Array.isArray(chart.houses) ||
        typeof chart.ascendant?.sign !== "number"
    ) {
        return null;
    }
    const sources: WargaPlanetSource[] = chart.planets
        .filter((p) => typeof p.name === "number" && typeof p.sign === "number" && typeof p.house === "number")
        .map((p) => ({
            name: p.name as number,
            sign: p.sign as number,
            house: p.house as number,
            strength: p.strength,
        }));
    const shape = buildChartShape(chart.ascendant.sign, chart.houses, sources);
    return {
        ...shape,
        marakaPlanets: computeWargaMaraka(chart.ascendant.sign),
        maranakaraka: computeMaranakaraka(
            sources.map((s) => ({ name: s.name, house: s.house, absoluteDegree: (s.sign - 1) * 30 + 15 })),
        ),
        digBalaPlanets: computeDigBalaPlanets(shape.planets.map((r) => ({ name: r.name, house: r.house }))),
    };
}

/** Compute the full Warga Kendara for a calculation result. Pure and deterministic — the same
 *  result always yields the same four entries. */
export function computeWargaKendara(result: CalculationResult, ctx: WargaKendaraContext): WargaKendara {
    const res: ResultLike = result;
    return {
        d1: buildD1Entry(res),
        d9: ctx.source === "manual" ? buildManualD9Entry(ctx) : buildAutoD9Entry(res),
        suryaLagna: buildRotatedEntry(res, ChartType.SURYA_LAGNA),
        chandraLagna: buildRotatedEntry(res, ChartType.CHANDRA_LAGNA),
    };
}

/** Whether an unknown value is a well-formed chart entry (with its per-chart derived values). */
function isWargaChartEntry(value: unknown): value is WargaChartEntry {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as WargaChartEntry).lagnaSign === "number" &&
        Array.isArray((value as WargaChartEntry).houses) &&
        Array.isArray((value as WargaChartEntry).planets) &&
        Array.isArray((value as WargaChartEntry).marakaPlanets) &&
        Array.isArray((value as WargaChartEntry).maranakaraka) &&
        Array.isArray((value as WargaChartEntry).digBalaPlanets)
    );
}

const WK_KEYS: WargaChartKey[] = ["d1", "d9", "suryaLagna", "chandraLagna"];

function isValidWargaKendara(value: unknown): value is WargaKendara {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return WK_KEYS.every((key) => record[key] === null || isWargaChartEntry(record[key]));
}

/** The stored Warga Kendara of a CalculatedDetails document, when valid. A missing, corrupt, or
 *  stale value is logged and re-derived from the stored chart data (source manual when the document
 *  carries manualHousePlacements); when nothing derivable is present, undefined. */
export function resolveWargaKendara(calculatedDetails: unknown): WargaKendara | undefined {
    const doc = (calculatedDetails ?? {}) as Record<string, unknown> | null | undefined;
    if (!doc) return undefined;
    const stored = doc.wargaKendara;
    if (isValidWargaKendara(stored)) return stored;
    if (stored !== undefined && stored !== null) {
        console.warn("[wargaKendara] stored wargaKendara is corrupt — deriving from stored chart data", stored);
    }
    if (
        typeof doc.ascendant !== "object" ||
        doc.ascendant === null ||
        !Array.isArray(doc.houses) ||
        !Array.isArray(doc.planets)
    ) {
        return undefined;
    }
    const manualHousePlacements = (doc.manualHousePlacements ?? undefined) as WargaManualHousePlacements | undefined;
    try {
        return computeWargaKendara(
            {
                ascendant: doc.ascendant,
                houses: doc.houses,
                planets: doc.planets,
                shadbalaya: doc.shadbalaya,
                // D1-only flags must survive the legacy fallback so buildD1Entry sees them (a stale
                // stored wargaKendara must re-derive the exact same tables, incl. the Other flags).
                wargoththamaPlanets: doc.wargoththamaPlanets,
                pushkaraPlanets: doc.pushkaraPlanets,
                gandanthaPlanets: doc.gandanthaPlanets,
                gandamulaPlanets: doc.gandamulaPlanets,
                lord22ndDrekkana: doc.lord22ndDrekkana,
                lord64thNavamsa: doc.lord64thNavamsa,
                ashtamanshaPlanets: doc.ashtamanshaPlanets,
                atmakaraka: doc.atmakaraka,
                badhakaPlanet: doc.badhakaPlanet,
            } as unknown as CalculationResult,
            { source: manualHousePlacements ? "manual" : "auto", manualHousePlacements },
        );
    } catch (error) {
        console.warn("[wargaKendara] failed to derive warga charts from stored data", error);
        return undefined;
    }
}
