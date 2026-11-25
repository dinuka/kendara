/** Nisheka Lagna (නිශේක ලග්නය) per BPHS ch. 4 sl. 27–29 — see docs/nisheka-lagna.md.
 *
 *  The interval between the nisheka (conception) and birth is read from the birth chart as an arc:
 *    A = the distance between Saturn and Mandi (the shorter arc, 0–180°)
 *    B = the arc from the Lagna to the 9th bhava madhya, forward in the zodiac (Sripati bhavas)
 *    C = the Moon's degree within its sign — added only when the Lagna lord is in the invisible
 *        half, i.e. below the horizon (from the Lagna forward to the 7th bhava madhya)
 *    X = A + B (+ C)
 *  X is read as time: one sign (30°) is a month, one degree a day, one arcminute 24 minutes. The
 *  nisheka moment is birth minus that time (calendar months, then days, then the day fraction), and
 *  the Nisheka Lagna is the sidereal ascendant at that moment at the birth place.
 *
 *  This module is pure (no ephemeris) so the client can rebuild the chart from the stored value. */
import { type Ascendant, type Planet, navamsaSign } from "@/lib/astrology";
import type { ChartInput } from "@/lib/chartDataTransform";
import { SIGN_LORD, buildWholeSignHouses } from "@/lib/manualChart";
import { computePlanetStrength } from "@/lib/planetDignity";

const normalize = (degree: number): number => ((degree % 360) + 360) % 360;

/** Points below this are treated as sitting exactly on the horizon. */
const HORIZON_EPSILON = 1e-8;

export interface NishekaInputs {
    /** Sidereal longitudes, 0–360. */
    ascendant: number;
    ninthCusp: number;
    saturn: number;
    mandi: number;
    lagnaLord: number;
    moon: number;
}

export interface NishekaElapsed {
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export interface NishekaOffset {
    /** A — shorter arc between Saturn and Mandi, 0–180°. */
    saturnMandiDistance: number;
    /** B — forward arc from the Lagna to the 9th bhava madhya. */
    lagnaNinthDistance: number;
    /** Lagna lord below the horizon (invisible half); null when exactly on it. */
    lagnaLordInvisible: boolean | null;
    /** C — Moon's degree in its sign when the Lagna lord is invisible, else 0. */
    moonCorrection: number;
    /** X = A + B + C, in degrees. */
    totalAngle: number;
    elapsed: NishekaElapsed;
}

/** Shorter arc between two longitudes, 0–180°. */
export const angularDistance = (a: number, b: number): number => {
    const diff = normalize(a - b);
    return Math.min(diff, 360 - diff);
};

/** Arc from `from` forward (zodiacal order) to `to`, 0–360°. */
export const forwardDistance = (from: number, to: number): number => normalize(to - from);

/** Whether a point is in the invisible half — from the Lagna forward to the 7th bhava madhya
 *  (Lagna + 180°). Null when it sits on the horizon. */
export const isBelowHorizon = (longitude: number, ascendant: number): boolean | null => {
    const arc = forwardDistance(ascendant, longitude);
    if (arc < HORIZON_EPSILON || Math.abs(arc - 180) < HORIZON_EPSILON || 360 - arc < HORIZON_EPSILON) return null;
    return arc < 180;
};

/** An arc read as time: 30° = 1 month, 1° = 1 day, 1′ = 24 minutes. */
export const angleToElapsed = (totalDegrees: number): NishekaElapsed => {
    if (!(totalDegrees >= 0)) throw new Error("Nisheka arc must be a non-negative number");
    const months = Math.floor(totalDegrees / 30);
    const inMonth = totalDegrees - months * 30;
    const days = Math.floor(inMonth);
    // Round to the second so float noise (e.g. 0.5° → 43199.999 s) doesn't drop a second.
    const totalSeconds = Math.round((inMonth - days) * 86_400);
    return {
        months,
        days,
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
};

export const calculateNishekaOffset = (inputs: NishekaInputs): NishekaOffset => {
    const values = Object.values(inputs);
    if (!values.every(Number.isFinite)) throw new Error("Nisheka inputs must be finite longitudes");
    const A = angularDistance(inputs.saturn, inputs.mandi);
    const B = forwardDistance(inputs.ascendant, inputs.ninthCusp);
    const invisible = isBelowHorizon(inputs.lagnaLord, inputs.ascendant);
    const C = invisible ? normalize(inputs.moon) % 30 : 0;
    const totalAngle = A + B + C;
    return {
        saturnMandiDistance: A,
        lagnaNinthDistance: B,
        lagnaLordInvisible: invisible,
        moonCorrection: C,
        totalAngle,
        elapsed: angleToElapsed(totalAngle),
    };
};

/** Subtracts the elapsed time from a wall-clock moment: calendar months first (the day clamped to
 *  the month's last day), then days, then hours/minutes/seconds. `wallClockMs` holds the local date
 *  and time in its UTC fields, so no time zone or DST shift interferes. */
export const subtractElapsed = (wallClockMs: number, elapsed: NishekaElapsed): number => {
    const date = new Date(wallClockMs);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - elapsed.months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay) - elapsed.days);
    return date.getTime() - ((elapsed.hours * 60 + elapsed.minutes) * 60 + elapsed.seconds) * 1000;
};

export interface NishekaPosition {
    /** Sidereal longitude 0-360. */
    absoluteDegree: number;
    /** Sign 1-12. */
    sign: number;
    /** Degree within the sign, 0-30. */
    degree: number;
}

export interface NishekaPlanet extends NishekaPosition {
    name: number;
    nakshatra: number;
    pada: number;
    retrograde: boolean;
}

/** Stored on CalculatedDetails.nisheka — every intermediate value is kept so results can be checked
 *  against worked examples. */
export interface Nisheka extends NishekaOffset {
    /** Birth-chart inputs (sidereal longitudes). */
    ascendantLongitude: number;
    ninthCuspLongitude: number;
    saturnLongitude: number;
    mandiLongitude: number;
    lagnaLord: number;
    lagnaLordLongitude: number;
    moonLongitude: number;
    /** Nisheka moment as a UTC ISO timestamp, and as local date (YYYY-MM-DD) / time (HH:MM:SS) in
     *  the birth time zone. */
    dateTime: string;
    localDate: string;
    localTime: string;
    /** Nisheka Lagna — the sidereal ascendant at the nisheka moment at the birth place. */
    ascendant: NishekaPosition;
    /** Planets at the nisheka moment. */
    planets: NishekaPlanet[];
}

/** The Nisheka chart for the chart figure and tables: whole-sign houses from the Nisheka Lagna,
 *  strengths from each planet's sign and degree. */
export const buildNishekaChart = (nisheka: Pick<Nisheka, "ascendant" | "planets">): ChartInput => {
    const lagnaSign = nisheka.ascendant.sign;
    const planets: Planet[] = nisheka.planets.map((p) => {
        const navSign = navamsaSign(p.sign, Math.min(Math.floor(p.degree / (30 / 9)), 8) + 1);
        return {
        name: p.name,
        sign: p.sign,
        degree: p.degree,
        absoluteDegree: p.absoluteDegree,
        house: ((p.sign - lagnaSign + 12) % 12) + 1,
        nakshatra: p.nakshatra,
        pada: p.pada,
        retrograde: p.retrograde,
        combustion: false,
        strength: computePlanetStrength(p.name, p.sign, p.degree),
        navamsaSign: navSign,
        navamsaStrength: computePlanetStrength(p.name, navSign, 0),
        aspects: [],
        };
    });
    const ascendant: Ascendant = {
        sign: lagnaSign,
        degree: +nisheka.ascendant.degree.toFixed(2),
        lord: SIGN_LORD[lagnaSign] ?? 1,
    };
    return { planets, houses: buildWholeSignHouses(lagnaSign), ascendant };
};
