import swisseph from "swisseph-v2";

import { CurrentPlanetRecord, House, NATURAL_ENEMIES, NATURAL_FRIENDS } from "@/lib/astrology";
import { COMBUSTION_ORBS, Planet } from "@/lib/astrologyEnums";
import logger from "@/lib/logger";

const AYANAMSHA_MAP: Record<string, number> = {
    lahari: 1,
    raman: 3,
    krishnamurti: 5,
    yukteshwar: 7,
};

const NAKSHATRA_ARC = 360 / 27;

const PLANET_TO_SWE: Record<number, number> = {
    [Planet.SUN]: 0,
    [Planet.MOON]: 1,
    [Planet.MARS]: 4,
    [Planet.MERCURY]: 2,
    [Planet.JUPITER]: 5,
    [Planet.VENUS]: 3,
    [Planet.SATURN]: 6,
    [Planet.RAHU]: 10,
};

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

const MOOLATRIKONA_RANGE: Record<number, { sign: number; start: number; end: number } | null> = {
    1: { sign: 5, start: 0, end: 20 },
    2: null,
    3: { sign: 1, start: 0, end: 12 },
    4: { sign: 6, start: 16, end: 20 },
    5: { sign: 9, start: 0, end: 10 },
    6: { sign: 7, start: 0, end: 15 },
    7: { sign: 11, start: 0, end: 20 },
};

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

function getNakshatra(longitude: number): { nakshatra: number; pada: number } {
    const normalizedLong = ((longitude % 360) + 360) % 360;
    const nakshatraNum = Math.floor(normalizedLong / NAKSHATRA_ARC);
    const withinNakshatra = normalizedLong - nakshatraNum * NAKSHATRA_ARC;
    const pada = Math.floor(withinNakshatra / (NAKSHATRA_ARC / 4) + 1e-10) + 1;
    return { nakshatra: nakshatraNum + 1, pada };
}

function getSign(degree: number): number {
    return Math.floor((((degree % 360) + 360) % 360) / 30) + 1;
}

function computeStrength(planet: number, sign: number): string {
    if (EXALTATION[planet] === sign) return "Uchcha";
    if (DEBILITATION[planet] === sign) return "Neecha";
    const mRange = MOOLATRIKONA_RANGE[planet];
    if (mRange && mRange.sign === sign) return "Moolatrikona";
    if (OWN_SIGNS[planet]?.includes(sign)) return "OwnSign";
    const signLord = SIGN_LORD[sign];
    if (NATURAL_FRIENDS[planet]?.includes(signLord)) return "Mitra";
    if (NATURAL_ENEMIES[planet]?.includes(signLord)) return "Shatru";
    return "Sama";
}

function isCombust(planet: number, sunLongitude: number, planetLongitude: number): boolean {
    if (planet === Planet.SUN || planet === Planet.RAHU || planet === Planet.KETU) return false;
    const orb = COMBUSTION_ORBS[planet as keyof typeof COMBUSTION_ORBS];
    if (!orb) return false;
    const diff = Math.abs(planetLongitude - sunLongitude);
    const wrappedDiff = Math.min(diff, 360 - diff);
    return wrappedDiff <= orb;
}

export function computeCurrentPlanets(ayanamsha: string, birthHouses: House[], forDate?: Date): CurrentPlanetRecord[] {
    logger.info({ ayanamsha }, "computing current planetary positions");

    // The planet's house is its whole-sign Rashi house relative to the birth ascendant sign
    // (house 1 of the birth wheel). The birth wheel's first house sign IS the ascendant sign —
    // never the cusp-boundary ranges.
    const ascSign = birthHouses[0]?.sign ?? 1;

    const ayanamshaId = AYANAMSHA_MAP[ayanamsha] ?? 1;
    const now = forDate ?? new Date();

    let julianDayUT: number;
    try {
        const utc = swisseph.swe_utc_time_zone(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds(),
            0,
        );

        const jdResult = swisseph.swe_utc_to_jd(
            utc.year,
            utc.month,
            utc.day,
            utc.hour,
            utc.minute,
            utc.second,
            swisseph.SE_GREG_CAL,
        );

        if ("error" in jdResult) {
            logger.error({ error: jdResult.error }, "failed to compute Julian day");
            return [];
        }

        julianDayUT = jdResult.julianDayUT;
    } catch (err) {
        logger.error({ err }, "failed to compute Julian day");
        return [];
    }

    try {
        swisseph.swe_set_sid_mode(ayanamshaId, 0, 0);
    } catch (err) {
        logger.error({ err }, "failed to set sidereal mode");
    }

    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const planets: CurrentPlanetRecord[] = [];

    let sunLongitude = 0;
    try {
        const sunResult = swisseph.swe_calc_ut(julianDayUT, PLANET_TO_SWE[Planet.SUN], flags);
        if (!("error" in sunResult)) {
            sunLongitude = sunResult.longitude;
        }
    } catch (err) {
        logger.warn({ err }, "failed to compute Sun position for combustion check");
    }

    let rahuLongitude = 0;
    let rahuSpeed = 0;
    let rahuLatitude = 0;

    for (let p = Planet.SUN; p <= Planet.KETU; p++) {
        try {
            let longitude: number;
            let latitude: number;
            let speed: number;

            if (p === Planet.KETU) {
                longitude = (rahuLongitude + 180) % 360;
                latitude = -rahuLatitude;
                speed = rahuSpeed;
            } else {
                const result = swisseph.swe_calc_ut(julianDayUT, PLANET_TO_SWE[p], flags);
                if ("error" in result) {
                    logger.warn({ planet: p, error: result.error }, "failed to compute planet position");
                    continue;
                }
                longitude = result.longitude;
                latitude = result.latitude;
                speed = result.longitudeSpeed;

                if (p === Planet.RAHU) {
                    rahuLongitude = longitude;
                    rahuSpeed = speed;
                    rahuLatitude = latitude;
                }
            }

            const sign = getSign(longitude);
            const degree = +(longitude % 30).toFixed(4);
            const absoluteDegree = +longitude.toFixed(4);
            const house = ((sign - ascSign + 12) % 12) + 1;
            const { nakshatra, pada } = getNakshatra(longitude);
            const retrograde = speed < 0;
            const combustion = isCombust(p, sunLongitude, longitude);
            const strength = computeStrength(p, sign);

            planets.push({
                name: p,
                sign,
                degree,
                absoluteDegree,
                house,
                nakshatra,
                pada,
                retrograde,
                combustion,
                strength,
            });
        } catch (err) {
            logger.warn({ planet: p, err }, "failed to compute current planet position");
        }
    }

    logger.info("computed current positions for %d planets", planets.length);
    return planets;
}
