import ChartData from '../models/ChartData';
import StoredChartData from '../models/ChartDataStored';

const PLANETS: Record<number, { id: number; name: string; code: string }> = {
  1: { id: 1, name: 'Sun', code: 'Su' },
  2: { id: 2, name: 'Moon', code: 'Mo' },
  3: { id: 3, name: 'Mars', code: 'Ma' },
  4: { id: 4, name: 'Mercury', code: 'Me' },
  5: { id: 5, name: 'Jupiter', code: 'Ju' },
  6: { id: 6, name: 'Venus', code: 'Ve' },
  7: { id: 7, name: 'Saturn', code: 'Sa' },
  8: { id: 8, name: 'Rahu', code: 'Ra' },
  9: { id: 9, name: 'Kethu', code: 'Ke' },
};

const SIGNS: Record<number, { id: number; name: string }> = {
  1: { id: 1, name: 'Aries' },
  2: { id: 2, name: 'Taurus' },
  3: { id: 3, name: 'Gemini' },
  4: { id: 4, name: 'Cancer' },
  5: { id: 5, name: 'Leo' },
  6: { id: 6, name: 'Virgo' },
  7: { id: 7, name: 'Libra' },
  8: { id: 8, name: 'Scorpio' },
  9: { id: 9, name: 'Sagittarius' },
  10: { id: 10, name: 'Capricorn' },
  11: { id: 11, name: 'Aquarius' },
  12: { id: 12, name: 'Pisces' },
};

const NAKSHATRAS: Record<number, { id: number; name: string }> = {
  1: { id: 1, name: 'Ashwini' },
  2: { id: 2, name: 'Bharani' },
  3: { id: 3, name: 'Krittika' },
  4: { id: 4, name: 'Rohini' },
  5: { id: 5, name: 'Mrigashirsha' },
  6: { id: 6, name: 'Ardra' },
  7: { id: 7, name: 'Punarvasu' },
  8: { id: 8, name: 'Pushya' },
  9: { id: 9, name: 'Ashlesha' },
  10: { id: 10, name: 'Magha' },
  11: { id: 11, name: 'PurvaPhalguni' },
  12: { id: 12, name: 'UttaraPhalguni' },
  13: { id: 13, name: 'Hasta' },
  14: { id: 14, name: 'Chitra' },
  15: { id: 15, name: 'Swati' },
  16: { id: 16, name: 'Vishakha' },
  17: { id: 17, name: 'Anuradha' },
  18: { id: 18, name: 'Jyeshtha' },
  19: { id: 19, name: 'Mula' },
  20: { id: 20, name: 'PurvaShadha' },
  21: { id: 21, name: 'UttaraShadha' },
  22: { id: 22, name: 'Shravana' },
  23: { id: 23, name: 'Dhanishta' },
  24: { id: 24, name: 'Shatabhisha' },
  25: { id: 25, name: 'PurvaBhadrapada' },
  26: { id: 26, name: 'UttaraBhadrapada' },
  27: { id: 27, name: 'Revati' },
};

const SIGN_LORDS: Record<number, number> = {
  1: 3, 2: 6, 3: 4, 4: 2, 5: 1, 6: 4, 7: 6, 8: 3, 9: 5, 10: 7, 11: 7, 12: 5,
};

const NAKSHATRA_LORDS: Record<number, number> = {
  1: 9, 2: 6, 3: 1, 4: 2, 5: 3, 6: 8, 7: 5, 8: 7, 9: 4, 10: 9, 11: 6, 12: 1,
  13: 2, 14: 3, 15: 8, 16: 5, 17: 7, 18: 4, 19: 9, 20: 6, 21: 1, 22: 2, 23: 3,
  24: 8, 25: 5, 26: 7, 27: 4,
};

function planet(id: number): ChartData['planetaryPositions'][0]['planet'] {
  return PLANETS[id] ?? { id, name: '', code: '' };
}

function sign(id: number): ChartData['cuspalPositions'][0]['sign'] {
  const base = SIGNS[id] ?? { id, name: '' };
  return { ...base, load: planet(SIGN_LORDS[id] ?? 0) };
}

function nakshatra(id: number): ChartData['nakshatra'] {
  const base = NAKSHATRAS[id] ?? { id, name: '' };
  return { ...base, load: planet(NAKSHATRA_LORDS[id] ?? 0) };
}

export const populateChartData = (stored: StoredChartData): ChartData => ({
  nakshatra: nakshatra(stored.nakshatra.id),
  nakshatraPada: stored.nakshatraPada,
  tithi: stored.tithi,
  planetaryPositions: stored.planetaryPositions.map((p) => ({
    planet: planet(p.planet.id),
    degrees: p.degrees,
    house: { id: p.house.id },
    sign: sign(p.sign.id),
    starLoad: planet(p.starLoad.id),
    subLoad: planet(p.subLoad.id),
    subSubLoad: planet(p.subSubLoad.id),
    direct: p.direct,
  })),
  cuspalPositions: stored.cuspalPositions.map((c) => ({
    id: c.id,
    sign: sign(c.sign.id),
    degrees: c.degrees,
    starLoad: planet(c.starLoad.id),
    subLoad: planet(c.subLoad.id),
    subSubLoad: planet(c.subSubLoad.id),
  })),
  dashas: stored.dashas.map((d) => ({
    lord: planet(d.lord.id),
    startDate: d.startDate ?? '',
    endDate: d.endDate ?? '',
    subDashaPeriods: [],
  })),
});
