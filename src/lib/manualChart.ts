import { NATURAL_ENEMIES, NATURAL_FRIENDS, computeMaranakaraka, computeYogakaraka, navamsaSign } from "@/lib/astrology";
import type {
    Antardasha,
    Planet as AstroPlanet,
    CalculationResult,
    CurrentPeriod,
    DashaInfo,
    House,
    Mahadasha,
} from "@/lib/astrology";
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";
import { computeLagnaBhavaSuchika, computePlanetBhavaSuchika } from "@/lib/bhavaSuchika";
import { type PlanetAspectsMap, computeManualHouseAspects, derivePlanetAbsoluteDegree } from "@/lib/planetAspects";
import {
    DEFAULT_RASHI_ASPECTS,
    type RashiAspectsSetting,
    computeHouseAspectsByPlanetWithRashi,
} from "@/lib/rashiAspects";

export type ValidationStatus = "valid" | "invalid" | "incomplete" | "skipped";

export interface ValidationResult {
    status: ValidationStatus;
    message: string;
    /** For count-style validations (e.g. planets placed), the current count out of a target. */
    count?: number;
}

export interface PlacementValidation {
    budha: ValidationResult;
    sikuru: ValidationResult;
    rahuKethuAxis: ValidationResult;
    planetCount: ValidationResult;
    navamsaPlanetCount: ValidationResult;
}

export interface ManualHouse {
    houseNumber: number;
    sign: number;
    planets: number[];
    aspects: number[];
}

export interface ManualHousePlacements {
    lagna: number;
    /** Ascendant degree within the birth sign (0 ≤ d < 30). When supplied, the Navamsa Lagna can
     *  be auto-derived from it (see deriveNavamsaLagnaFromDegree). Optional — not all students'
     *  charts record a degree. */
    lagnaDegree?: number;
    houses: ManualHouse[];
    /** Navamsa (D9) Lagna — drives the navamsa house signs. Absent when no navamsa chart entered. */
    navamsaLagna?: number;
    navamsaHouses?: ManualHouse[];
    validation: PlacementValidation;
}

export interface ManualPlanetRow {
    planet: number;
    sign: number;
    strength: PlanetaryStrength;
    house: number;
    conjunctions: number[];
    aspectsPlanets: number[];
    other: string[];
    navamsa?: NavamsaEnrichment;
}

export interface NavamsaEnrichment {
    planet: number;
    navamsaIndex: number;
    navamsaSign: number;
    navamsaStrength: PlanetaryStrength;
    degreeRangeStart: number;
    degreeRangeEnd: number;
    nakshatra: number;
    pada: number;
    absoluteDegreeMidpoint: number;
}

export interface BirthDateCandidate {
    navamsaIndex: number;
    candidateDay: number;
    reasoning: string;
}

export interface AgeRange {
    age: number;
    valueMonths: number;
    valueYears: number;
    warning: boolean;
}

export interface DerivedRanges {
    birthTimeRange: { start: string; end: string } | null;
    birthMonthRange: { start: { month: number; day: number }; end: { month: number; day: number } } | null;
    birthDateCandidates: BirthDateCandidate[];
    ageRanges: AgeRange[];
}

export interface CurrentShani {
    sign: number;
    degree: number;
}

export interface ManualAspectOptions {
    /** Per-planet aspect settings (houses/degrees). Omitted → defaults. */
    planetAspects?: PlanetAspectsMap;
    /** Per-planet stored absolute-degree-in-sign (0-30) for the degree arm on manual charts. */
    planetDegrees?: Record<string, number>;
    /** Per-planet aspect orbs. Omitted → DEFAULT_ORBS. */
    planetaryOrbs?: Record<string, number>;
    /** Rashi (zodiacal-sign) drishti settings. Omitted → DEFAULT_RASHI_ASPECTS. */
    rashiAspects?: RashiAspectsSetting;
    /** Planet → navamsa (D9) sign, used as the deterministic degree fallback within the birth sign. */
    navamsaSigns?: Record<number, number>;
}

export interface ManualChartInput {
    lagna: number;
    houses: Record<number, number[]>;
    /** Ascendant degree within the lagna sign (0 ≤ d < 30). Stored as metadata; drives auto-deriving
     *  the Navamsa Lagna on the client when supplied. */
    lagnaDegree?: number;
    /** Navamsa (D9) Lagna — required to enter the navamsa chart; drives navamsa house signs. */
    navamsaLagna?: number;
    navamsaHouses?: Record<number, number[]>;
    /** Aspect settings consumed during derivation (settings tab). */
    aspectOptions?: ManualAspectOptions;
}

export interface ManualChartResult {
    manualHousePlacements: ManualHousePlacements;
    planetsTable: ManualPlanetRow[];
    navamsaEnrichment: NavamsaEnrichment[];
    derivedRanges: DerivedRanges;
    aspectOptions?: ManualAspectOptions;
}

export const SIGN_LORD: Record<number, number> = {
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

/** Whole-sign house system: house N (1-12) holds sign `lagna + N - 1` (mod 12). */
export function deriveHouseSigns(lagna: number): number[] {
    if (!Number.isInteger(lagna) || lagna < 1 || lagna > 12) {
        throw new Error(`Invalid lagna: ${lagna}`);
    }
    return Array.from({ length: 12 }, (_, i) => ((lagna - 1 + i) % 12) + 1);
}

/** Manual-chart planet → aspected houses: the union of the Planet-Aspects arms (explicit/offset
 *  houses ∪ degree arm against whole-sign sign midpoints) and the rashi (zodiacal-sign) arm. Pure
 *  delegation to the shared modules — no duplicated matching logic. `houseSigns` is the lagna-derived
 *  whole-sign house → sign list. */
export function computeAspects(
    houseOfPlanet: Record<number, number>,
    houseSigns: number[],
    options: ManualAspectOptions = {},
): Record<number, number[]> {
    const base = computeManualHouseAspects(
        houseOfPlanet,
        houseSigns,
        options.planetDegrees,
        options.planetAspects,
        options.planetaryOrbs,
        options.navamsaSigns,
    );
    const planets = Object.entries(houseOfPlanet).map(([planetKey, house]) => {
        const planet = Number(planetKey);
        const sign = houseSigns[house - 1];
        return {
            name: planet,
            house,
            sign,
            absoluteDegree: derivePlanetAbsoluteDegree(
                planet,
                sign,
                options.navamsaSigns?.[planet],
                options.planetDegrees?.[String(planet)],
            ),
        };
    });
    const houses = houseSigns.map((sign, i) => ({
        houseNumber: i + 1,
        sign,
        middleSign: sign,
        middleDegree: 15,
    }));
    return computeHouseAspectsByPlanetWithRashi(
        planets,
        houses,
        options.planetAspects,
        options.planetaryOrbs,
        options.rashiAspects ?? DEFAULT_RASHI_ASPECTS,
    );
}

/** Planets co-located in the same house are conjunct. Returns planet -> partner planets. */
export function computeConjunctions(houseOfPlanet: Record<number, number>): Record<number, number[]> {
    const byHouse: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        (byHouse[house] ??= []).push(Number(planetKey));
    }
    const result: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        result[Number(planetKey)] = byHouse[house].filter((p) => p !== Number(planetKey));
    }
    return result;
}

/** Convert a house-number-keyed placements object into a planet -> house map. */
export function placementsToMap(placements: Record<number, number[]>): Record<number, number> {
    const houseOfPlanet: Record<number, number> = {};
    for (const [houseKey, planets] of Object.entries(placements)) {
        const house = Number(houseKey);
        for (const planet of planets) {
            houseOfPlanet[planet] = house;
        }
    }
    return houseOfPlanet;
}

/** Convert the stored `ManualHousePlacements` (house objects keyed by houseNumber, the persisted
 *  source of truth) back into the `ManualChartInput` shape (`houses`/`navamsaHouses` as
 *  house-number → planet-enum maps) so it can be fed back through `compute()` for recalculation. */
export function manualPlacementsToInput(placements: ManualHousePlacements): ManualChartInput {
    const toRecord = (houses: ManualHouse[] | null | undefined): Record<number, number[]> => {
        const result: Record<number, number[]> = {};
        for (const house of houses ?? []) {
            if (house.planets.length > 0) result[house.houseNumber] = house.planets;
        }
        return result;
    };
    return {
        lagna: placements.lagna,
        lagnaDegree: placements.lagnaDegree ?? undefined,
        navamsaLagna: placements.navamsaLagna ?? undefined,
        houses: toRecord(placements.houses),
        navamsaHouses: toRecord(placements.navamsaHouses),
    };
}

export function buildHouses(
    lagna: number,
    houseOfPlanet: Record<number, number>,
    options?: ManualAspectOptions,
): ManualHouse[] {
    const houseSigns = deriveHouseSigns(lagna);
    const planetsByHouse: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        (planetsByHouse[house] ??= []).push(Number(planetKey));
    }
    const aspectsByPlanet = computeAspects(houseOfPlanet, houseSigns, options);
    const aspectingPlanetsByHouse: Record<number, number[]> = {};
    for (const [planetKey, houses] of Object.entries(aspectsByPlanet)) {
        const planet = Number(planetKey);
        for (const h of houses) {
            (aspectingPlanetsByHouse[h] ??= []).push(planet);
        }
    }
    return houseSigns.map((sign, i) => {
        const houseNumber = i + 1;
        return {
            houseNumber,
            sign,
            planets: planetsByHouse[houseNumber] ?? [],
            aspects: aspectingPlanetsByHouse[houseNumber] ?? [],
        };
    });
}

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Advisory validation: Budha within ±1 house of Ravi, Sikuru within ±2, Rahu-Ketu opposite houses
 *  (6 apart, mod 12), and both the birth (Lagna) and Navamsa charts contain all 9 planets. Navamsa
 *  checks are `skipped` when no navamsa placements are entered (the navamsa chart is optional). */
export function validatePlacements(
    houseOfPlanet: Record<number, number>,
    navamsaPlacements?: Record<number, number[]>,
    navamsaActive = !!navamsaPlacements && Object.keys(navamsaPlacements).length > 0,
): PlacementValidation {
    const raviHouse = houseOfPlanet[Planet.SUN];
    const budhaHouse = houseOfPlanet[Planet.MERCURY];
    const sikuruHouse = houseOfPlanet[Planet.VENUS];
    const rahuHouse = houseOfPlanet[Planet.RAHU];
    const ketuHouse = houseOfPlanet[Planet.KETU];

    let budha: ValidationResult;
    if (raviHouse === undefined) {
        budha = { status: "skipped", message: "Place Ravi first" };
    } else if (budhaHouse === undefined) {
        budha = { status: "skipped", message: "Budha not placed" };
    } else {
        const diff = mod12(budhaHouse - raviHouse);
        const valid = diff === 0 || diff === 1 || diff === 11;
        budha = {
            status: valid ? "valid" : "invalid",
            message: valid ? "Budha within ±1 house of Ravi" : "Budha must be within ±1 house of Ravi",
        };
    }

    let sikuru: ValidationResult;
    if (raviHouse === undefined) {
        sikuru = { status: "skipped", message: "Place Ravi first" };
    } else if (sikuruHouse === undefined) {
        sikuru = { status: "skipped", message: "Sikuru not placed" };
    } else {
        const diff = mod12(sikuruHouse - raviHouse);
        const valid = diff === 0 || diff === 1 || diff === 2 || diff === 10 || diff === 11;
        sikuru = {
            status: valid ? "valid" : "invalid",
            message: valid ? "Sikuru within ±2 houses of Ravi" : "Sikuru must be within ±2 houses of Ravi",
        };
    }

    let rahuKethuAxis: ValidationResult;
    if (rahuHouse === undefined || ketuHouse === undefined) {
        rahuKethuAxis = { status: "incomplete", message: "Both Rahu and Ketu must be placed" };
    } else {
        const gap = (((ketuHouse - rahuHouse) % 12) + 12) % 12;
        const valid = gap === 6;
        rahuKethuAxis = {
            status: valid ? "valid" : "invalid",
            message: valid ? "Rahu and Ketu opposite houses (6 apart)" : "Rahu and Ketu must be exactly 6 houses apart",
        };
    }

    const navamsaEntered = navamsaActive;
    const planetCount = buildPlanetCountValidation(Object.keys(houseOfPlanet).length, true);
    const navamsaPlanetCount = buildPlanetCountValidation(
        navamsaEntered ? new Set(Object.values(navamsaPlacements ?? {}).flat()).size : 0,
        navamsaEntered,
    );

    return { budha, sikuru, rahuKethuAxis, planetCount, navamsaPlanetCount };
}

/** Build a "N / 9 planets placed" validation result. When `active` is false (e.g. the optional
 *  navamsa chart is not entered), the result is `skipped` so it doesn't demand all 9 planets. */
function buildPlanetCountValidation(count: number, active: boolean): ValidationResult {
    if (!active) {
        return { status: "skipped", message: "Placements not entered", count: 0 };
    }
    const status: ValidationStatus = count === 9 ? "valid" : "incomplete";
    return {
        status,
        message: count === 9 ? "All 9 planets placed" : `${count}/9 planets placed`,
        count,
    };
}

const EXALTATION: Record<number, number> = {
    1: 1,
    2: 2,
    3: 10,
    4: 6,
    5: 4,
    6: 12,
    7: 7,
};

const DEBILITATION: Record<number, number> = {
    1: 7,
    2: 8,
    3: 4,
    4: 12,
    5: 10,
    6: 6,
    7: 1,
};

const OWN_SIGNS: Record<number, number[]> = {
    1: [5],
    2: [4],
    3: [1, 8],
    4: [3, 6],
    5: [9, 12],
    6: [2, 7],
    7: [10, 11],
};

const EXALTATION_DEGREE: Record<number, number> = {
    1: 10,
    2: 3,
    3: 28,
    4: 15,
    5: 5,
    6: 27,
    7: 20,
};

const MOOLATRIKONA_RANGE: Record<number, { sign: number; start: number; end: number } | null> = {
    1: { sign: 5, start: 0, end: 20 },
    2: null,
    3: { sign: 1, start: 0, end: 12 },
    4: { sign: 6, start: 16, end: 20 },
    5: { sign: 9, start: 0, end: 10 },
    6: { sign: 7, start: 0, end: 15 },
    7: { sign: 11, start: 0, end: 20 },
};

/** Sign-based planetary strength (exaltation/debilitation/moolatrikona/own sign/friend/enemy/sama).
 *  Degree is only used for the deep exaltation/debilitation nuance; default 0 means "somewhere in the sign". */
export function computePlanetStrength(planet: number, sign: number, degree = 0): PlanetaryStrength {
    const deepDeg = EXALTATION_DEGREE[planet];
    if (EXALTATION[planet] === sign && deepDeg !== undefined && Math.abs(degree - deepDeg) < 1)
        return PlanetaryStrength.ATHI_UCHCHA;
    if (EXALTATION[planet] === sign) return PlanetaryStrength.UCHCHA;
    if (DEBILITATION[planet] === sign && deepDeg !== undefined && Math.abs(degree - deepDeg) < 1)
        return PlanetaryStrength.ATHI_NEECHA;
    if (DEBILITATION[planet] === sign) return PlanetaryStrength.NEECHA;
    const mRange = MOOLATRIKONA_RANGE[planet];
    if (mRange && mRange.sign === sign && degree >= mRange.start && degree < mRange.end)
        return PlanetaryStrength.MOOLATRIKONA;
    if (OWN_SIGNS[planet]?.includes(sign)) return PlanetaryStrength.OWN_SIGN;
    const signLord = SIGN_LORD[sign];
    if (NATURAL_FRIENDS[planet]?.includes(signLord)) return PlanetaryStrength.MITRA;
    if (NATURAL_ENEMIES[planet]?.includes(signLord)) return PlanetaryStrength.SHATRU;
    return PlanetaryStrength.SAMA;
}

const NAVAMSA_ARC = 30 / 9;
const NAKSHATRA_ARC = 360 / 27;
const PADA_ARC = NAKSHATRA_ARC / 4;

/** The Navamsa Lagna implied by an ascendant degree within the birth sign: which 3°20' wedge
 *  (1-9, `navamsaSign`) contains the given degree 0 ≤ d < 30. Always one of `navamsaLagnaOptions`. */
export function deriveNavamsaLagnaFromDegree(birthSign: number, degreeInSign: number): number {
    const clamped = Math.min(Math.max(degreeInSign, 0), 29.9999);
    const wedge = Math.floor(clamped / NAVAMSA_ARC) + 1;
    return navamsaSign(birthSign, wedge);
}

/** The 9 navamsa signs that belong to a given source sign (the Navamsa Lagna must be one of these).
 *  Returns them in ascending zodiac order. */
export function navamsaLagnaOptions(sourceSign: number): number[] {
    return Array.from({ length: 9 }, (_, i) => navamsaSign(sourceSign, i + 1)).sort((a, b) => a - b);
}

export function navamsaIndexForSign(birthSign: number, navamsaSignValue: number): number {
    for (let idx = 1; idx <= 9; idx++) {
        if (navamsaSign(birthSign, idx) === navamsaSignValue) return idx;
    }
    return 1;
}

/** Ascendant (Lagna) Nakshatra for a manual horoscope. Uses the absolute ascendant degree derived
 *  from `lagnaDegree` when recorded, otherwise the midpoint of the navamsa wedge implied by the
 *  stored navamsa lagna (matching `getAscendantAbsDeg`). Falls back to the sign midpoint (15°) when
 *  neither a degree nor a navamsa lagna is recorded. */
export function computeAscendantNakshatra(mhp: { lagna: number; lagnaDegree?: number; navamsaLagna?: number }): {
    id: number;
    pada: number;
    lord: number;
} {
    const { lagna, lagnaDegree, navamsaLagna } = mhp;
    let absDegree: number;
    if (lagnaDegree !== undefined) {
        absDegree = (lagna - 1) * 30 + lagnaDegree;
    } else if (navamsaLagna !== undefined) {
        const index = navamsaIndexForSign(lagna, navamsaLagna);
        absDegree = (lagna - 1) * 30 + (index - 0.5) * NAVAMSA_ARC;
    } else {
        absDegree = (lagna - 1) * 30 + 15;
    }
    return nakshatraDetails(absDegree);
}

/** Moon (Chandra) Nakshatra for a manual horoscope. Manual charts don't record the Moon's exact
 *  degree — only its birth house and (optionally) its navamsa segment — so it's derived from the
 *  Moon's absolute birth degree: the navamsa-segment midpoint inferred from the Moon's navamsa sign,
 *  or the sign midpoint (15°) when no navamsa data exists. */
export function computeMoonNakshatra(
    birthSign: number,
    navamsaSignForMoon?: number,
): { id: number; pada: number; lord: number } {
    let absDegree: number;
    if (navamsaSignForMoon !== undefined) {
        const index = navamsaIndexForSign(birthSign, navamsaSignForMoon);
        absDegree = (birthSign - 1) * 30 + (index - 0.5) * NAVAMSA_ARC;
    } else {
        absDegree = (birthSign - 1) * 30 + 15;
    }
    return nakshatraDetails(absDegree);
}

/** Vimshottari nakshatra lords, ordered 1..27 (same cycle as the auto pipeline: Ketu, Venus, Sun,
 *  Moon, Mars, Rahu, Jupiter, Saturn, Mercury). Lord for nakshatra id `n` is this[index]. */
const NAKSHATRA_LORDS = Array.from({ length: 27 }, (_, i) => [9, 6, 1, 2, 3, 8, 5, 7, 4][i % 9]);

function nakshatraDetails(absoluteDegree: number): { id: number; pada: number; lord: number } {
    const { nakshatra, pada } = nakshatraAndPada(absoluteDegree);
    return { id: nakshatra, pada, lord: NAKSHATRA_LORDS[nakshatra - 1] };
}

/** Vimshottari Mahadasha years per planet, matching the auto pipeline (Ketu 7, Venus 20, Sun 6,
 *  Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17). */
const VIMSHOTTARI_YEARS: Record<number, number> = {
    9: 7,
    6: 20,
    1: 6,
    2: 10,
    3: 7,
    8: 18,
    5: 16,
    7: 19,
    4: 17,
};

const VIMSHOTTARI_CYCLE_PLANETS = [9, 6, 1, 2, 3, 8, 5, 7, 4];

const TOTAL_VIMSHOTTARI_YEARS = 120;

const DASHA_DAYS_PER_YEAR = 365.25;

function getVimshottariYears(planet: number): number {
    return VIMSHOTTARI_YEARS[planet] ?? 0;
}

function vimshottariStartIndex(planet: number): number {
    const index = VIMSHOTTARI_CYCLE_PLANETS.indexOf(planet);
    return index === -1 ? 0 : index;
}

function vimshottariCycle(startIndex: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => VIMSHOTTARI_CYCLE_PLANETS[(startIndex + i) % 9]);
}

function addDashaYears(date: Date, years: number): Date {
    return new Date(date.getTime() + years * DASHA_DAYS_PER_YEAR * 24 * 60 * 60 * 1000);
}

function dashaYearsBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / (DASHA_DAYS_PER_YEAR * 24 * 60 * 60 * 1000);
}

function formatDashaDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Vimshottari Mahadasha sequence for a manual horoscope, derived from the Moon's nakshatra + pada.
 *  The Moon's longitude is estimated at the midpoint of its pada (`(pada-0.5)*PADA_ARC` within the
 *  nakshatra), so the starting Mahadasha lord is the nakshatra's Vimshottari lord and its balance is
 *  `lordYears * (1 - (pada-0.5)/4)` — e.g. the 2nd pada of Mula starts Ketu dasha with a remaining
 *  `7 - 7*1.5/4 = 4.375` years. When a `birthDate` is provided the start/end dates and ages are
 *  anchored to it (mirroring the auto pipeline); otherwise the sequence is duration-only with empty
 *  date strings. Antardashas are proportional to each Mahadasha's full period. */
export function calculateManualDashas(moonNakshatraId: number, pada: number, birthDate?: Date | null): DashaInfo {
    const degInNakshatra = (pada - 0.5) * PADA_ARC;
    const balanceFraction = (NAKSHATRA_ARC - degInNakshatra) / NAKSHATRA_ARC;
    const lord = NAKSHATRA_LORDS[moonNakshatraId - 1] ?? 9;
    const firstYears = +(getVimshottariYears(lord) * balanceFraction).toFixed(4);
    const startIndex = vimshottariStartIndex(lord);
    const hasDate = !!birthDate;
    const epoch = birthDate ?? new Date(0);

    const mahadashaList: Mahadasha[] = [];
    let currentDate = new Date(epoch);

    for (let mi = 0; mi < 9; mi++) {
        const planet = VIMSHOTTARI_CYCLE_PLANETS[(startIndex + mi) % 9];
        const fullYears = getVimshottariYears(planet);
        const mdYears = mi === 0 ? firstYears : fullYears;

        const mdStart = new Date(currentDate);
        const mdEnd = addDashaYears(mdStart, mdYears);

        // For the first Mahadasha, the antardasha running at birth is found by locating where the
        // elapsed portion (before birth) falls within the full AD sequence.
        let adStartOffset = 0;
        if (mi === 0 && firstYears < fullYears) {
            const elapsedBeforeBirth = fullYears - firstYears;
            let cumulative = 0;
            for (let ai = 0; ai < 9; ai++) {
                const adPlanet = VIMSHOTTARI_CYCLE_PLANETS[(startIndex + ai) % 9];
                cumulative += (fullYears * getVimshottariYears(adPlanet)) / TOTAL_VIMSHOTTARI_YEARS;
                if (cumulative > elapsedBeforeBirth) {
                    adStartOffset = ai;
                    break;
                }
            }
        }

        const fullAdPlanets = vimshottariCycle(vimshottariStartIndex(planet), 9);
        const adPlanets =
            adStartOffset === 0
                ? fullAdPlanets
                : [...fullAdPlanets.slice(adStartOffset), ...fullAdPlanets.slice(0, adStartOffset)];

        const antardasha: Antardasha[] = [];
        let adDate = new Date(mdStart);
        for (let ai = 0; ai < adPlanets.length; ai++) {
            const remainingFromStart = dashaYearsBetween(adDate, mdEnd);
            if (remainingFromStart <= 0.0001) break;

            const adLord = adPlanets[ai];
            const adFullYears = (fullYears * getVimshottariYears(adLord)) / TOTAL_VIMSHOTTARI_YEARS;
            const isLastAd = ai === adPlanets.length - 1;
            let adEnd = addDashaYears(adDate, adFullYears);
            if (isLastAd) adEnd = new Date(mdEnd);
            else if (adEnd > mdEnd) adEnd = new Date(mdEnd);

            const adYears = dashaYearsBetween(adDate, adEnd);
            const adMonths = Math.round(adYears * 12);
            if (adMonths < 1 && !isLastAd) {
                adDate = new Date(adEnd);
                continue;
            }

            antardasha.push({
                planet: adLord,
                startDate: hasDate ? formatDashaDate(adDate) : "",
                endDate: hasDate ? formatDashaDate(adEnd) : "",
                durationMonths: adMonths,
                vidasa: [],
                startAge: dashaYearsBetween(epoch, adDate),
            });
            adDate = new Date(adEnd);
        }

        mahadashaList.push({
            planet,
            startDate: hasDate ? formatDashaDate(mdStart) : "",
            endDate: hasDate ? formatDashaDate(mdEnd) : "",
            durationYears: mdYears,
            remainingYearsAtBirth: mi === 0 ? firstYears : 0,
            antardasha,
            startAge: dashaYearsBetween(epoch, mdStart),
        });

        currentDate = new Date(mdEnd);
    }

    const currentPeriod: CurrentPeriod = {
        mahadashaLord: mahadashaList[0].planet,
        antardashaLord: mahadashaList[0].antardasha[0]?.planet ?? mahadashaList[0].planet,
        vidasaLord: null,
        sukshamaLord: null,
        pranaLord: null,
    };

    if (hasDate) {
        const now = new Date();
        for (const md of mahadashaList) {
            if (now >= new Date(md.startDate) && now < new Date(md.endDate)) {
                currentPeriod.mahadashaLord = md.planet;
                for (const ad of md.antardasha) {
                    if (now >= new Date(ad.startDate) && now < new Date(ad.endDate)) {
                        currentPeriod.antardashaLord = ad.planet;
                        break;
                    }
                }
                break;
            }
        }
    }

    return { mahadasha: mahadashaList, currentPeriod };
}

function nakshatraAndPada(absoluteDegree: number): { nakshatra: number; pada: number } {
    const normalized = ((absoluteDegree % 360) + 360) % 360;
    const nakNum = Math.floor(normalized / NAKSHATRA_ARC);
    const within = normalized - nakNum * NAKSHATRA_ARC;
    const pada = Math.floor(within / PADA_ARC + 1e-10) + 1;
    return { nakshatra: nakNum + 1, pada };
}

/** Build the navamsa enrichment rows for planets that have both a birth sign and a navamsa sign.
 *  The degree range within the birth sign is the navamsa segment (each = 3°20'), and Nakshatra/Pada
 *  are derived from that segment's midpoint. */
export function deriveNavamsaData(
    planetBirthSigns: Record<number, number>,
    planetNavamsaSigns: Record<number, number>,
): NavamsaEnrichment[] {
    const result: NavamsaEnrichment[] = [];
    for (const [planetKey, birthSign] of Object.entries(planetBirthSigns)) {
        const planet = Number(planetKey);
        const navSign = planetNavamsaSigns[planet];
        if (navSign === undefined) continue;
        const navamsaIndex = navamsaIndexForSign(birthSign, navSign);
        const start = (navamsaIndex - 1) * NAVAMSA_ARC;
        const end = navamsaIndex * NAVAMSA_ARC;
        const midpoint = (start + end) / 2;
        const absoluteDegreeMidpoint = (birthSign - 1) * 30 + midpoint;
        const { nakshatra, pada } = nakshatraAndPada(absoluteDegreeMidpoint);
        result.push({
            planet,
            navamsaIndex,
            navamsaSign: navSign,
            navamsaStrength: computePlanetStrength(planet, navSign, 0),
            degreeRangeStart: start,
            degreeRangeEnd: end,
            nakshatra,
            pada,
            absoluteDegreeMidpoint,
        });
    }
    return result;
}

function computeDrekkanaLord(ascSign: number, ascDegree: number): number {
    const ascDrekkanaNum = Math.floor(ascDegree / 10) + 1;
    const houseOffset = ascDrekkanaNum === 1 ? 8 : ascDrekkanaNum === 2 ? 12 : 4;
    const houseSign = ((ascSign - 1 + houseOffset - 1) % 12) + 1;
    return SIGN_LORD[houseSign] || 1;
}

function computeNavamsaLord(ascSign: number, ascDegree: number): number {
    const ascNavamsaNum = Math.floor(ascDegree / (30 / 9)) + 1;
    const d9Lagna = navamsaSign(ascSign, ascNavamsaNum);
    const fourthHouseSign = ((d9Lagna - 1 + 3) % 12) + 1;
    return SIGN_LORD[fourthHouseSign] || 1;
}

export interface PlanetsTableInput {
    lagna: number;
    houseOfPlanet: Record<number, number>;
    navamsaEnrichment?: NavamsaEnrichment[];
    aspectOptions?: ManualAspectOptions;
}

/** Derive the read-only planets table from house placements. Sign comes from the house, strength is
 *  sign-based (exaltation/debilitation/moolatrikona/own/friend/enemy/sama at degree 0), conjunctions/aspects
 *  from the shared rules, and "Other" carries the 22nd Drekkana Lord / 64th Navamsa Lord / Atmakaraka tags. */
export function derivePlanetsTable(input: PlanetsTableInput): ManualPlanetRow[] {
    const { lagna, houseOfPlanet, navamsaEnrichment = [], aspectOptions } = input;
    const houseSigns = deriveHouseSigns(lagna);
    const conjunctions = computeConjunctions(houseOfPlanet);
    const aspectsByPlanet = computeAspects(houseOfPlanet, houseSigns, aspectOptions);
    const planetsByHouse: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        (planetsByHouse[house] ??= []).push(Number(planetKey));
    }
    const enrichmentByPlanet: Record<number, NavamsaEnrichment> = {};
    for (const e of navamsaEnrichment) enrichmentByPlanet[e.planet] = e;

    const ascDegree = 0;
    const lord22ndDrekkana = computeDrekkanaLord(lagna, ascDegree);
    const lord64thNavamsa = computeNavamsaLord(lagna, ascDegree);
    const maranakaraka = computeMaranakaraka(
        Object.entries(houseOfPlanet).map(([name, house]) => ({ name: Number(name), house, absoluteDegree: 0 })),
    );
    const yogakaraka = computeYogakaraka(lagna);
    let atmakaraka: number | null = null;
    if (navamsaEnrichment.length > 0) {
        let maxAbs = -1;
        for (const e of navamsaEnrichment) {
            if (e.planet === Planet.RAHU || e.planet === Planet.KETU) continue;
            if (e.absoluteDegreeMidpoint > maxAbs) {
                maxAbs = e.absoluteDegreeMidpoint;
                atmakaraka = e.planet;
            }
        }
    }

    return Object.entries(houseOfPlanet)
        .map(([planetKey, house]) => {
            const planet = Number(planetKey);
            const sign = houseSigns[house - 1];
            const other: string[] = [];
            if (lord22ndDrekkana === planet) other.push("lord22ndDrekkana");
            if (lord64thNavamsa === planet) other.push("lord64thNavamsa");
            if (atmakaraka === planet) other.push("atmakaraka");
            if (maranakaraka.includes(planet)) other.push("maranakaraka");
            if (yogakaraka.includes(planet)) other.push("yogakaraka");
            return {
                planet,
                sign,
                strength: computePlanetStrength(planet, sign, 0),
                house,
                conjunctions: conjunctions[planet] ?? [],
                aspectsPlanets: (aspectsByPlanet[planet] ?? []).flatMap((h) => planetsByHouse[h] ?? []),
                other,
                navamsa: enrichmentByPlanet[planet],
            };
        })
        .sort((a, b) => a.house - b.house || a.planet - b.planet);
}

/** Probable birth time range from Ravi's house (see BIRTH_TIME_RANGES for the house→time mapping). */
export function deriveBirthTimeRange(raviHouse: number): { start: string; end: string } | null {
    const range = BIRTH_TIME_RANGES[raviHouse];
    return range ? { ...range } : null;
}

/** Probable birth month range from Ravi's sign. 15th-day anchor, +1 month per sign, wraps at Meena. */
export function deriveBirthMonthRange(raviSign: number): DerivedRanges["birthMonthRange"] {
    const range = BIRTH_MONTH_RANGES[raviSign];
    return range ? { start: { ...range.start }, end: { ...range.end } } : null;
}

/** Probable birth date candidates from Ravi's navamsa index (0-based): `12 + n*3` and `17 + (4 + n*3)`. */
export function deriveBirthDateCandidates(raviNavamsaIndex: number): BirthDateCandidate[] {
    const { base1, increment1, base2, secondOffset } = BIRTH_DATE_BASE;
    const day1 = base1 + increment1 * raviNavamsaIndex;
    const secondIncrement = secondOffset + increment1 * raviNavamsaIndex;
    const day2 = base2 + secondIncrement;
    return [
        {
            navamsaIndex: raviNavamsaIndex,
            candidateDay: day1,
            reasoning: `${base1} + ${increment1 * raviNavamsaIndex}`,
        },
        {
            navamsaIndex: raviNavamsaIndex,
            candidateDay: day2,
            reasoning: `${base2} + ${secondIncrement}`,
        },
    ];
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Fuse the birth month range and the two candidate days into a single {start, end} date range.
 *  The anchors live in the month-range's start month: the first candidate is the start day, the
 *  second candidate rolls over month boundaries (e.g. candidate 36 anchored in March → April 5). */
export function deriveBirthDateRange(
    birthMonthRange: { start: { month: number; day: number }; end: { month: number; day: number } } | null | undefined,
    birthDateCandidates: BirthDateCandidate[],
): { start: { month: number; day: number }; end: { month: number; day: number } } | null {
    if (!birthMonthRange || birthDateCandidates.length < 2) return null;
    const anchorMonth = birthMonthRange.start.month;
    const roll = (day: number): { month: number; day: number } => {
        let month = anchorMonth;
        let dayOfMonth = day;
        while (dayOfMonth > DAYS_IN_MONTH[month - 1]) {
            dayOfMonth -= DAYS_IN_MONTH[month - 1];
            month = (month % 12) + 1;
        }
        return { month, day: dayOfMonth };
    };
    return { start: roll(birthDateCandidates[0].candidateDay), end: roll(birthDateCandidates[1].candidateDay) };
}

/** Probable age ranges from Shani's birth navamsa and current Shani position.
 *  Shani travels ~1° per month (~30 months per sign, forward through the zodiac). The age is the
 *  time for Shani to move from its birth sign to its current sign:
 *  months-to-exit-birth-sign + 30 × (complete signs crossed) + months into the current sign.
 *  2nd/3rd ages add 30 years each. Negative intermediates clamp to 0 with a warning flag. */
export function deriveAgeRanges(
    shaniBirthNavamsa: number,
    currentShaniDegree: number,
    currentShaniSign: number,
    birthShaniSign: number,
): AgeRange[] {
    const monthsToNextSign = shaniBirthNavamsa <= 1 ? SHANI_MONTHS_FOR_SIGN.default : SHANI_MONTHS_FOR_SIGN.alternate;
    const completedMonths = Math.max(0, Math.round(currentShaniDegree));
    // Forward distance in signs from the birth sign to the current sign (0 when Shani hasn't left it).
    const forwardGap = (((currentShaniSign - birthShaniSign) % 12) + 12) % 12;
    const signGapMonths = 30 * (forwardGap - 1);

    let firstMonths = monthsToNextSign + completedMonths + signGapMonths;
    const warning = firstMonths < 0;
    if (warning) firstMonths = 0;

    const secondMonths = firstMonths + 30 * 12;
    const thirdMonths = secondMonths + 30 * 12;

    return [
        { age: 1, valueMonths: firstMonths, valueYears: +(firstMonths / 12).toFixed(1), warning },
        { age: 2, valueMonths: secondMonths, valueYears: +(secondMonths / 12).toFixed(1), warning },
        { age: 3, valueMonths: thirdMonths, valueYears: +(thirdMonths / 12).toFixed(1), warning },
    ];
}

/** Aggregate all four derived birth ranges. `currentShani` is optional (server provides it when it
 *  can compute the current transit; the client preview skips ages until then). */
export function deriveRanges(
    lagna: number,
    houseOfPlanet: Record<number, number>,
    navamsaEnrichment: NavamsaEnrichment[],
    currentShani?: CurrentShani | null,
): DerivedRanges {
    const houseSigns = deriveHouseSigns(lagna);
    const raviHouse = houseOfPlanet[Planet.SUN];
    const shaniHouse = houseOfPlanet[Planet.SATURN];
    const raviNavamsa = navamsaEnrichment.find((e) => e.planet === Planet.SUN);
    const shaniNavamsa = navamsaEnrichment.find((e) => e.planet === Planet.SATURN);

    return {
        birthTimeRange: raviHouse !== undefined ? deriveBirthTimeRange(raviHouse) : null,
        birthMonthRange: raviHouse !== undefined ? deriveBirthMonthRange(houseSigns[raviHouse - 1]) : null,
        birthDateCandidates: raviNavamsa ? deriveBirthDateCandidates(raviNavamsa.navamsaIndex - 1) : [],
        ageRanges:
            currentShani && shaniHouse !== undefined && shaniNavamsa
                ? deriveAgeRanges(
                      shaniNavamsa.navamsaIndex,
                      currentShani.degree,
                      currentShani.sign,
                      houseSigns[shaniHouse - 1],
                  )
                : [],
    };
}

/** Main entry point: derives houses, validation, planets table, navamsa enrichment, and birth ranges
 *  from the raw house placements. Pure and deterministic — used by both the client editor (live
 *  preview) and the server (persist). `currentShani` (when provided) unlocks the age-range row. */
export function compute(input: ManualChartInput, currentShani?: CurrentShani | null): ManualChartResult {
    const houseOfPlanet = placementsToMap(input.houses);
    const houseSigns = deriveHouseSigns(input.lagna);
    const aspectOptions = input.aspectOptions;

    let navamsaHouses: ManualHouse[] = [];
    let navamsaEnrichment: NavamsaEnrichment[] = [];
    const navamsaLagna = input.navamsaLagna;
    const navamsaActive =
        navamsaLagna &&
        navamsaLagna >= 1 &&
        navamsaLagna <= 12 &&
        input.navamsaHouses &&
        Object.keys(input.navamsaHouses).length > 0;
    const navHouseOfPlanet = navamsaActive ? placementsToMap(input.navamsaHouses ?? {}) : undefined;
    const navHouseSigns = navamsaActive ? deriveHouseSigns(navamsaLagna as number) : undefined;

    // Resolve navamsa-sign fallback for the aspect degree arm, then thread through both charts.
    let navamsaSigns: Record<number, number> | undefined;
    if (navamsaActive && navHouseOfPlanet && navHouseSigns) {
        navamsaSigns = {};
        for (const [planetKey, navHouse] of Object.entries(navHouseOfPlanet)) {
            navamsaSigns[Number(planetKey)] = navHouseSigns[navHouse - 1];
        }
        const planetBirthSigns: Record<number, number> = {};
        for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
            planetBirthSigns[Number(planetKey)] = houseSigns[house - 1];
        }
        navamsaEnrichment = deriveNavamsaData(planetBirthSigns, navamsaSigns);
    }
    const resolvedOptions: ManualAspectOptions | undefined = aspectOptions
        ? { ...aspectOptions, ...(navamsaSigns ? { navamsaSigns } : {}) }
        : undefined;

    const houses = buildHouses(input.lagna, houseOfPlanet, resolvedOptions);
    const validation = validatePlacements(houseOfPlanet, input.navamsaHouses, !!navamsaLagna);
    if (navamsaActive && navHouseOfPlanet) {
        navamsaHouses = buildHouses(navamsaLagna as number, navHouseOfPlanet, resolvedOptions);
    }

    const planetsTable = derivePlanetsTable({
        lagna: input.lagna,
        houseOfPlanet,
        navamsaEnrichment,
        aspectOptions: resolvedOptions,
    });
    const derivedRanges = deriveRanges(input.lagna, houseOfPlanet, navamsaEnrichment, currentShani);

    return {
        manualHousePlacements: {
            lagna: input.lagna,
            lagnaDegree: input.lagnaDegree,
            navamsaLagna,
            houses,
            navamsaHouses: navamsaHouses.length > 0 ? navamsaHouses : undefined,
            validation,
        },
        planetsTable,
        navamsaEnrichment,
        derivedRanges,
        aspectOptions: resolvedOptions,
    };
}

/** Probable birth time range per house (US-CH-009 business rule). The Sun is in the 1st house at
 *  sunrise (~06:00) and moves "backward" through the houses as the ascendant advances one sign every
 *  ~2 hours across the day: house 1 @ sunrise, 12 @ ~08:00, 11 @ ~10:00, ... 7 @ sunset (~18:00),
 *  ..., 2 @ ~04:00. So the 3rd house is the night window 01:00–03:00. */
export const BIRTH_TIME_RANGES: Record<number, { start: string; end: string }> = {
    1: { start: "05:00", end: "07:00" },
    2: { start: "03:00", end: "05:00" },
    3: { start: "01:00", end: "03:00" },
    4: { start: "23:00", end: "01:00" },
    5: { start: "21:00", end: "23:00" },
    6: { start: "19:00", end: "21:00" },
    7: { start: "17:00", end: "19:00" },
    8: { start: "15:00", end: "17:00" },
    9: { start: "13:00", end: "15:00" },
    10: { start: "11:00", end: "13:00" },
    11: { start: "09:00", end: "11:00" },
    12: { start: "07:00", end: "09:00" },
};

/** Probable birth month range per sign (US-CH-010 business rule). */
export const BIRTH_MONTH_RANGES: Record<
    number,
    { start: { month: number; day: number }; end: { month: number; day: number } }
> = {
    1: { start: { month: 4, day: 15 }, end: { month: 5, day: 15 } },
    2: { start: { month: 5, day: 15 }, end: { month: 6, day: 15 } },
    3: { start: { month: 6, day: 15 }, end: { month: 7, day: 15 } },
    4: { start: { month: 7, day: 15 }, end: { month: 8, day: 15 } },
    5: { start: { month: 8, day: 15 }, end: { month: 9, day: 15 } },
    6: { start: { month: 9, day: 15 }, end: { month: 10, day: 15 } },
    7: { start: { month: 10, day: 15 }, end: { month: 11, day: 15 } },
    8: { start: { month: 11, day: 15 }, end: { month: 12, day: 15 } },
    9: { start: { month: 12, day: 15 }, end: { month: 1, day: 15 } },
    10: { start: { month: 1, day: 15 }, end: { month: 2, day: 15 } },
    11: { start: { month: 2, day: 15 }, end: { month: 3, day: 15 } },
    12: { start: { month: 3, day: 15 }, end: { month: 4, day: 15 } },
};

/** Probable birth date candidate formula (US-CH-011): 1st candidate `12 + n*3`, 2nd `17 + (4 + n*3)`. */
export const BIRTH_DATE_BASE = { base1: 12, increment1: 3, base2: 17, secondOffset: 4 };

/** Months Shani needs to cross a sign for the age formula (US-CH-012). */
export const SHANI_MONTHS_FOR_SIGN = { default: 30, alternate: 27 };

/** Format a navamsa-segment degree range as `DD:MM–DD:MM` (values may exceed 30° for the 11th/12th segments). */
export function formatNavamsaDegreeRange(start: number, end: number): string {
    const fmt = (deg: number): string => {
        const total = Math.round(deg * 60);
        const anshaka = Math.floor(total / 60);
        const kala = total % 60;
        return `${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}`;
    };
    return `${fmt(start)}–${fmt(end)}`;
}

/** Exported for the API layer: builds whole-sign House objects from a lagna (for the current-planets call). */
export function buildWholeSignHouses(lagna: number): import("@/lib/astrology").House[] {
    const houseSigns = deriveHouseSigns(lagna);
    return houseSigns.map((sign, i) => {
        const nextSign = (sign % 12) + 1;
        return {
            houseNumber: i + 1,
            startDegree: 0,
            startSign: sign,
            startLord: SIGN_LORD[sign] || 1,
            middleDegree: 15,
            middleSign: sign,
            middleLord: SIGN_LORD[sign] || 1,
            endDegree: 0,
            endSign: nextSign,
            endLord: SIGN_LORD[nextSign] || 1,
            sign,
            lord: SIGN_LORD[sign] || 1,
        };
    });
}

/** Builds the house chart (bhava) House objects for a manual horoscope, anchored so house 1's
 *  middle line coincides exactly with the ascendant (lagna) line at `ascAbsDeg`. Each house is a
 *  30° span centered on its middle line (the lagna degree rotated +30° per house): start cusp =
 *  middle − 15°, end cusp = middle + 15°. The cusps therefore track the ascendant's navamsa
 *  position — the calc-tab Start/Mid/End segments are derived from these same boundaries. */
export function buildBhavaHouses(lagna: number, ascAbsDeg: number): import("@/lib/astrology").House[] {
    return Array.from({ length: 12 }, (_, i) => {
        const houseNumber = i + 1;
        const sign = ((lagna - 1 + i) % 12) + 1;
        const midAbs = (((ascAbsDeg + i * 30) % 360) + 360) % 360;
        const startAbs = (((midAbs - 15) % 360) + 360) % 360;
        const endAbs = (((midAbs + 15) % 360) + 360) % 360;
        const startSign = Math.floor(startAbs / 30) + 1;
        const endSign = Math.floor(endAbs / 30) + 1;
        const midSign = Math.floor(midAbs / 30) + 1;
        return {
            houseNumber,
            startDegree: startAbs % 30,
            startSign,
            startLord: SIGN_LORD[startSign] || 1,
            middleDegree: midAbs % 30,
            middleSign: midSign,
            middleLord: SIGN_LORD[midSign] || 1,
            endDegree: endAbs % 30,
            endSign,
            endLord: SIGN_LORD[endSign] || 1,
            sign,
            lord: SIGN_LORD[sign] || 1,
        };
    });
}

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

const GANDAMULA_NAKSHATRAS = new Set([1, 10, 19]);
const GANDANTHA_NAKSHATRAS = new Set([9, 18, 27]);

export function computeBadhaka(ascSign: number): number[] {
    const isMovable = [1, 4, 7, 10].includes(ascSign);
    const isFixed = [2, 5, 8, 11].includes(ascSign);
    const badhakaHouse = isMovable ? 11 : isFixed ? 9 : 7;
    const badhakaSign = ((ascSign + badhakaHouse - 2) % 12) + 1;
    return [SIGN_LORD[badhakaSign] || 1];
}

export function computeMaraka(ascSign: number): number[] {
    const secondSign = (ascSign % 12) + 1;
    const seventhSign = ((ascSign + 6 - 1) % 12) + 1;
    return [SIGN_LORD[secondSign] || 1, SIGN_LORD[seventhSign] || 1];
}

export function computeAtmakaraka(planets: AstroPlanet[]): number {
    let maxDeg = -1;
    let atmakaraka = 1;
    for (const p of planets) {
        if (p.name === 8 || p.name === 9) continue;
        if (p.degree > maxDeg) {
            maxDeg = p.degree;
            atmakaraka = p.name;
        }
    }
    return atmakaraka;
}

function computeWargoththama(planets: AstroPlanet[]): number[] {
    return planets.filter((p) => p.sign === p.navamsaSign).map((p) => p.name);
}

function computeGandantha(planets: AstroPlanet[]): number[] {
    return planets.filter((p) => GANDANTHA_NAKSHATRAS.has(p.nakshatra) && p.pada === 4).map((p) => p.name);
}

function computeGandamula(planets: AstroPlanet[]): number[] {
    return planets.filter((p) => GANDAMULA_NAKSHATRAS.has(p.nakshatra) && p.pada === 1).map((p) => p.name);
}

function computePushkara(planets: AstroPlanet[]): number[] {
    return planets.filter((p) => PUSHKARA_NAVAMSA_SIGNS[p.sign]?.includes(p.navamsaSign)).map((p) => p.name);
}

function nthHouseSignFrom(houseSign: number, offset: number): number {
    return ((houseSign - 1 + offset - 1) % 12) + 1;
}

function computeNidhanamsha(
    ascSign: number,
    ascNavamsaLagna: number,
    houses: House[],
    planets: AstroPlanet[],
): number[] {
    const eighthHouseSign = houses.find((h) => h.houseNumber === 8)?.sign ?? nthHouseSignFrom(ascSign, 8);
    const nidhanamshaHouse = ((eighthHouseSign - ascNavamsaLagna + 12) % 12) + 1;
    return planets
        .filter((p) => ((p.navamsaSign - ascNavamsaLagna + 12) % 12) + 1 === nidhanamshaHouse)
        .map((p) => p.name);
}

function computeAshtamansha(
    ascSign: number,
    ascNavamsaLagna: number,
    houses: House[],
    planets: AstroPlanet[],
): number[] {
    return planets
        .filter((p) => {
            const eighthHouseNumber = ((p.house + 6) % 12) + 1;
            const eighthHouseSign = houses.find((h) => h.houseNumber === eighthHouseNumber)?.sign ?? p.sign;
            const ashtamanshaSignHouse = ((eighthHouseSign - ascNavamsaLagna + 12) % 12) + 1;
            return ((p.navamsaSign - ascNavamsaLagna + 12) % 12) + 1 === ashtamanshaSignHouse;
        })
        .map((p) => p.name);
}

/** Recompute placement validation from the source-of-truth stored `houses` (a `ManualHouse[]`).
 *  Older horoscopes persisted stale/invalid `validation` computed under earlier rules, so the view
 *  recomputes it at render time from the actual house placements. */
export function synthesizeValidation(manualHousePlacements: {
    lagna: number;
    navamsaLagna?: number;
    houses?: ManualHouse[];
    navamsaHouses?: ManualHouse[] | null;
}): PlacementValidation {
    const houseOfPlanet: Record<number, number> = {};
    for (const house of manualHousePlacements.houses ?? []) {
        for (const planet of house.planets) houseOfPlanet[planet] = house.houseNumber;
    }
    const navamsaPlacements: Record<number, number[]> = {};
    for (const house of manualHousePlacements.navamsaHouses ?? []) {
        navamsaPlacements[house.houseNumber] = house.planets;
    }
    const navamsaActive = !!manualHousePlacements.navamsaLagna && Object.keys(navamsaPlacements).length > 0;
    return validatePlacements(houseOfPlanet, navamsaPlacements, navamsaActive);
}

/** Recompute the "Other" detail fields (22nd Drekkana Lord, 64th Navamsa Lord, Maraka, Badhaka,
 *  Atmakaraka, Maranakaraka, Yogakaraka, Wargoththama, Gandantha/Gandamula, Pushkara,
 *  Nidhanamsha/Ashtamansha) for a manual horoscope from its stored `manualHousePlacements` and
 *  persisted planets. Render-time recomputation is needed because older horoscopes stored `0`/`[]`
 *  defaults for these fields. */
export function synthesizeOtherDetails(
    manualHousePlacements: {
        lagna: number;
        lagnaDegree?: number;
        navamsaLagna?: number;
        navamsaHouses?: ManualHouse[] | null;
    },
    planets: AstroPlanet[],
): Pick<
    CalculationResult,
    | "lord22ndDrekkana"
    | "lord64thNavamsa"
    | "badhakaPlanet"
    | "marakaPlanets"
    | "nidhanamshaPlanets"
    | "ashtamanshaPlanets"
    | "atmakaraka"
    | "maranakaraka"
    | "yogakaraka"
    | "isAscendantWargoththama"
    | "isAscendantGandantha"
    | "isAscendantGandamula"
    | "isAscendantPushkara"
    | "wargoththamaPlanets"
    | "gandanthaPlanets"
    | "gandamulaPlanets"
    | "pushkaraPlanets"
    | "lagnaBhavaSuchika"
    | "bhavaSuchika"
> {
    const lagna = manualHousePlacements.lagna;
    const ascDegree =
        manualHousePlacements.lagnaDegree !== undefined
            ? manualHousePlacements.lagnaDegree
            : manualHousePlacements.navamsaLagna !== undefined
              ? (navamsaIndexForSign(lagna, manualHousePlacements.navamsaLagna) - 0.5) * (30 / 9)
              : 0;
    const ascNavamsaNum = Math.floor(ascDegree / (30 / 9)) + 1;
    const ascNavamsaSign = navamsaSign(lagna, ascNavamsaNum);
    const ascNavamsaLagna = manualHousePlacements.navamsaLagna ?? ascNavamsaSign;
    const hasNavamsa = !!manualHousePlacements.navamsaHouses?.length;
    const houses = buildWholeSignHouses(lagna);
    const ascNakshatra = computeAscendantNakshatra(manualHousePlacements);
    // Bhava Suchika (භාව සුචික) — whole-sign house of each point's Navamsa sign in the birth chart.
    // Manual charts only ever use entered Navamsa data (D5 matrix): the Lagna value requires an
    // entered Navamsa Lagna, and per-planet values require entered Navamsa houses (a planet's
    // Navamsa sign = the sign of the D9 house it was placed in; unplaced planets are omitted).
    const lagnaBhavaSuchika =
        manualHousePlacements.navamsaLagna !== undefined &&
        manualHousePlacements.navamsaLagna !== null &&
        manualHousePlacements.navamsaLagna >= 1 &&
        manualHousePlacements.navamsaLagna <= 12
            ? computeLagnaBhavaSuchika(lagna, manualHousePlacements.navamsaLagna)
            : undefined;
    let bhavaSuchika: Record<string, number> | undefined;
    if (hasNavamsa) {
        const navamsaSignOfPlanet: Record<number, number> = {};
        for (const house of manualHousePlacements.navamsaHouses ?? []) {
            for (const name of house.planets) navamsaSignOfPlanet[name] = house.sign;
        }
        bhavaSuchika = {};
        for (const p of planets) {
            const navamsaSignValue = navamsaSignOfPlanet[p.name];
            if (navamsaSignValue !== undefined) {
                bhavaSuchika[String(p.name)] = computePlanetBhavaSuchika(navamsaSignValue, lagna);
            }
        }
        if (Object.keys(bhavaSuchika).length === 0) bhavaSuchika = undefined;
    }
    return {
        lord22ndDrekkana: computeDrekkanaLord(lagna, ascDegree),
        lord64thNavamsa: computeNavamsaLord(lagna, ascDegree),
        badhakaPlanet: computeBadhaka(lagna),
        marakaPlanets: computeMaraka(lagna),
        nidhanamshaPlanets: hasNavamsa ? computeNidhanamsha(lagna, ascNavamsaLagna, houses, planets) : [],
        ashtamanshaPlanets: hasNavamsa ? computeAshtamansha(lagna, ascNavamsaLagna, houses, planets) : [],
        atmakaraka: computeAtmakaraka(planets),
        maranakaraka: computeMaranakaraka(planets),
        yogakaraka: computeYogakaraka(lagna),
        isAscendantWargoththama: computeAscWargoththama(lagna, ascNavamsaSign),
        isAscendantGandantha: computeAscendantGandantha(ascNakshatra.id, ascNakshatra.pada),
        isAscendantGandamula: computeAscendantGandamula(ascNakshatra.id, ascNakshatra.pada),
        isAscendantPushkara: computeAscendantPushkara(lagna, ascNavamsaSign),
        wargoththamaPlanets: computeWargoththama(planets),
        gandanthaPlanets: computeGandantha(planets),
        gandamulaPlanets: computeGandamula(planets),
        pushkaraPlanets: computePushkara(planets),
        ...(lagnaBhavaSuchika !== undefined ? { lagnaBhavaSuchika } : {}),
        ...(bhavaSuchika !== undefined ? { bhavaSuchika } : {}),
    };
}

function computeAscWargoththama(ascSign: number, ascNavamsaSign: number): boolean {
    return ascSign === ascNavamsaSign;
}

function computeAscendantGandantha(ascNakshatra: number, ascPada: number): boolean {
    return GANDANTHA_NAKSHATRAS.has(ascNakshatra) && ascPada === 4;
}

function computeAscendantGandamula(ascNakshatra: number, ascPada: number): boolean {
    return GANDAMULA_NAKSHATRAS.has(ascNakshatra) && ascPada === 1;
}

function computeAscendantPushkara(ascSign: number, ascNavamsaSign: number): boolean {
    return PUSHKARA_NAVAMSA_SIGNS[ascSign]?.includes(ascNavamsaSign) ?? false;
}
