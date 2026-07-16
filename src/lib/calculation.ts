import { IHoroscope } from "@/models/Horoscope";
import { Planet, House, Aspect, Ascendant, CalculationResult } from "@/lib/astrology";
import logger from "@/lib/logger";
import jyotish from "jyotish-calculations";
import swisseph from "swisseph-v2";

const GRAHA_MAP: Record<string, number> = {
  Su: 1, Mo: 2, Ma: 3, Me: 4, Ju: 5, Ve: 6, Sa: 7, Ra: 8, Ke: 9,
};

const RASHI_MAP: Record<string, number> = {
  Ar: 1, Ta: 2, Ge: 3, Cn: 4, Le: 5, Vi: 6, Li: 7, Sc: 8, Sg: 9, Cp: 10, Aq: 11, Pi: 12,
};

const NAKSHATRA_NAMES: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyestha",
  "Mula", "Purva Aashada", "Uttara Aashada", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const AYANAMSHA_MAP: Record<string, number> = {
  lahari: 1,
  raman: 3,
  krishnamurti: 5,
  yukteshwar: 7,
};

const SIGN_LORD: Record<number, number> = {
  1: 3, 2: 6, 3: 4, 4: 2, 5: 1, 6: 4,
  7: 6, 8: 3, 9: 5, 10: 7, 11: 7, 12: 5,
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
  1: 1, 2: 2, 3: 10, 4: 6, 5: 4, 6: 12, 7: 7,
};

const DEBILITATION: Record<number, number> = {
  1: 7, 2: 8, 3: 4, 4: 12, 5: 10, 6: 6, 7: 1,
};

const OWN_SIGNS: Record<number, number[]> = {
  1: [5], 2: [4], 3: [1, 8], 4: [3, 6], 5: [9, 12], 6: [2, 7], 7: [10, 11],
};

const MOOLATRIKONA: Record<number, number> = {
  1: 5, 2: 4, 3: 1, 4: 6, 5: 9, 6: 7, 7: 11,
};

const NATURAL_FRIENDS: Record<number, number[]> = {
  1: [2, 3, 5], 2: [1, 4], 3: [1, 2, 5], 4: [1, 6], 5: [1, 2, 3], 6: [4, 7], 7: [4, 6],
  8: [], 9: [],
};

const NATURAL_ENEMIES: Record<number, number[]> = {
  1: [6, 7], 2: [], 3: [4], 4: [2], 5: [4, 6], 6: [1, 2], 7: [1, 2, 3],
  8: [], 9: [],
};

const STRENGTH_VALUES: Record<string, number> = {
  exalted: 1, debilitated: -1, moolatrikona: 0.75, ownSign: 0.5, friendly: 0.1, neutral: 0, enemy: -0.1,
};

function computePlanetStrength(planet: number, sign: number): { strength: number; strengthLabel: string } {
  if (EXALTATION[planet] === sign) return { strength: STRENGTH_VALUES.exalted, strengthLabel: "exalted" };
  if (DEBILITATION[planet] === sign) return { strength: STRENGTH_VALUES.debilitated, strengthLabel: "debilitated" };
  if (MOOLATRIKONA[planet] === sign) return { strength: STRENGTH_VALUES.moolatrikona, strengthLabel: "moolatrikona" };
  if (OWN_SIGNS[planet]?.includes(sign)) return { strength: STRENGTH_VALUES.ownSign, strengthLabel: "ownSign" };

  const signLord = SIGN_LORD[sign];
  if (NATURAL_FRIENDS[planet]?.includes(signLord)) return { strength: STRENGTH_VALUES.friendly, strengthLabel: "friendly" };
  if (NATURAL_ENEMIES[planet]?.includes(signLord)) return { strength: STRENGTH_VALUES.enemy, strengthLabel: "enemy" };
  return { strength: STRENGTH_VALUES.neutral, strengthLabel: "neutral" };
}

export function calculateHoroscope(data: IHoroscope): CalculationResult {
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

  logger.info({ dateString, timeString, lat: data.latitude, lng: data.longitude, timezone, ayanamshaId }, "calling jyotish-calculations");

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
  const jd = swisseph.swe_utc_to_jd(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second, swisseph.SE_GREG_CAL);
  swisseph.swe_set_sid_mode(ayanamshaId, 0, 0);
  const sweResult = swisseph.swe_houses_ex(jd.julianDayUT, swisseph.SEFLG_SIDEREAL, data.latitude, data.longitude, "P");
  const cusps = sweResult.house;

  const h1Size = (cusps[1] - cusps[0] + 360) % 360;
  const halfH1 = h1Size / 2;

  const houses: House[] = Array.from({ length: 12 }, (_, i) => {
    const start = (cusps[i] - halfH1 + 360) % 360;
    const end = (cusps[(i + 1) % 12] - halfH1 + 360) % 360;
    const endAdj = end < start ? end + 360 : end;
    const mid = (start + endAdj) / 2;
    const midNorm = mid % 360;
    return {
      houseNumber: i + 1,
      startDegree: +(start % 30).toFixed(2),
      middleDegree: +((mid % 360) % 30).toFixed(2),
      endDegree: +(end % 30).toFixed(2),
      sign: Math.floor(midNorm / 30) + 1,
      lord: SIGN_LORD[Math.floor(midNorm / 30) + 1] || Math.floor(midNorm / 30) + 1,
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

  for (let i = 0; i < planetDetails.length; i++) {
    planetDetails[i].combustion = i === 0
      ? false
      : Math.abs(planetDetails[i].absoluteDegree - sunLong) < 8
      || Math.abs(planetDetails[i].absoluteDegree - sunLong + 360) < 8
      || Math.abs(planetDetails[i].absoluteDegree - sunLong - 360) < 8;

    const aspects: Aspect[] = [];
    for (let j = 0; j < planetDetails.length; j++) {
      if (i === j) continue;
      const dist = Math.abs(planetDetails[i].absoluteDegree - planetDetails[j].absoluteDegree);
      const rawDist = Math.min(dist, 360 - dist);
      const nearestAspect = ASPECT_TYPES.reduce((prev, curr) =>
        Math.abs(rawDist - curr) < Math.abs(rawDist - prev) ? curr : prev
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

  const nakshatraLords = [
    9, 6, 7, 1, 2, 3, 4, 7, 5, 9, 6, 7,
    1, 2, 3, 4, 7, 5, 9, 6, 7, 1, 2, 3,
    4, 7, 5,
  ];

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
    lord22ndDrekkana: ((ascSign + 22 - 1) % 12) + 1,
    lord64thNavamsa: ((ascSign + 64 - 1) % 12) + 1,
    badhakaPlanet: computeBadhaka(ascSign),
    marakaPlanets: computeMaraka(houses),
    atmakaraka: computeAtmakaraka(planetDetails),
    yogas: [],
    doshas: { doshas: [] },
  };
}

function computeBadhaka(ascSign: number): number[] {
  const badhakaSigns: Record<number, number> = {
    1: 11, 2: 12, 3: 1, 4: 2, 5: 3, 6: 4,
    7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10,
  };
  const badhakaSign = badhakaSigns[ascSign] || 7;
  return [badhakaSign];
}

function computeMaraka(houses: House[]): number[] {
  const h2 = houses.find((h) => h.houseNumber === 2);
  const h7 = houses.find((h) => h.houseNumber === 7);
  return [h2?.lord || 2, h7?.lord || 7];
}

function computeAtmakaraka(planets: Planet[]): number {
  let maxDeg = -1;
  let atmakaraka = 1;
  for (const p of planets) {
    if (p.absoluteDegree > maxDeg) {
      maxDeg = p.absoluteDegree;
      atmakaraka = p.name;
    }
  }
  return atmakaraka;
}
