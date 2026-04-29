import ChartData from '../models/ChartData';
import StoredChartData from '../models/ChartDataStored';

export const depopulateChartData = (full: ChartData): StoredChartData => ({
  nakshatra: { id: full.nakshatra.id },
  nakshatraPada: full.nakshatraPada,
  tithi: full.tithi,
  planetaryPositions: full.planetaryPositions.map((p) => ({
    planet: { id: p.planet.id },
    degrees: p.degrees,
    house: { id: p.house.id },
    sign: { id: p.sign.id },
    starLoad: { id: p.starLoad.id },
    subLoad: { id: p.subLoad.id },
    subSubLoad: { id: p.subSubLoad.id },
    direct: p.direct,
  })),
  cuspalPositions: full.cuspalPositions.map((c) => ({
    id: c.id,
    sign: { id: c.sign.id },
    degrees: c.degrees,
    starLoad: { id: c.starLoad.id },
    subLoad: { id: c.subLoad.id },
    subSubLoad: { id: c.subSubLoad.id },
  })),
  dashas: full.dashas.map((d) => ({
    lord: { id: d.lord.id },
    startDate: d.startDate || null,
    endDate: d.endDate || null,
  })),
});
