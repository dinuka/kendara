import jyotish from "jyotish-calculations";
import swisseph from "swisseph-v2";

import { IHoroscope } from "@/models/Horoscope";

import { Ascendant, Aspect, CalculationResult, House, Planet } from "@/lib/astrology";
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

const MOOLATRIKONA: Record<number, number> = {
    1: 5,
    2: 4,
    3: 1,
    4: 6,
    5: 9,
    6: 7,
    7: 11,
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

const STRENGTH_VALUES: Record<string, number> = {
    exalted: 1,
    debilitated: -1,
    moolatrikona: 0.75,
    ownSign: 0.5,
    friendly: 0.1,
    neutral: 0,
    enemy: -0.1,
};

function computePlanetStrength(planet: number, sign: number): { strength: number; strengthLabel: string } {
    if (EXALTATION[planet] === sign) return { strength: STRENGTH_VALUES.exalted, strengthLabel: "exalted" };
    if (DEBILITATION[planet] === sign) return { strength: STRENGTH_VALUES.debilitated, strengthLabel: "debilitated" };
    if (MOOLATRIKONA[planet] === sign) return { strength: STRENGTH_VALUES.moolatrikona, strengthLabel: "moolatrikona" };
    if (OWN_SIGNS[planet]?.includes(sign)) return { strength: STRENGTH_VALUES.ownSign, strengthLabel: "ownSign" };

    const signLord = SIGN_LORD[sign];
    if (NATURAL_FRIENDS[planet]?.includes(signLord))
        return { strength: STRENGTH_VALUES.friendly, strengthLabel: "friendly" };
    if (NATURAL_ENEMIES[planet]?.includes(signLord)) return { strength: STRENGTH_VALUES.enemy, strengthLabel: "enemy" };
    return { strength: STRENGTH_VALUES.neutral, strengthLabel: "neutral" };
}

const DEFAULT_ORBS: Record<string, number> = {
    "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0,
};

export function calculateHoroscope(data: IHoroscope, planetaryOrbs: Record<string, number> = DEFAULT_ORBS): CalculationResult {
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
            strength: 0,
            strengthLabel: "",
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
        const s = computePlanetStrength(p.name, p.sign);
        p.strength = s.strength;
        p.strengthLabel = s.strengthLabel;
    }

    logger.info("calculation complete: %d planets, %d houses", planetDetails.length, houses.length);

    const moonNakshatra = getNakshatraId(positions.Mo.nakshatra.name);
    const moonPada = positions.Mo.nakshatra.pada;
    const ascNakshatra = getNakshatraId(positions.La.nakshatra.name);
    const ascPada = positions.La.nakshatra.pada;

    const nakshatraLords = [9, 6, 7, 1, 2, 3, 4, 7, 5, 9, 6, 7, 1, 2, 3, 4, 7, 5, 9, 6, 7, 1, 2, 3, 4, 7, 5];

    return {
        ascendant,
        houses,
        planets: planetDetails,
        nakshatra: {
            moonNakshatra: { id: moonNakshatra, pada: moonPada, lord: nakshatraLords[moonNakshatra - 1] },
            ascendantNakshatra: { id: ascNakshatra, pada: ascPada, lord: nakshatraLords[ascNakshatra - 1] },
        },
        dashas: {
            mahadasha: [
                {
                    planet: 1,
                    startDate: new Date(year - 6, 0, 1).toISOString().split("T")[0],
                    endDate: new Date(year, 0, 1).toISOString().split("T")[0],
                    durationYears: 6,
                    antardasha: [],
                },
            ],
            currentPeriod: { mahadashaLord: 5, antardashaLord: 6 },
        },
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

function navamsaSign(sourceSign: number, navamsaNum: number): number {
    const NAVAMSA_OFFSET = [0, 8, 4];
    const offset = NAVAMSA_OFFSET[(sourceSign - 1) % 3];
    return ((sourceSign - 1 + offset + navamsaNum - 1) % 12) + 1;
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
