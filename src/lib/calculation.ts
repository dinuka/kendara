import jyotish from "jyotish-calculations";
import swisseph from "swisseph-v2";

import { IHoroscope } from "@/models/Horoscope";

import {
    Antardasha,
    Ascendant,
    Aspect,
    CalculationResult,
    CurrentPeriod,
    DashaInfo,
    House,
    Mahadasha,
    Planet,
    Prana,
    Sukshama,
    Vidasa,
    navamsaSign,
} from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import logger from "@/lib/logger";

const GRAHA_MAP: Record<string, number> = {
    Su: 1,
    Mo: 2,
    Ma: 3,
    Me: 4,
    Ju: 5,
    Ve: 6,
    Sa: 7,
    Ra: 8,
    Ke: 9,
};

const RASHI_MAP: Record<string, number> = {
    Ar: 1,
    Ta: 2,
    Ge: 3,
    Cn: 4,
    Le: 5,
    Vi: 6,
    Li: 7,
    Sc: 8,
    Sg: 9,
    Cp: 10,
    Aq: 11,
    Pi: 12,
};

const NAKSHATRA_NAMES: string[] = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashira",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyestha",
    "Mula",
    "Purva Aashada",
    "Uttara Aashada",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
];

const VIMSHOTTARI_CYCLE: { planet: number; years: number }[] = [
    { planet: 9, years: 7 },
    { planet: 6, years: 20 },
    { planet: 1, years: 6 },
    { planet: 2, years: 10 },
    { planet: 3, years: 7 },
    { planet: 8, years: 18 },
    { planet: 5, years: 16 },
    { planet: 7, years: 19 },
    { planet: 4, years: 17 },
];

const PLANET_TO_CYCLE_INDEX: Record<number, number> = {
    9: 0,
    6: 1,
    1: 2,
    2: 3,
    3: 4,
    8: 5,
    5: 6,
    7: 7,
    4: 8,
};

const TOTAL_VIMSHOTTARI_YEARS = 120;

const AYANAMSHA_MAP: Record<string, number> = {
    lahari: 1,
    raman: 3,
    krishnamurti: 5,
    yukteshwar: 7,
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

const ASPECT_TYPES = [0, 60, 90, 120, 180];

function getNakshatraId(name: string): number {
    const idx = NAKSHATRA_NAMES.indexOf(name);
    return idx >= 0 ? idx + 1 : 1;
}

function getSign(degree: number): number {
    return Math.floor(degree / 30) + 1;
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

interface MoolatrikonaRange {
    sign: number;
    start: number;
    end: number;
}

const MOOLATRIKONA_RANGE: Record<number, MoolatrikonaRange | null> = {
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

const STRENGTH_VALUES: Record<PlanetaryStrength, number> = {
    [PlanetaryStrength.ATHI_UCHCHA]: 1.25,
    [PlanetaryStrength.UCHCHA]: 1,
    [PlanetaryStrength.NEECHA]: -1,
    [PlanetaryStrength.ATHI_NEECHA]: -1.25,
    [PlanetaryStrength.MOOLATRIKONA]: 0.75,
    [PlanetaryStrength.OWN_SIGN]: 0.5,
    [PlanetaryStrength.MITRA]: 0.1,
    [PlanetaryStrength.SHATRU]: -0.1,
    [PlanetaryStrength.SAMA]: 0,
};

function computePlanetStrength(planet: number, sign: number, degree: number): PlanetaryStrength {
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

const DEFAULT_ORBS: Record<string, number> = {
    "1": 15,
    "2": 12,
    "3": 8,
    "4": 7,
    "5": 9,
    "6": 7,
    "7": 9,
    "8": 0,
    "9": 0,
};

export function calculateHoroscope(
    data: IHoroscope,
    planetaryOrbs: Record<string, number> = DEFAULT_ORBS,
): CalculationResult {
    logger.info({ name: data.name, ayanamsha: data.ayanamsha }, "starting horoscope calculation");

    const birthDate = new Date(data.birthDate);
    const year = birthDate.getFullYear();
    const month = String(birthDate.getMonth() + 1).padStart(2, "0");
    const day = String(birthDate.getDate()).padStart(2, "0");

    const [hours, minutes] = (data.birthTime || "12:00").split(":").map(Number);
    const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

    const ayanamshaId = AYANAMSHA_MAP[data.ayanamsha] ?? 1;

    const dateString = `${year}-${month}-${day}`;
    const timezone = 5.5;

    logger.info(
        { dateString, timeString, lat: data.latitude, lng: data.longitude, timezone, ayanamshaId },
        "calling jyotish-calculations",
    );

    const positions = jyotish.grahas.getGrahasPosition(
        { dateString, timeString, lat: data.latitude, lng: data.longitude, timezone },
        { zodiacType: "S", ayanamsha: ayanamshaId, houseType: "P" },
    );

    const ascLong = positions.La.longitude;
    const ascSign = getSign(ascLong);

    const ascendant: Ascendant = {
        sign: ascSign,
        degree: +(ascLong % 30).toFixed(2),
        lord: SIGN_LORD[ascSign] || ascSign,
    };

    const utc = swisseph.swe_utc_time_zone(year, +month, +day, hours, minutes, 0, timezone);
    const jd = swisseph.swe_utc_to_jd(
        utc.year,
        utc.month,
        utc.day,
        utc.hour,
        utc.minute,
        utc.second,
        swisseph.SE_GREG_CAL,
    );
    swisseph.swe_set_sid_mode(ayanamshaId, 0, 0);
    const sweResult = swisseph.swe_houses_ex(
        jd.julianDayUT,
        swisseph.SEFLG_SIDEREAL,
        data.latitude,
        data.longitude,
        "P",
    );
    const cusps = sweResult.house;

    const houses: House[] = Array.from({ length: 12 }, (_, i) => {
        const cusp = cusps[i];
        const nextCusp = cusps[(i + 1) % 12];
        const prevCusp = cusps[(i + 11) % 12];

        const cForNext = nextCusp < cusp ? nextCusp + 360 : nextCusp;
        const cForPrev = cusp < prevCusp ? cusp + 360 : cusp;

        const start = ((prevCusp + cForPrev) / 2) % 360;
        const end = ((cusp + cForNext) / 2) % 360;
        const mid = cusp;

        const startSign = Math.floor(start / 30) + 1;
        const endSign = Math.floor(end / 30) + 1;
        const midSign = Math.floor(mid / 30) + 1;
        return {
            houseNumber: i + 1,
            startDegree: +(start % 30).toFixed(4),
            startSign,
            startLord: SIGN_LORD[startSign] || 1,
            middleDegree: +(mid % 30).toFixed(4),
            middleSign: midSign,
            middleLord: SIGN_LORD[midSign] || 1,
            endDegree: +(end % 30).toFixed(4),
            endSign,
            endLord: SIGN_LORD[endSign] || 1,
            sign: midSign,
            lord: SIGN_LORD[midSign] || 1,
        };
    });

    const grahaKeys = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"];
    const planetDetails: Planet[] = grahaKeys.map((key) => {
        const p = positions[key];
        const name = GRAHA_MAP[key];
        const sign = RASHI_MAP[p.rashi] || getSign(p.longitude);
        const degree = +(p.longitude % 30).toFixed(2);
        const absoluteDegree = +p.longitude.toFixed(2);
        const house = ((sign - ascSign + 12) % 12) + 1;
        const nakshatraId = getNakshatraId(p.nakshatra.name);

        const navamsaNum = Math.floor(degree / (30 / 9)) + 1;
        const nSign = navamsaSign(sign, navamsaNum);

        return {
            name: name ?? 0,
            sign,
            degree,
            absoluteDegree,
            house,
            nakshatra: nakshatraId,
            pada: p.nakshatra.pada,
            retrograde: !!p.isRetrograde,
            combustion: false,
            strength: PlanetaryStrength.SAMA,
            navamsaSign: nSign,
            navamsaStrength: computePlanetStrength(name ?? 0, nSign, 0),
            aspects: [],
        };
    });

    const sunLong = positions.Su.longitude;

    const sunOrb = (planetaryOrbs["1"] ?? 15) / 2;

    for (let i = 0; i < planetDetails.length; i++) {
        planetDetails[i].combustion =
            i === 0
                ? false
                : Math.abs(planetDetails[i].absoluteDegree - sunLong) < sunOrb ||
                Math.abs(planetDetails[i].absoluteDegree - sunLong + 360) < sunOrb ||
                Math.abs(planetDetails[i].absoluteDegree - sunLong - 360) < sunOrb;

        const aspects: Aspect[] = [];
        for (let j = 0; j < planetDetails.length; j++) {
            if (i === j) continue;
            const dist = Math.abs(planetDetails[i].absoluteDegree - planetDetails[j].absoluteDegree);
            const rawDist = Math.min(dist, 360 - dist);
            const nearestAspect = ASPECT_TYPES.reduce((prev, curr) =>
                Math.abs(rawDist - curr) < Math.abs(rawDist - prev) ? curr : prev,
            );
            const gap = Math.abs(rawDist - nearestAspect);
            if (gap < 30) {
                aspects.push({
                    planetName: planetDetails[j].name,
                    aspectType: nearestAspect,
                    planetAbsoluteDegree: planetDetails[j].absoluteDegree,
                    degreeGap: +gap.toFixed(2),
                    exactAspectDegree: nearestAspect,
                    isBeneficial: nearestAspect === 60 || nearestAspect === 120,
                });
            }
        }
        planetDetails[i].aspects = aspects;
    }

    for (const p of planetDetails) {
        p.strength = computePlanetStrength(p.name, p.sign, p.degree);
    }

    logger.info("calculation complete: %d planets, %d houses", planetDetails.length, houses.length);

    const moonNakshatra = getNakshatraId(positions.Mo.nakshatra.name);
    const moonPada = positions.Mo.nakshatra.pada;
    const ascNakshatra = getNakshatraId(positions.La.nakshatra.name);
    const ascPada = positions.La.nakshatra.pada;

    // Vimshottari Nakshatra lords follow the cycle: Ketu(9), Venus(6), Sun(1), Moon(2),
    // Mars(3), Rahu(8), Jupiter(5), Saturn(7), Mercury(4) — repeating every 9 nakshatras.
    // Derived from VIMSHOTTARI_CYCLE to stay in sync.
    const nakshatraLords = Array.from({ length: 27 }, (_, i) => VIMSHOTTARI_CYCLE[i % 9].planet);

    const dashas = calculateDashas(positions.Mo.longitude, moonNakshatra, nakshatraLords[moonNakshatra - 1], birthDate);

    return {
        ascendant,
        houses,
        planets: planetDetails,
        nakshatra: {
            moonNakshatra: { id: moonNakshatra, pada: moonPada, lord: nakshatraLords[moonNakshatra - 1] },
            ascendantNakshatra: { id: ascNakshatra, pada: ascPada, lord: nakshatraLords[ascNakshatra - 1] },
        },
        dashas,
        lord22ndDrekkana: computeDrekkanaLord(ascSign, ascLong % 30),
        lord64thNavamsa: computeNavamsaLord(planetDetails),
        badhakaPlanet: computeBadhaka(ascSign),
        marakaPlanets: computeMaraka(ascSign, planetDetails),
        atmakaraka: computeAtmakaraka(planetDetails),
        yogas: [],
        doshas: { doshas: [] },
    };
}

function drekkanaSign(sourceSign: number, drekkanaNum: number): number {
    return ((sourceSign - 1 + (drekkanaNum - 1) * 4) % 12) + 1;
}

function computeDrekkanaLord(ascSign: number, ascDegree: number): number {
    const ascDrekkanaNum = Math.floor(ascDegree / 10) + 1;
    const absDrekkana = (ascSign - 1) * 3 + ascDrekkanaNum;
    const targetAbs = ((absDrekkana + 21 - 1) % 36) + 1;
    const sourceSign = Math.floor((targetAbs - 1) / 3) + 1;
    const drekkanaNum = ((targetAbs - 1) % 3) + 1;
    const mappedSign = drekkanaSign(sourceSign, drekkanaNum);
    return SIGN_LORD[mappedSign] || 1;
}

function computeNavamsaLord(planets: Planet[]): number {
    const moon = planets.find((p) => p.name === 2);
    if (!moon) return 1;
    const moonNavamsaNum = Math.floor(moon.degree / (20 / 3)) + 1;
    const absNavamsa = (moon.sign - 1) * 9 + moonNavamsaNum;
    const targetAbs = ((absNavamsa + 63 - 1) % 108) + 1;
    const sourceSign = Math.floor((targetAbs - 1) / 9) + 1;
    const navamsaNum = ((targetAbs - 1) % 9) + 1;
    const mappedSign = navamsaSign(sourceSign, navamsaNum);
    return SIGN_LORD[mappedSign] || 1;
}

function computeBadhaka(ascSign: number): number[] {
    const isMovable = [1, 4, 7, 10].includes(ascSign);
    const isFixed = [2, 5, 8, 11].includes(ascSign);

    let badhakaHouse: number;
    if (isMovable) badhakaHouse = 11;
    else if (isFixed) badhakaHouse = 9;
    else badhakaHouse = 7;

    const badhakaSign = ((ascSign + badhakaHouse - 2) % 12) + 1;
    return [SIGN_LORD[badhakaSign] || 1];
}

function computeMaraka(ascSign: number, planets: Planet[]): number[] {
    const secondSign = (ascSign % 12) + 1;
    const seventhSign = ((ascSign + 6 - 1) % 12) + 1;

    const secondLord = SIGN_LORD[secondSign] || 1;
    const seventhLord = SIGN_LORD[seventhSign] || 1;

    const marakas = new Set<number>();
    marakas.add(secondLord);
    marakas.add(seventhLord);

    for (const p of planets) {
        if (p.name === 8 || p.name === 9) continue;
        if (p.house === 2 || p.house === 7) {
            marakas.add(p.name);
        }
    }

    for (const p of planets) {
        if (p.name === 8 || p.name === 9) continue;
        if (p.name === secondLord || p.name === seventhLord) continue;
        const conjWith2nd = p.aspects.some((a) => a.planetName === secondLord && a.aspectType === 0);
        const conjWith7th = p.aspects.some((a) => a.planetName === seventhLord && a.aspectType === 0);
        if (conjWith2nd || conjWith7th) {
            marakas.add(p.name);
        }
    }

    return Array.from(marakas);
}

function computeAtmakaraka(planets: Planet[]): number {
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

function addYearsToDate(date: Date, years: number): Date {
    const d = new Date(date);
    const y = Math.floor(years);
    const rem = years - y;
    const m = Math.floor(rem * 12);
    const days = Math.round((rem * 12 - m) * 30);
    d.setFullYear(d.getFullYear() + y);
    if (m > 0) d.setMonth(d.getMonth() + m);
    if (days > 0) d.setDate(d.getDate() + days);
    return d;
}

function addMonthsToDate(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + Math.floor(months));
    return d;
}

function addDaysToDate(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function addHoursToDate(date: Date, hours: number): Date {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

function toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function toISODatetime(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

function yearsBetween(from: Date, to: Date): number {
    const diffMs = to.getTime() - from.getTime();
    return +(diffMs / (365.25 * 24 * 60 * 60 * 1000)).toFixed(4);
}

function getStartPlanetIndex(planet: number): number {
    return PLANET_TO_CYCLE_INDEX[planet] ?? 0;
}

function getPlanetYears(planet: number): number {
    const entry = VIMSHOTTARI_CYCLE.find((e) => e.planet === planet);
    return entry?.years ?? 0;
}

function getCyclePlanets(startIndex: number, count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(VIMSHOTTARI_CYCLE[(startIndex + i) % 9].planet);
    }
    return result;
}

function fractionToDays(fractionOfYear: number): number {
    return Math.round(fractionOfYear * 365.25);
}

function fractionToMonths(fractionOfYear: number): number {
    return Math.round(fractionOfYear * 12);
}

function yearsToDays(years: number): number {
    return Math.round(years * 365.25);
}

function computeSubPeriods(
    yearsTotal: number,
    startDate: Date,
    lordPlanet: number,
    maxDepth: number,
    birthDate: Date,
    adStartOffset: number = 0,
    fullYearsForProportion?: number,
): { antardasha: Antardasha[]; vidasa: Vidasa[]; sukshama: Sukshama[]; prana: Prana[] } {
    const proportionYears = fullYearsForProportion ?? yearsTotal;
    const fullAdPlanets = getCyclePlanets(getStartPlanetIndex(lordPlanet), 9);
    const adPlanets =
        adStartOffset === 0
            ? fullAdPlanets
            : [...fullAdPlanets.slice(adStartOffset), ...fullAdPlanets.slice(0, adStartOffset)];
    const endDate = addYearsToDate(new Date(startDate), yearsTotal);

    // Pre-compute all 9 AD full-proportion durations
    const fullAdDurations: number[] = [];
    for (let ai = 0; ai < 9; ai++) {
        const adLord = fullAdPlanets[ai];
        fullAdDurations.push((proportionYears * getPlanetYears(adLord)) / TOTAL_VIMSHOTTARI_YEARS);
    }

    const adList: Antardasha[] = [];
    let currentDate = new Date(startDate);

    for (let ai = 0; ai < adPlanets.length; ai++) {
        const adLord = adPlanets[ai];
        const adFullDuration = fullAdDurations[(adStartOffset + ai) % 9];
        const remainingFromStart = yearsBetween(currentDate, endDate);

        if (remainingFromStart <= 0.0001) break;

        if (ai === adPlanets.length - 1) {
            // Last AD fills to parent end
            const adStart = new Date(currentDate);
            const adStartAge = yearsBetween(birthDate, adStart);
            adList.push({
                planet: adLord,
                startDate: toISODate(adStart),
                endDate: toISODate(endDate),
                durationMonths: Math.round(yearsBetween(adStart, endDate) * 12),
                vidasa: [],
                startAge: adStartAge,
            });
            break;
        }

        // First AD (containing birth): start = birth, end = theoretical end or capped
        let adEnd: Date;
        if (ai === 0) {
            const theoreticalEnd = addYearsToDate(new Date(startDate), adFullDuration);
            adEnd = theoreticalEnd < endDate ? theoreticalEnd : new Date(endDate);
        } else {
            const actualDuration = Math.min(adFullDuration, remainingFromStart);
            adEnd = addYearsToDate(new Date(currentDate), actualDuration);
            if (adEnd > endDate) adEnd = new Date(endDate);
        }

        const adStart = new Date(currentDate);
        const adDurationYears = yearsBetween(adStart, adEnd);
        const adMonths = Math.round(adDurationYears * 12);

        if (adMonths < 1) {
            currentDate = new Date(adEnd);
            continue;
        }

        const adStartAge = yearsBetween(birthDate, adStart);
        const adYears = adFullDuration;

        const vidasaList: Vidasa[] = [];
        if (maxDepth >= 3) {
            let vdDate = new Date(adStart);

            // Compute vidasa offset for the first AD (which has remaining balance)
            let vdPlanets: number[] = [];
            let remainingVdCount = 9;
            let vdStartOffset = 0;
            let firstVdRemainingDays: number | null = null;

            if (ai === 0 && adStartOffset > 0) {
                const totalFullYears = fullYearsForProportion ?? yearsTotal;
                const elapsedYears = totalFullYears - yearsTotal;
                let preAdYears = 0;
                for (let i = 0; i < adStartOffset; i++) {
                    preAdYears += fullAdDurations[i];
                }
                const elapsedInAd = elapsedYears - preAdYears;

                const fullVdSequence = getCyclePlanets(getStartPlanetIndex(adPlanets[0]), 9);

                const fullVdDurations: number[] = [];
                for (let vi = 0; vi < 9; vi++) {
                    fullVdDurations.push(
                        (adFullDuration * getPlanetYears(fullVdSequence[vi])) / TOTAL_VIMSHOTTARI_YEARS,
                    );
                }

                let cumVd = 0;
                for (let vi = 0; vi < 9; vi++) {
                    cumVd += fullVdDurations[vi];
                    if (cumVd > elapsedInAd) {
                        vdStartOffset = vi;
                        let preVdYears = 0;
                        for (let j = 0; j < vi; j++) {
                            preVdYears += fullVdDurations[j];
                        }
                        const elapsedInVd = elapsedInAd - preVdYears;
                        firstVdRemainingDays = fractionToDays(fullVdDurations[vi] - elapsedInVd);
                        break;
                    }
                }

                remainingVdCount = 9 - vdStartOffset;
                vdPlanets = fullVdSequence.slice(vdStartOffset);
            } else {
                for (let i = 0; i < 9; i++) {
                    vdPlanets.push(adPlanets[(ai + i) % 9]);
                }
            }

            for (let vi = 0; vi < remainingVdCount; vi++) {
                const vdLord = vdPlanets[vi];
                const vdYears = (adFullDuration * getPlanetYears(vdLord)) / TOTAL_VIMSHOTTARI_YEARS;
                const vdDays =
                    firstVdRemainingDays !== null && vi === 0 ? firstVdRemainingDays : fractionToDays(vdYears);

                if (vdDays < 1 && vi < remainingVdCount - 1) continue;

                const vdStart = new Date(vdDate);
                let vdEnd: Date;

                if (vi === remainingVdCount - 1) {
                    vdEnd = new Date(adEnd);
                } else {
                    vdEnd = addDaysToDate(vdStart, vdDays);
                }

                const sukshamaList: Sukshama[] = [];
                if (maxDepth >= 4) {
                    let skDate = new Date(vdStart);

                    // Compute sukshama offset for the first VD (which has remaining balance)
                    let skPlanets: number[] = [];
                    let remainingSkCount = 9;
                    let skStartOffset = 0;
                    let firstSkRemainingDays: number | null = null;

                    if (ai === 0 && vi === 0 && vdStartOffset > 0) {
                        const totalFullYears = fullYearsForProportion ?? yearsTotal;
                        const elapsedYears = totalFullYears - yearsTotal;
                        let preAdYears = 0;
                        for (let i = 0; i < adStartOffset; i++) {
                            preAdYears += fullAdDurations[i];
                        }
                        const elapsedInAd = elapsedYears - preAdYears;

                        const fullVdSequence = getCyclePlanets(getStartPlanetIndex(adPlanets[0]), 9);
                        let preVdYears = 0;
                        for (let j = 0; j < vdStartOffset; j++) {
                            preVdYears +=
                                (adFullDuration * getPlanetYears(fullVdSequence[j])) / TOTAL_VIMSHOTTARI_YEARS;
                        }
                        const elapsedInVd = elapsedInAd - preVdYears;

                        const fullSkSequence = getCyclePlanets(getStartPlanetIndex(vdPlanets[0]), 9);

                        const fullSkDurations: number[] = [];
                        for (let si = 0; si < 9; si++) {
                            fullSkDurations.push(
                                (vdYears * getPlanetYears(fullSkSequence[si])) / TOTAL_VIMSHOTTARI_YEARS,
                            );
                        }

                        let cumSk = 0;
                        for (let si = 0; si < 9; si++) {
                            cumSk += fullSkDurations[si];
                            if (cumSk > elapsedInVd) {
                                skStartOffset = si;
                                let preSkYears = 0;
                                for (let j = 0; j < si; j++) {
                                    preSkYears += fullSkDurations[j];
                                }
                                const elapsedInSk = elapsedInVd - preSkYears;
                                firstSkRemainingDays = fractionToDays(fullSkDurations[si] - elapsedInSk);
                                break;
                            }
                        }

                        remainingSkCount = 9 - skStartOffset;
                        skPlanets = fullSkSequence.slice(skStartOffset);
                    } else {
                        for (let i = 0; i < 9; i++) {
                            skPlanets.push(adPlanets[(ai + vi + i) % 9]);
                        }
                    }

                    for (let si = 0; si < remainingSkCount; si++) {
                        const skLord = skPlanets[si];
                        const skYears = (vdYears * getPlanetYears(skLord)) / TOTAL_VIMSHOTTARI_YEARS;
                        const skDays =
                            firstSkRemainingDays !== null && si === 0 ? firstSkRemainingDays : fractionToDays(skYears);

                        if (skDays < 1 && si < remainingSkCount - 1) continue;

                        const skStart = new Date(skDate);
                        let skEnd: Date;

                        if (si === remainingSkCount - 1) {
                            skEnd = new Date(vdEnd);
                        } else {
                            skEnd = addDaysToDate(skStart, skDays);
                        }

                        const pranaList: Prana[] = [];
                        if (maxDepth >= 5) {
                            let prDate = new Date(skStart);

                            for (let pi = 0; pi < 9; pi++) {
                                const prLord = adPlanets[(ai + vi + si + pi) % 9];
                                const prYears = (skYears * getPlanetYears(prLord)) / TOTAL_VIMSHOTTARI_YEARS;
                                const prHours = Math.round(prYears * 365.25 * 24);

                                if (prHours < 1 && pi < 8) continue;

                                const prStart = new Date(prDate);
                                let prEnd: Date;

                                if (pi === 8) {
                                    prEnd = new Date(skEnd);
                                } else {
                                    prEnd = addHoursToDate(prStart, prHours);
                                }

                                pranaList.push({
                                    planet: prLord,
                                    startDate: toISODatetime(prStart),
                                    endDate: toISODatetime(prEnd),
                                    durationHours: prHours,
                                    startAge: yearsBetween(birthDate, prStart),
                                });

                                prDate = new Date(prEnd);
                            }
                        }

                        sukshamaList.push({
                            planet: skLord,
                            startDate: toISODate(skStart),
                            endDate: toISODate(skEnd),
                            durationDays: skDays,
                            prana: pranaList,
                            startAge: yearsBetween(birthDate, skStart),
                        });

                        skDate = new Date(skEnd);
                    }
                }

                vidasaList.push({
                    planet: vdLord,
                    startDate: toISODate(vdStart),
                    endDate: toISODate(vdEnd),
                    durationDays: vdDays,
                    sukshama: sukshamaList,
                    startAge: yearsBetween(birthDate, vdStart),
                });

                vdDate = new Date(vdEnd);
            }
        }

        adList.push({
            planet: adLord,
            startDate: toISODate(adStart),
            endDate: toISODate(adEnd),
            durationMonths: adMonths,
            vidasa: vidasaList,
            startAge: yearsBetween(birthDate, adStart),
        });

        currentDate = new Date(adEnd);
    }

    return { antardasha: adList, vidasa: [], sukshama: [], prana: [] };
}

export function calculateDashas(
    moonLongitude: number,
    moonNakshatraId: number,
    moonNakshatraLord: number,
    birthDate: Date,
): DashaInfo {
    const nakshatraSpan = 360 / 27;
    const nakshatraStartDeg = (moonNakshatraId - 1) * nakshatraSpan;
    const degInNakshatra = moonLongitude - nakshatraStartDeg;
    const remainingDeg = nakshatraSpan - degInNakshatra;
    const balanceFraction = remainingDeg / nakshatraSpan;

    const firstLordFullYears = getPlanetYears(moonNakshatraLord);
    const remainingYearsAtBirth = +(firstLordFullYears * balanceFraction).toFixed(4);

    const startIndex = getStartPlanetIndex(moonNakshatraLord);

    const mahadashaList: Mahadasha[] = [];
    let currentDate = new Date(birthDate);

    for (let mi = 0; mi < 9; mi++) {
        const planet = VIMSHOTTARI_CYCLE[(startIndex + mi) % 9].planet;
        const fullYears = getPlanetYears(planet);

        let currentYears: number;
        if (mi === 0) {
            currentYears = remainingYearsAtBirth;
        } else {
            currentYears = fullYears;
        }

        const mdStart = new Date(currentDate);
        const mdEnd = addYearsToDate(mdStart, currentYears);

        // For the first MD (remaining balance), find which AD is running at birth
        // by computing where the elapsed portion falls in the full AD sequence
        let adStartOffset = 0;
        if (mi === 0 && remainingYearsAtBirth < fullYears) {
            const elapsedBeforeBirth = fullYears - remainingYearsAtBirth;
            let cum = 0;
            for (let ai = 0; ai < 9; ai++) {
                const adPlanet = VIMSHOTTARI_CYCLE[(getStartPlanetIndex(planet) + ai) % 9].planet;
                const adFullYears = (fullYears * getPlanetYears(adPlanet)) / TOTAL_VIMSHOTTARI_YEARS;
                cum += adFullYears;
                if (cum > elapsedBeforeBirth) {
                    adStartOffset = ai;
                    break;
                }
            }
        }

        const result = computeSubPeriods(
            currentYears,
            mdStart,
            planet,
            4,
            birthDate,
            adStartOffset,
            mi === 0 ? fullYears : undefined,
        );

        mahadashaList.push({
            planet,
            startDate: toISODate(mdStart),
            endDate: toISODate(mdEnd),
            durationYears: currentYears,
            remainingYearsAtBirth: mi === 0 ? remainingYearsAtBirth : 0,
            antardasha: result.antardasha,
            startAge: yearsBetween(birthDate, mdStart),
        });

        currentDate = new Date(mdEnd);
    }

    const now = new Date();
    const currentPeriod: CurrentPeriod = {
        mahadashaLord: mahadashaList[0].planet,
        antardashaLord: mahadashaList[0].antardasha[0]?.planet ?? mahadashaList[0].planet,
        vidasaLord: null,
        sukshamaLord: null,
        pranaLord: null,
    };

    for (const md of mahadashaList) {
        if (now >= new Date(md.startDate) && now < new Date(md.endDate)) {
            currentPeriod.mahadashaLord = md.planet;

            for (const ad of md.antardasha) {
                if (now >= new Date(ad.startDate) && now < new Date(ad.endDate)) {
                    currentPeriod.antardashaLord = ad.planet;

                    for (const vd of ad.vidasa) {
                        if (now >= new Date(vd.startDate) && now < new Date(vd.endDate)) {
                            currentPeriod.vidasaLord = vd.planet;

                            for (const sk of vd.sukshama) {
                                if (now >= new Date(sk.startDate) && now < new Date(sk.endDate)) {
                                    currentPeriod.sukshamaLord = sk.planet;

                                    for (const pr of sk.prana) {
                                        if (now >= new Date(pr.startDate) && now < new Date(pr.endDate)) {
                                            currentPeriod.pranaLord = pr.planet;
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
            break;
        }
    }

    return {
        mahadasha: mahadashaList,
        currentPeriod,
    };
}
