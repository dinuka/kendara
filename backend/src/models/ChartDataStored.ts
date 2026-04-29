interface StoredPlanet {
  id: number;
}

interface StoredSign {
  id: number;
}

interface StoredNakshatra {
  id: number;
}

interface StoredHouse {
  id: number;
}

interface StoredDegrees {
  d: number;
  m: number;
  s: number;
}

interface StoredPlanetaryPosition {
  planet: StoredPlanet;
  degrees: StoredDegrees;
  house: StoredHouse;
  sign: StoredSign;
  starLoad: StoredPlanet;
  subLoad: StoredPlanet;
  subSubLoad: StoredPlanet;
  direct: boolean;
}

interface StoredCuspalPosition {
  id: number;
  sign: StoredSign;
  degrees: StoredDegrees;
  starLoad: StoredPlanet;
  subLoad: StoredPlanet;
  subSubLoad: StoredPlanet;
}

interface StoredDashaPeriod {
  lord: StoredPlanet;
  startDate: string | null;
  endDate: string | null;
}

interface StoredChartData {
  nakshatra: StoredNakshatra;
  nakshatraPada: number;
  tithi: {
    paksha: string;
    number: number;
  };
  planetaryPositions: StoredPlanetaryPosition[];
  cuspalPositions: StoredCuspalPosition[];
  dashas: StoredDashaPeriod[];
}

export default StoredChartData;
