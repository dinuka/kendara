import { PanchaPakshi, PlanetaryStrength } from "./astrologyEnums";
import type { ShadBalaya } from "./shadBalaya";

export const PLANET_SYMBOLS: Record<number, string> = {
    1: "\u2609",
    2: "\u263D",
    3: "\u2642",
    4: "\u263F",
    5: "\u2643",
    6: "\u2640",
    7: "\u2644",
    8: "\u260A",
    9: "\u260B",
};

export const PLANET_COLORS: Record<number, string> = {
    1: "#dc2626",
    2: "#64748b",
    3: "#c2410c",
    4: "#16a34a",
    5: "#1e293b",
    6: "#1d4ed8",
    7: "#0891b2",
    8: "#7c3aed",
    9: "#92400e",
};

/** Maps a sign + navamsa-index-within-sign (1-9) to the D9 (navamsa) sign, using the standard
 *  movable/fixed/dual offset table. Shared by the D1 calculation pipeline and any client-side
 *  chart that needs to resolve navamsa wedge identity without a full recalculation. */
export function navamsaSign(sourceSign: number, navamsaNum: number): number {
    const NAVAMSA_OFFSET = [0, 8, 4];
    const offset = NAVAMSA_OFFSET[(sourceSign - 1) % 3];
    return ((sourceSign - 1 + offset + navamsaNum - 1) % 12) + 1;
}

/** Natural friends, keyed by planet (1-9), values are sign-lord planets. Shared by the strength
 *  calculators (calculation/currentPlanets/manualChart) and the Shad Bala enemy-sign helper. */
export const NATURAL_FRIENDS: Record<number, number[]> = {
    1: [2, 3, 5],
    2: [1, 4],
    3: [1, 2, 5],
    4: [1, 6],
    5: [1, 2, 3],
    6: [4, 7],
    7: [4, 6],
    8: [],
    9: [],
};

/** Natural enemies, keyed by planet (1-9), values are sign-lord planets. Shared by the strength
 *  calculators (calculation/currentPlanets/manualChart) and the Shad Bala enemy-sign helper. */
export const NATURAL_ENEMIES: Record<number, number[]> = {
    1: [6, 7],
    2: [],
    3: [4],
    4: [2],
    5: [4, 6],
    6: [1, 2],
    7: [1, 2, 3],
    8: [],
    9: [],
};

/** Gandamula (ගණ්ඩමූල): planets in the 1st pada of Ashwini, Magha, or Mula nakshatras. */
const GANDAMULA_NAKSHATRAS = new Set([1, 10, 19]);
const GANDAMULA_PADA = 1;

/** Gandantha (ගණ්ඩාන්ත): planets in the 4th pada of Ashlesha, Jyestha, or Revati nakshatras. */
const GANDANTHA_NAKSHATRAS = new Set([9, 18, 27]);
const GANDANTHA_PADA = 4;

/** Pushkara navamsa target signs keyed by birth-chart sign (1-12). */
const PUSHKARA_NAVAMSA_SIGNS: Record<number, number[]> = {
    1: [7, 9],
    2: [2, 12],
    3: [2, 12],
    4: [4, 6],
    5: [7, 9],
    6: [2, 12],
    7: [2, 12],
    8: [4, 6],
    9: [7, 9],
    10: [2, 12],
    11: [2, 12],
    12: [4, 6],
};

export interface AscendantSpecialFlags {
    isAscendantGandantha: boolean;
    isAscendantGandamula: boolean;
    isAscendantPushkara: boolean;
}

/** Derive the lagna's Gandantha/Gandamula/Pushkara flags from the stored ascendant sign + degree and
 *  the ascendant's nakshatra (id + pada). Used for render-time display so older CalculatedDetails
 *  documents that predate these fields still render correct tags. */
export function computeAscendantSpecialFlags(
    ascSign: number,
    ascDegree: number,
    ascNakshatra: number,
    ascPada: number,
): AscendantSpecialFlags {
    return {
        isAscendantGandantha: GANDANTHA_NAKSHATRAS.has(ascNakshatra) && ascPada === GANDANTHA_PADA,
        isAscendantGandamula: GANDAMULA_NAKSHATRAS.has(ascNakshatra) && ascPada === GANDAMULA_PADA,
        isAscendantPushkara:
            PUSHKARA_NAVAMSA_SIGNS[ascSign]?.includes(navamsaSign(ascSign, Math.floor(ascDegree / (30 / 9)) + 1)) ??
            false,
    };
}

/** Thithi (තිති) of the Moon: the 1-30 lunar day number derived from the Sun–Moon elongation.
 *  Each tithi spans 12° of elongation (Moon 1° ahead of Sun ≈ 1/30th of the synodic cycle).
 *  Standard formula used for auto horoscopes (exact ephemeris longitudes). */
export function computeThithi(sunLongitude: number, moonLongitude: number): number {
    const elongation = (((moonLongitude - sunLongitude) % 360) + 360) % 360;
    return Math.floor(elongation / 12) + 1;
}

/** Thithi computed from the stored Sun/Moon planets (their absolute degrees). Used for manual
 *  horoscopes where only the navamsa-midpoint degree is known, and as a render-time fallback for
 *  older CalculatedDetails documents that predate the `thithi` field. */
export function computeThithiFromPlanets(planets: Pick<Planet, "name" | "absoluteDegree">[]): number {
    const sun = planets.find((p) => p.name === 1);
    const moon = planets.find((p) => p.name === 2);
    if (!sun || !moon) return 1;
    return computeThithi(sun.absoluteDegree, moon.absoluteDegree);
}

/** Contiguous nakshatra ranges (1-27) forming the five Pancha Pakshi groups, in order:
 *  Ashwini–Ardra, Punarvasu–Uttara Phalguni, Hasta–Anuradha, Jyeshtha–Shravana, Dhanishta–Revati. */
const PANCHAPAKSHI_NAKSHATRA_GROUPS: [number, number][] = [
    [1, 6],
    [7, 12],
    [13, 17],
    [18, 22],
    [23, 27],
];

/** Bird order per paksha: group index → bird. The Crow group (3rd) stays fixed; the other four
 *  rotate between Shukla and Krishna Paksha. */
const SHUKLA_PAKSHI: PanchaPakshi[] = [
    PanchaPakshi.VULTURE,
    PanchaPakshi.OWL,
    PanchaPakshi.CROW,
    PanchaPakshi.COCK,
    PanchaPakshi.PEACOCK,
];

const KRISHNA_PAKSHI: PanchaPakshi[] = [
    PanchaPakshi.PEACOCK,
    PanchaPakshi.COCK,
    PanchaPakshi.CROW,
    PanchaPakshi.OWL,
    PanchaPakshi.VULTURE,
];

/** Pancha Pakshi (පංච පක්ෂී): the governing bird derived from the Moon's nakshatra group and the
 *  Moon's paksha. Shukla Paksha spans thithi 1-15 (waxing), Krishna Paksha thithi 16-30 (waning). */
export function computePanchaPakshi(moonNakshatraId: number, thithi: number): PanchaPakshi {
    const groupIndex = PANCHAPAKSHI_NAKSHATRA_GROUPS.findIndex(
        ([start, end]) => moonNakshatraId >= start && moonNakshatraId <= end,
    );
    if (groupIndex < 0) return PanchaPakshi.VULTURE;
    const table = thithi >= 1 && thithi <= 15 ? SHUKLA_PAKSHI : KRISHNA_PAKSHI;
    return table[groupIndex];
}

export function formatDashaDuration(years: number, months: number, days: number): string {
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "0 days";
}

export function formatYearDuration(years: number): string {
    const y = Math.floor(years);
    const rem = years - y;
    const m = Math.floor(rem * 12);
    const d = Math.round((rem * 12 - m) * 30);
    return formatDashaDuration(y, m, d);
}

export function formatMonthDuration(months: number): string {
    const m = Math.floor(months);
    const d = Math.round((months - m) * 30);
    return formatDashaDuration(0, m, d);
}

export function formatDayDuration(days: number): string {
    const d = Math.round(days);
    return formatDashaDuration(0, 0, d);
}

export function formatDegree(deg: number): string {
    const totalVikala = Math.round(deg * 3600);
    const anshaka = Math.floor(totalVikala / 3600);
    const kala = Math.floor((totalVikala % 3600) / 60);
    const vikala = totalVikala % 60;
    return `${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")}`;
}

export interface AspectReason {
    /** Source of the drishti: the Planet-Aspects setting ("planetary") or the fixed Rashi
     *  Chara/Thira/Ubaya rules ("rashi"). Each distinct reason renders as its own tooltip line. */
    type: "planetary" | "rashi";
    /** Matched angle for this reason (planetary: the nearest configured/default degree; rashi:
     *  `30` × the zodiacal sign-gap). */
    angle: number;
    /** Signed delta (degrees) of the aspected target relative to this reason's aspect point.
     *  Positive when the target is ahead (east) of the aspect point. Display only. */
    delta: number;
    /** For rashi reasons: the aspected whole-sign that triggered the reason. */
    aspectedSign?: number;
}

export interface Aspect {
    planetName: number;
    aspectType: number;
    planetAbsoluteDegree: number;
    degreeGap: number;
    exactAspectDegree: number;
    isBeneficial: boolean;
    /** Signed delta of the aspected planet relative to the aspect point (degrees) — for tooltip
     *  reason lines. Optional; present on records produced by the aspects-aware engine. */
    delta?: number;
    /** Distinct drishti reasons (planetary first, then rashi). Optional; absent on legacy records. */
    reasons?: AspectReason[];
}

export interface CurrentPlanetRecord {
    name: number;
    sign: number;
    degree: number;
    absoluteDegree: number;
    house: number | null;
    nakshatra: number;
    pada: number;
    retrograde: boolean;
    combustion: boolean;
    strength: string;
}

export interface Planet {
    name: number;
    sign: number;
    degree: number;
    absoluteDegree: number;
    house: number;
    nakshatra: number;
    pada: number;
    retrograde: boolean;
    combustion: boolean;
    strength: PlanetaryStrength;
    navamsaSign: number;
    navamsaStrength: PlanetaryStrength;
    aspects: Aspect[];
}

export interface House {
    houseNumber: number;
    startDegree: number;
    startSign: number;
    startLord: number;
    middleDegree: number;
    middleSign: number;
    middleLord: number;
    endDegree: number;
    endSign: number;
    endLord: number;
    sign: number;
    lord: number;
    /** Planets that aspect this house (degree-based union). Auto charts only; absent on legacy docs. */
    aspectingPlanets?: number[];
}

/** Determines the house a longitude falls into using the actual cusp-boundary ranges
 *  (house.startSign/startDegree → house.endSign/endDegree), NOT the whole-sign assignment
 *  (planet.sign relative to ascendant sign). For unequal houses a sign can be split between
 *  two houses, so only the boundary ranges give the correct house. */
export function findHouse(absoluteDegree: number, houses: House[]): number | null {
    const normDegree = ((absoluteDegree % 360) + 360) % 360;
    for (const house of houses) {
        let startAbs = (house.startSign - 1) * 30 + house.startDegree;
        let endAbs = (house.endSign - 1) * 30 + house.endDegree;
        if (endAbs <= startAbs) endAbs += 360;
        const checkDegree = normDegree < startAbs ? normDegree + 360 : normDegree;
        if (checkDegree >= startAbs && checkDegree < endAbs) return house.houseNumber;
    }
    return null;
}

/** Maranakaraka (මරණකාරක) rule: planet -> house whose occupancy makes THAT planet the Maranakaraka. */
const MARANAKARAKA_RULE: Record<number, number> = {
    2: 8,
    8: 9,
    7: 1,
    1: 5,
    6: 6,
    3: 7,
    4: 4,
    5: 3,
};

/** Maranakaraka (මරණකාරක): every planet occupying its designated house — Chandra in the 8th, Rahu in
 *  the 9th, Shani in the 1st, Ravi in the 5th, Shukra in the 6th, Kuja in the 7th, Budha in the 4th,
 *  Guru in the 3rd — is itself the Maranakaraka (never Chandra by default). Uses the cusp-based
 *  calculated house (findHouse) when `houses` are provided — the same house shown in the chart —
 *  falling back to the whole-sign `planet.house` otherwise (manual charts, where the entered house
 *  is the source of truth). Checks the lagna (rasi) chart only — never D9. Returns an empty array
 *  when no rule holds. */
export function computeMaranakaraka(
    planets: Array<Pick<Planet, "name" | "house" | "absoluteDegree">>,
    houses?: House[],
): number[] {
    return planets
        .filter((p) => {
            const house = houses ? (findHouse(p.absoluteDegree, houses) ?? p.house) : p.house;
            return MARANAKARAKA_RULE[p.name] === house;
        })
        .map((p) => p.name)
        .sort((a, b) => a - b);
}

/** Normalize a stored maranakaraka — legacy docs hold a single planet (`0` = none, or `n`), new docs
 *  hold `number[]` — into an array. Zero is never a planet, so it is dropped. */
export function normalizeMaranakaraka(value: number | number[] | null | undefined): number[] {
    if (Array.isArray(value)) return value.filter((v): v is number => v > 0);
    return typeof value === "number" && value > 0 ? [value] : [];
}

export interface Ascendant {
    sign: number;
    degree: number;
    lord: number;
}

export interface Nakshatra {
    id: number;
    pada: number;
    lord: number;
}

export interface NakshatraInfo {
    moonNakshatra: Nakshatra;
    ascendantNakshatra: Nakshatra;
}

export interface Prana {
    planet: number;
    startDate: string;
    endDate: string;
    durationHours: number;
    startAge: number;
}

export interface Sukshama {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    prana: Prana[];
    startAge: number;
}

export interface Vidasa {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    sukshama: Sukshama[];
    startAge: number;
}

export interface Antardasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationMonths: number;
    vidasa: Vidasa[];
    startAge: number;
}

export interface Mahadasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationYears: number;
    remainingYearsAtBirth: number;
    antardasha: Antardasha[];
    startAge: number;
}

export interface CurrentPeriod {
    mahadashaLord: number;
    antardashaLord: number;
    vidasaLord: number | null;
    sukshamaLord: number | null;
    pranaLord: number | null;
}

export interface Dashas {
    mahadasha: Mahadasha[];
    currentPeriod: CurrentPeriod;
}

export interface DashaInfo {
    mahadasha: Mahadasha[];
    currentPeriod: CurrentPeriod;
}

export interface DoshaInfo {
    doshas: unknown[];
}

export interface CalculationResult {
    ascendant: Ascendant;
    houses: House[];
    planets: Planet[];
    nakshatra: NakshatraInfo;
    /** Thithi (තිති) of the Moon, 1-30 (see computeThithi). */
    thithi: number;
    /** Pancha Pakshi (පංච පක්ෂී) governing bird (see computePanchaPakshi). */
    panchaPakshi: PanchaPakshi;
    dashas: DashaInfo;
    lord22ndDrekkana: number;
    lord64thNavamsa: number;
    badhakaPlanet: number[];
    marakaPlanets: number[];
    nidhanamshaPlanets: number[];
    ashtamanshaPlanets: number[];
    atmakaraka: number;
    /** Maranakaraka (මරණකාරක): the planets occupying their designated death houses, each tagged as
     *  Maranakaraka (see computeMaranakaraka). Uses the cusp-based calculated house for auto charts. */
    maranakaraka: number[];
    isAscendantWargoththama: boolean;
    isAscendantGandantha: boolean;
    isAscendantGandamula: boolean;
    isAscendantPushkara: boolean;
    wargoththamaPlanets: number[];
    gandanthaPlanets: number[];
    gandamulaPlanets: number[];
    pushkaraPlanets: number[];
    /** Shad Bala (ෂඩ් බලය) six strengths per planet (see src/lib/shadBalaya.ts). Optional because
     *  legacy CalculatedDetails documents predate the field and are lazily recomputed at render. */
    shadbalaya?: ShadBalaya;
    yogas: unknown[];
    doshas: DoshaInfo;
}
