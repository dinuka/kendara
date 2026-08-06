import { navamsaSign } from "@/lib/astrology";
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";

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

export interface ManualChartInput {
    lagna: number;
    houses: Record<number, number[]>;
    /** Ascendant degree within the lagna sign (0 ≤ d < 30). Stored as metadata; drives auto-deriving
     *  the Navamsa Lagna on the client when supplied. */
    lagnaDegree?: number;
    /** Navamsa (D9) Lagna — required to enter the navamsa chart; drives navamsa house signs. */
    navamsaLagna?: number;
    navamsaHouses?: Record<number, number[]>;
}

export interface ManualChartResult {
    manualHousePlacements: ManualHousePlacements;
    planetsTable: ManualPlanetRow[];
    navamsaEnrichment: NavamsaEnrichment[];
    derivedRanges: DerivedRanges;
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

const ASPECT_HOUSES: Record<number, number[]> = {
    [Planet.MARS]: [4, 8, 12],
    [Planet.JUPITER]: [5, 9, 11],
    [Planet.SATURN]: [3, 7, 10],
    [Planet.RAHU]: [5, 9],
    [Planet.KETU]: [5, 9],
};

/** Vedic special aspects: Mars 4/8/12, Jupiter 5/9/11, Saturn 3/7/10, Rahu/Ketu 5/9,
 *  all other planets only the 7th-house full aspect. Returns planet -> aspected house numbers. */
export function computeAspects(houseOfPlanet: Record<number, number>): Record<number, number[]> {
    const result: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        const planet = Number(planetKey);
        const offsets = ASPECT_HOUSES[planet] ?? [7];
        result[planet] = offsets.map((o) => ((house - 1 + o - 1) % 12) + 1);
    }
    return result;
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

export function buildHouses(lagna: number, houseOfPlanet: Record<number, number>): ManualHouse[] {
    const houseSigns = deriveHouseSigns(lagna);
    const planetsByHouse: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        (planetsByHouse[house] ??= []).push(Number(planetKey));
    }
    const aspectsByPlanet = computeAspects(houseOfPlanet);
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

const NATURAL_FRIENDS: Record<number, number[]> = {
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

const NATURAL_ENEMIES: Record<number, number[]> = {
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
}

/** Derive the read-only planets table from house placements. Sign comes from the house, strength is
 *  sign-based (exaltation/debilitation/moolatrikona/own/friend/enemy/sama at degree 0), conjunctions/aspects
 *  from the shared rules, and "Other" carries the 22nd Drekkana Lord / 64th Navamsa Lord / Atmakaraka tags. */
export function derivePlanetsTable(input: PlanetsTableInput): ManualPlanetRow[] {
    const { lagna, houseOfPlanet, navamsaEnrichment = [] } = input;
    const houseSigns = deriveHouseSigns(lagna);
    const conjunctions = computeConjunctions(houseOfPlanet);
    const aspectsByPlanet = computeAspects(houseOfPlanet);
    const planetsByHouse: Record<number, number[]> = {};
    for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
        (planetsByHouse[house] ??= []).push(Number(planetKey));
    }
    const enrichmentByPlanet: Record<number, NavamsaEnrichment> = {};
    for (const e of navamsaEnrichment) enrichmentByPlanet[e.planet] = e;

    const ascDegree = 0;
    const lord22ndDrekkana = computeDrekkanaLord(lagna, ascDegree);
    const lord64thNavamsa = computeNavamsaLord(lagna, ascDegree);
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

/** Probable birth time range from Ravi's house. 2-hour window starting 05:00 for house 1, +2h per house. */
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

/** Probable age ranges from Shani's birth navamsa and current Shani position.
 *  1st age (months) = months-to-next-sign + completed current-sign months + 30 x (sign gap).
 *  2nd/3rd ages add 30 years each. Negative intermediates clamp to 0 with a warning flag. */
export function deriveAgeRanges(
    shaniBirthNavamsa: number,
    currentShaniDegree: number,
    currentShaniSign: number,
    birthShaniSign: number,
): AgeRange[] {
    const monthsToNextSign = shaniBirthNavamsa <= 1 ? SHANI_MONTHS_FOR_SIGN.default : SHANI_MONTHS_FOR_SIGN.alternate;
    const completedMonths = Math.max(0, Math.round(currentShaniDegree));
    const signGapMonths = 30 * (birthShaniSign - currentShaniSign - 1);

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
    const houses = buildHouses(input.lagna, houseOfPlanet);
    const validation = validatePlacements(houseOfPlanet, input.navamsaHouses, !!input.navamsaLagna);

    let navamsaHouses: ManualHouse[] = [];
    let navamsaEnrichment: NavamsaEnrichment[] = [];
    const navamsaLagna = input.navamsaLagna;
    if (
        navamsaLagna &&
        navamsaLagna >= 1 &&
        navamsaLagna <= 12 &&
        input.navamsaHouses &&
        Object.keys(input.navamsaHouses).length > 0
    ) {
        const navHouseOfPlanet = placementsToMap(input.navamsaHouses);
        navamsaHouses = buildHouses(navamsaLagna, navHouseOfPlanet);
        const navHouseSigns = deriveHouseSigns(navamsaLagna);
        const planetBirthSigns: Record<number, number> = {};
        for (const [planetKey, house] of Object.entries(houseOfPlanet)) {
            planetBirthSigns[Number(planetKey)] = houseSigns[house - 1];
        }
        const planetNavamsaSigns: Record<number, number> = {};
        for (const [planetKey, navHouse] of Object.entries(navHouseOfPlanet)) {
            planetNavamsaSigns[Number(planetKey)] = navHouseSigns[navHouse - 1];
        }
        navamsaEnrichment = deriveNavamsaData(planetBirthSigns, planetNavamsaSigns);
    }

    const planetsTable = derivePlanetsTable({ lagna: input.lagna, houseOfPlanet, navamsaEnrichment });
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
    };
}

/** Probable birth time range per house (US-CH-009 business rule). */
export const BIRTH_TIME_RANGES: Record<number, { start: string; end: string }> = {
    1: { start: "05:00", end: "07:00" },
    2: { start: "07:00", end: "09:00" },
    3: { start: "09:00", end: "11:00" },
    4: { start: "11:00", end: "13:00" },
    5: { start: "13:00", end: "15:00" },
    6: { start: "15:00", end: "17:00" },
    7: { start: "17:00", end: "19:00" },
    8: { start: "19:00", end: "21:00" },
    9: { start: "21:00", end: "23:00" },
    10: { start: "23:00", end: "01:00" },
    11: { start: "01:00", end: "03:00" },
    12: { start: "03:00", end: "05:00" },
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
    return houseSigns.map((sign, i) => ({
        houseNumber: i + 1,
        startDegree: 0,
        startSign: sign,
        startLord: SIGN_LORD[sign] || 1,
        middleDegree: 0,
        middleSign: sign,
        middleLord: SIGN_LORD[sign] || 1,
        endDegree: 0,
        endSign: sign,
        endLord: SIGN_LORD[sign] || 1,
        sign,
        lord: SIGN_LORD[sign] || 1,
    }));
}
