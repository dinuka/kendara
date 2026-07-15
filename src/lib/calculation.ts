import { IHoroscope } from "@/models/Horoscope";
import logger from "@/lib/logger";

function getSign(degree: number): number {
  return Math.floor(degree / 30) + 1;
}

function getNakshatra(degree: number): { id: number; pada: number; lord: number } {
  const normalized = ((degree % 360) + 360) % 360;
  const nakshatraDegree = 13.3333;
  const idx = Math.floor(normalized / nakshatraDegree);
  const padas = [0, 3.3333, 6.6667, 10.0];
  const nakshatraLords = [
    9, 6, 7, 1, 2, 3, 4, 7, 5, 9, 6, 7,
    1, 2, 3, 4, 7, 5, 9, 6, 7, 1, 2, 3,
    4, 7, 5,
  ];
  const padIdx = padas.findIndex((p) => normalized % nakshatraDegree < p + 3.3333);
  return {
    id: (idx % 27) + 1,
    pada: (padIdx >= 0 ? padIdx : 0) + 1,
    lord: nakshatraLords[idx % 27],
  };
}

export function calculateHoroscope(data: IHoroscope) {
  logger.info({ name: data.name, ayanamsha: data.ayanamsha }, "starting horoscope calculation");

  const birthDate = new Date(data.birthDate);
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();

  const jd = 367 * year - Math.floor(7 * (year + Math.floor((month + 9) / 12)) / 4) +
    Math.floor(275 * month / 9) + day + 1721013.5;
  logger.debug("Julian day = %d", jd);

  const sunLong = ((jd - 2451545.0) / 365.25) * 360 % 360;
  const moonLong = ((jd - 2451545.0) / 27.32) * 360 % 360;
  const marsLong = ((jd - 2451545.0) / 686.97) * 360 % 360;
  const mercLong = ((jd - 2451545.0) / 87.97) * 360 % 360;
  const jupLong = ((jd - 2451545.0) / 4332.59) * 360 % 360;
  const venLong = ((jd - 2451545.0) / 224.7) * 360 % 360;
  const satLong = ((jd - 2451545.0) / 10759.22) * 360 % 360;
  const rahuLong = (360 - ((jd - 2451545.0) / 6793.0) * 360 % 360 + 360) % 360;
  const ketuLong = (rahuLong + 180) % 360;

  const ayanamshaOffset = data.ayanamsha === "lahiri" ? 23.15 : data.ayanamsha === "raman" ? 22.86 : 23.0;
  logger.debug("ayanamsha offset = %d", ayanamshaOffset);

  const planets = [
    { name: 1, deg: (sunLong - ayanamshaOffset + 360) % 360 },
    { name: 2, deg: (moonLong - ayanamshaOffset + 360) % 360 },
    { name: 3, deg: (marsLong - ayanamshaOffset + 360) % 360 },
    { name: 4, deg: (mercLong - ayanamshaOffset + 360) % 360 },
    { name: 5, deg: (jupLong - ayanamshaOffset + 360) % 360 },
    { name: 6, deg: (venLong - ayanamshaOffset + 360) % 360 },
    { name: 7, deg: (satLong - ayanamshaOffset + 360) % 360 },
    { name: 8, deg: rahuLong },
    { name: 9, deg: ketuLong },
  ];

  const ascLong = (sunLong + 90) % 360;
  const ascSign = getSign((ascLong - ayanamshaOffset + 360) % 360);
  logger.debug({ ascSign, ascDegree: +(ascLong % 30).toFixed(2) }, "ascendant calculated");

  const planetDetails: Array<Record<string, unknown>> = planets.map((p, i) => ({
    name: p.name,
    sign: getSign(p.deg),
    degree: +(p.deg % 30).toFixed(2),
    absoluteDegree: +p.deg.toFixed(2),
    house: ((getSign(p.deg) - ascSign + 12) % 12) + 1,
    nakshatra: getNakshatra(p.deg).id,
    pada: getNakshatra(p.deg).pada,
    retrograde: false,
    combustion: i === 0 ? false : Math.abs(p.deg - sunLong) < 8,
    strength: 0,
    aspects: [] as Array<Record<string, unknown>>,
  }));

  const houses = Array.from({ length: 12 }, (_, i) => ({
    houseNumber: i + 1,
    startDegree: +(((ascLong - ayanamshaOffset + 360) % 360) + i * 30).toFixed(2),
    middleDegree: +(((ascLong - ayanamshaOffset + 360) % 360) + i * 30 + 15).toFixed(2),
    endDegree: +(((ascLong - ayanamshaOffset + 360) % 360) + i * 30 + 30).toFixed(2),
    sign: ((ascSign + i - 1) % 12) + 1,
    lord: ((ascSign + i - 1) % 12) + 1,
  }));

  const aspectTypes = [0, 60, 90, 120, 180];
  for (let i = 0; i < planetDetails.length; i++) {
    const aspects: Array<Record<string, unknown>> = [];
    for (let j = 0; j < planetDetails.length; j++) {
      if (i === j) continue;
      const dist = Math.abs(
        (planetDetails[i].absoluteDegree as number) -
        (planetDetails[j].absoluteDegree as number)
      );
      const rawDist = Math.min(dist, 360 - dist);
      const nearestAspect = aspectTypes.reduce((prev, curr) =>
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

  planetDetails.forEach((p, i) => {
    p.strength = p.name === 1 ? 1 : p.name === 2 ? -1 : 0;
  });

  logger.info("calculation complete: %d planets, %d houses", planetDetails.length, houses.length);

  return {
    ascendant: { sign: ascSign, degree: +(ascLong % 30).toFixed(2), lord: ascSign },
    houses,
    planets: planetDetails,
    nakshatra: {
      moonNakshatra: getNakshatra(moonLong),
      ascendantNakshatra: getNakshatra(ascLong),
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
    badhakaPlanet: [7],
    marakaPlanets: [6, 7],
    atmakaraka: 1,
    yogas: [],
    doshas: { doshas: [] },
  };
}
