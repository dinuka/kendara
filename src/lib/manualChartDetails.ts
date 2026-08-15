import type { Ascendant, CalculationResult, Planet } from "@/lib/astrology";
import { computePanchaPakshi, computeThithiFromPlanets, navamsaSign } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { computeCurrentPlanets } from "@/lib/currentPlanets";
import {
    type CurrentShani,
    type ManualChartInput,
    type ManualChartResult,
    type ManualHousePlacements,
    SIGN_LORD,
    buildWholeSignHouses,
    calculateManualDashas,
    computeAscendantNakshatra,
    computeMoonNakshatra,
    navamsaLagnaOptions,
    synthesizeOtherDetails,
} from "@/lib/manualChart";
import { computePlanetAspects } from "@/lib/planetAspects";
import { DEFAULT_RASHI_ASPECTS, mergeRashiIntoPlanetAspects } from "@/lib/rashiAspects";
import { computeShadBalaya } from "@/lib/shadBalaya";

export type ManualChartPayload = { ok: true; value: ManualChartInput } | { ok: false; error: string };

const PLANET_MIN = 1;
const PLANET_MAX = 9;

function parseHouses(
    raw: unknown,
    label: string,
): { ok: true; value: Record<number, number[]> } | { ok: false; error: string } {
    if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: `${label} must be an object keyed by house number (1-12)` };
    }
    const result: Record<number, number[]> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const house = Number(key);
        if (!Number.isInteger(house) || house < 1 || house > 12) {
            return { ok: false, error: `invalid house key in ${label}: ${key}` };
        }
        if (!Array.isArray(value)) {
            return { ok: false, error: `planets for house ${key} must be an array` };
        }
        const planets: number[] = [];
        for (const p of value) {
            if (typeof p !== "number" || !Number.isInteger(p) || p < PLANET_MIN || p > PLANET_MAX) {
                return { ok: false, error: `invalid planet enum in ${label}: ${p}` };
            }
            if (planets.includes(p)) {
                return { ok: false, error: `duplicate planet in house ${key} of ${label}` };
            }
            planets.push(p);
        }
        result[house] = planets;
    }
    const seen = new Set<number>();
    for (const planets of Object.values(result)) {
        for (const p of planets) {
            if (seen.has(p)) {
                return { ok: false, error: `duplicate planet across houses in ${label}: ${p}` };
            }
            seen.add(p);
        }
    }
    return { ok: true, value: result };
}

/** Strict server-side validation of the manual-chart payload (lagna enum, house keys 1-12,
 *  planet enums 1-9, no duplicate planet within a chart, and navamsa lagna must be one of the
 *  9 navamsa signs of the birth lagna). */
export function parseManualChartBody(body: unknown): ManualChartPayload {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, error: "invalid body" };
    }
    const b = body as Record<string, unknown>;
    const { lagna } = b;
    if (typeof lagna !== "number" || !Number.isInteger(lagna) || lagna < 1 || lagna > 12) {
        return { ok: false, error: "lagna must be an integer 1-12" };
    }
    const houses = parseHouses(b.houses, "houses");
    if (!houses.ok) return houses;
    let lagnaDegree: number | undefined;
    if (b.lagnaDegree !== undefined && b.lagnaDegree !== null) {
        if (
            typeof b.lagnaDegree !== "number" ||
            !Number.isFinite(b.lagnaDegree) ||
            b.lagnaDegree < 0 ||
            b.lagnaDegree >= 30
        ) {
            return { ok: false, error: "lagnaDegree must be a number in [0, 30)" };
        }
        lagnaDegree = b.lagnaDegree;
    }
    let navamsaLagna: number | undefined;
    if (b.navamsaLagna !== undefined && b.navamsaLagna !== null) {
        if (
            typeof b.navamsaLagna !== "number" ||
            !Number.isInteger(b.navamsaLagna) ||
            b.navamsaLagna < 1 ||
            b.navamsaLagna > 12
        ) {
            return { ok: false, error: "navamsaLagna must be an integer 1-12" };
        }
        navamsaLagna = b.navamsaLagna;
        if (!navamsaLagnaOptions(lagna).includes(navamsaLagna)) {
            return { ok: false, error: `navamsaLagna must be one of the 9 navamsa signs of lagna ${lagna}` };
        }
    }
    let navamsaHouses: Record<number, number[]> | undefined;
    if (b.navamsaHouses !== undefined && b.navamsaHouses !== null) {
        const nav = parseHouses(b.navamsaHouses, "navamsaHouses");
        if (!nav.ok) return nav;
        navamsaHouses = nav.value;
    }
    if (navamsaHouses && Object.keys(navamsaHouses).length > 0 && !navamsaLagna) {
        return { ok: false, error: "navamsaLagna is required when navamsa houses are provided" };
    }
    return {
        ok: true,
        value: { lagna, lagnaDegree, houses: houses.value, navamsaLagna, navamsaHouses },
    };
}

export function synthesizeAscendant(lagna: number): Ascendant {
    return { sign: lagna, degree: 0, lord: SIGN_LORD[lagna] || 1 };
}

/** Strip absent optional keys (`lagnaDegree`, `navamsaLagna`) from a ManualHousePlacements object
 *  before persisting it. BSON serializes `undefined` as `null`, so without this the stored document
 *  keeps `lagnaDegree: null` / `navamsaLagna: null` — which render-time `!== undefined` checks (and
 *  older records) treat as present. The render layer normalizes null away too, but storage should
 *  stay clean for new writes. */
export function sanitizeManualHousePlacements(placements: ManualHousePlacements): ManualHousePlacements {
    const clean: ManualHousePlacements = { ...placements };
    if (clean.lagnaDegree === undefined) delete clean.lagnaDegree;
    if (clean.navamsaLagna === undefined) delete clean.navamsaLagna;
    return clean;
}

/** Current Shani position (for the age-range derivation). Best-effort: returns null when the
 *  ephemeris computation fails or Shani is missing, so age ranges degrade to a hint. */
export function getCurrentShani(lagna: number): CurrentShani | null {
    try {
        const planets = computeCurrentPlanets("lahiri", buildWholeSignHouses(lagna));
        const shani = planets.find((p) => p.name === 7);
        if (!shani) return null;
        return { sign: shani.sign, degree: shani.degree };
    } catch {
        return null;
    }
}

/** Build full `Planet[]` from the derived planets table so existing chart-rendering helpers
 *  (toBirthChartData, generateChartSvg) work unchanged for manual horoscopes. */
export function synthesizePlanets(result: ManualChartResult): Planet[] {
    return result.planetsTable.map((row) => {
        const degree = row.navamsa ? (row.navamsa.degreeRangeStart + row.navamsa.degreeRangeEnd) / 2 : 0;
        const { nakshatra, pada } = row.navamsa
            ? { nakshatra: row.navamsa.nakshatra, pada: row.navamsa.pada }
            : { nakshatra: 1, pada: 1 };
        return {
            name: row.planet,
            sign: row.sign,
            degree,
            absoluteDegree: +(row.sign - 1) * 30 + degree,
            house: row.house,
            nakshatra,
            pada,
            // Rahu/Ketu are retrograde by nature; mark them so the vakra rule does not fire for
            // manual charts (their "not computed" default would otherwise look like direct motion).
            retrograde: row.planet === 8 || row.planet === 9,
            combustion: false,
            strength: row.strength,
            navamsaSign: row.navamsa?.navamsaSign ?? row.sign,
            navamsaStrength: row.navamsa?.navamsaStrength ?? PlanetaryStrength.SAMA,
            aspects: [],
        };
    });
}

/** Build a full `CalculationResult`-shaped object from the manual result so the existing
 *  `CalculatedDetails` document and BIRTH chart records can reuse the standard pipeline. Dashas are
 *  derived from the Moon's nakshatra + pada (see `calculateManualDashas`); when a `birthDate` is
 *  provided the dasha dates are anchored to it, otherwise the sequence is duration-only. */
export function synthesizeCalculation(result: ManualChartResult, birthDate?: Date | null): CalculationResult {
    const { manualHousePlacements } = result;
    const lagna = manualHousePlacements.lagna;
    const planets = synthesizePlanets(result);
    const options = result.aspectOptions;
    // Planet-to-planet aspects for manual charts reuse the shared degree/yoga arm plus rashi drishti
    // (UT-AS-252/253). Absolute degrees come from the synthesized navamsa-midpoint fallback.
    const aspectsByPlanet = mergeRashiIntoPlanetAspects(
        computePlanetAspects(planets, options?.planetAspects, options?.planetaryOrbs),
        planets,
        options?.planetaryOrbs,
        options?.rashiAspects ?? DEFAULT_RASHI_ASPECTS,
    );
    for (const p of planets) {
        p.aspects = aspectsByPlanet[p.name] ?? [];
    }
    const moon = planets.find((p) => p.name === 2);
    const ascendantNakshatra = computeAscendantNakshatra(manualHousePlacements);
    const moonNakshatra = moon ? computeMoonNakshatra(moon.sign, moon.navamsaSign) : { id: 1, pada: 1, lord: 9 };
    const thithi = computeThithiFromPlanets(planets);
    const houses = buildWholeSignHouses(lagna);
    const otherDetails = synthesizeOtherDetails(manualHousePlacements, planets);
    return {
        ascendant: synthesizeAscendant(lagna),
        houses,
        planets,
        nakshatra: {
            moonNakshatra,
            ascendantNakshatra,
        },
        thithi,
        panchaPakshi: computePanchaPakshi(moonNakshatra.id, thithi),
        dashas: calculateManualDashas(moonNakshatra.id, moonNakshatra.pada, birthDate),
        ...otherDetails,
        // Manual charts derive only the subset Shad Bala rules that need stored chart data: Cheshta
        // (Uttarayana sign, paksha, conjunction, Vakra), Kala (paksha only — day/night has no birth
        // time), Dig (entered house), Naisargika (stored maranakaraka), Drishti (manual only).
        shadbalaya: computeShadBalaya(planets, houses, {
            source: "manual",
            thithi,
            maranakaraka: otherDetails.maranakaraka,
        }),
        yogas: [],
        doshas: { doshas: [] },
    };
}

/** Build a `CalculationResult`-shaped object for the Navamsa (D9) chart. Returns null when no
 *  navamsa placements were entered. D9 lagna is the entered Navamsa Lagna. */
export function synthesizeNavamsaCalculation(
    result: ManualChartResult,
    birthDate?: Date | null,
): CalculationResult | null {
    const { manualHousePlacements } = result;
    if (!manualHousePlacements.navamsaHouses || manualHousePlacements.navamsaHouses.length === 0) {
        return null;
    }
    const navamsaLagna = manualHousePlacements.navamsaLagna ?? manualHousePlacements.lagna;
    const planets: Planet[] = [];
    for (const house of manualHousePlacements.navamsaHouses) {
        for (const name of house.planets) {
            planets.push({
                name,
                sign: house.sign,
                degree: 0,
                absoluteDegree: (house.sign - 1) * 30,
                house: house.houseNumber,
                nakshatra: 1,
                pada: 1,
                retrograde: false,
                combustion: false,
                strength: PlanetaryStrength.SAMA,
                navamsaSign: house.sign,
                navamsaStrength: PlanetaryStrength.SAMA,
                aspects: [],
            });
        }
    }
    const base = synthesizeCalculation(result, birthDate);
    // Bhava Suchika (භාව සුචික) is a Lagna-chart concept — it maps a point's Navamsa sign into the
    // BIRTH chart. It must never be persisted on the Navamsa (D9) chart result, whose ascendant and
    // houses belong to the D9 wheel.
    delete base.lagnaBhavaSuchika;
    delete base.bhavaSuchika;
    return {
        ...base,
        ascendant: synthesizeAscendant(navamsaLagna),
        houses: buildWholeSignHouses(navamsaLagna),
        planets,
    };
}

/** Reference location the birth-date autofill pins to until it becomes a user setting. The
 *  location mainly supplies a timezone so the 12:00 local time maps to the right UTC instant;
 *  planet ecliptic longitudes are barely sensitive to latitude/longitude themselves. */
export const AUTOFILL_LOCATION = {
    name: "Colombo",
    utcOffsetHours: 5.5,
};
export const AUTOFILL_TIME = "12:00";
export const AUTOFILL_AYANAMSHA = "lahiri";

export interface ComputedManualPosition {
    /** Planet enum (1-9). */
    planet: number;
    /** ZodiacSign enum — where the planet actually sits at the birth datetime. */
    sign: number;
    /** Position within the sign (0-30). */
    degree: number;
    /** Birth-chart whole-sign house derived from the user's Lagna. */
    house: number;
    /** Navamsa sign derived from the planet's exact degree. */
    navamsaSign: number;
    /** Navamsa house relative to the user's Navamsa Lagna; null when no navamsa lagna given. */
    navamsaHouse: number | null;
}

export interface ComputedManualPlaces {
    date: string;
    time: string;
    locationName: string;
    /** Birth houses keyed by house number -> planet enums. */
    houses: Record<number, number[]>;
    /** Navamsa houses keyed by house number -> planet enums (only when a navamsa lagna given). */
    navamsaHouses: Record<number, number[]>;
    positions: ComputedManualPosition[];
}

/** Compute the 9 planets' positions at the given birth date (pinned to 12:00 at the autofill
 *  location), then map them to whole-sign birth houses from the user's Lagna and — when a Navamsa
 *  Lagna is given — to navamsa houses. Pure enough to unit test; calls the ephemeris for positions. */
export function computeManualChartPositions(date: string, lagna: number, navamsaLagna?: number): ComputedManualPlaces {
    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    const utcHour = 12 - AUTOFILL_LOCATION.utcOffsetHours;
    const utcHourInt = Math.floor(utcHour);
    const utcMinute = Math.round((utcHour % 1) * 60);
    const forDate = new Date(Date.UTC(year, month - 1, day, utcHourInt, utcMinute, 0, 0));

    const houses: Record<number, number[]> = {};
    const navamsaHouses: Record<number, number[]> = {};
    const positions: ComputedManualPosition[] = [];

    const records = computeCurrentPlanets(AUTOFILL_AYANAMSHA, buildWholeSignHouses(lagna), forDate);

    records.forEach((record) => {
        const sign = record.sign;
        if (sign < 1 || sign > 12) return;
        const degree = typeof record.degree === "number" ? record.degree : 0;
        const wedge = Math.floor((((degree % 30) + 30) % 30) / (30 / 9)) + 1;
        const navamsaSignValue = navamsaSign(sign, wedge);
        const birthHouse = ((sign - lagna + 12) % 12) + 1;
        const navamsaHouse = navamsaLagna ? ((navamsaSignValue - navamsaLagna + 12) % 12) + 1 : null;

        houses[birthHouse] = [...(houses[birthHouse] ?? []), record.name];
        if (navamsaHouse !== null && navamsaLagna) {
            navamsaHouses[navamsaHouse] = [...(navamsaHouses[navamsaHouse] ?? []), record.name];
        }

        positions.push({
            planet: record.name,
            sign,
            degree,
            house: birthHouse,
            navamsaSign: navamsaSignValue,
            navamsaHouse,
        });
    });

    return {
        date,
        time: AUTOFILL_TIME,
        locationName: AUTOFILL_LOCATION.name,
        houses,
        navamsaHouses,
        positions,
    };
}
