/** Gulika Lagna (ගුලික ලග්නය) per BPHS ch. 3 sl. 66–70 — see docs/gulika-lagna.md.
 *
 *  The day (sunrise → sunset) or night (sunset → next sunrise) of birth is split into eight equal
 *  parts. The first seven are ruled by the weekday lords in weekday order (Sun, Moon, Mars, Mercury,
 *  Jupiter, Venus, Saturn), starting from the lord of the weekday by day and from the 5th lord from
 *  it by night; the eighth part is lordless. Saturn's part is Gulika, and the Gulika Lagna is the
 *  ascendant rising at the START of that part.
 *
 *  The weekday is that of the sunrise the day/night belongs to — a birth after midnight but before
 *  sunrise still uses the previous day. */
import { Planet } from "@/lib/astrologyEnums";

/** Weekday lords, indexed by weekday (0 = Sunday). */
export const WEEKDAY_LORDS: readonly Planet[] = [
    Planet.SUN,
    Planet.MOON,
    Planet.MARS,
    Planet.MERCURY,
    Planet.JUPITER,
    Planet.VENUS,
    Planet.SATURN,
];

const PARTS = 8;
const SATURN_INDEX = WEEKDAY_LORDS.indexOf(Planet.SATURN);

export interface GulikaPeriodInput {
    /** Times on one linear scale (Julian Days or epoch ms): the sunrise at or before birth, the
     *  sunset after it, and the sunrise after that sunset. */
    sunrise: number;
    sunset: number;
    nextSunrise: number;
    birth: number;
    /** Weekday of `sunrise`, 0 = Sunday. */
    weekday: number;
}

export interface GulikaPeriod {
    isNight: boolean;
    weekday: number;
    /** Planet ruling the first part of the day/night. */
    startLord: Planet;
    /** Gulika's part, 1-8. */
    part: number;
    start: number;
    end: number;
}

export const findGulikaPeriod = ({ sunrise, sunset, nextSunrise, birth, weekday }: GulikaPeriodInput): GulikaPeriod => {
    if (!(sunrise <= birth && sunrise < sunset && sunset < nextSunrise && birth < nextSunrise)) {
        throw new Error("Expected sunrise <= birth < next sunrise, with the sunset in between");
    }
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new Error("Weekday must be an integer 0-6");
    }
    const isNight = birth >= sunset;
    const startIndex = (weekday + (isNight ? 4 : 0)) % 7;
    const slot = (SATURN_INDEX - startIndex + 7) % 7;
    const periodStart = isNight ? sunset : sunrise;
    const periodEnd = isNight ? nextSunrise : sunset;
    const partLength = (periodEnd - periodStart) / PARTS;
    const start = periodStart + slot * partLength;
    return {
        isNight,
        weekday,
        startLord: WEEKDAY_LORDS[startIndex],
        part: slot + 1,
        start,
        end: start + partLength,
    };
};

/** Weekday (0 = Sunday) of a Julian Day (UT) in local mean time at `longitude`. Only used for
 *  sunrises, which sit far from local midnight, so local mean time is as good as the civil zone. */
export const weekdayOfJulianDay = (jdUT: number, longitude: number): number =>
    Math.floor(jdUT + 1.5 + longitude / 360) % 7;

export interface GulikaLagna {
    /** Sidereal longitude 0-360. */
    absoluteDegree: number;
    /** Sign 1-12. */
    sign: number;
    /** Degree within the sign, 0-30. */
    degree: number;
    isNight: boolean;
    /** Weekday the day/night belongs to, 0 = Sunday. */
    weekday: number;
    /** Gulika's part of the day/night, 1-8. */
    part: number;
    /** Gulika period, as UTC ISO timestamps. */
    start: string;
    end: string;
}
