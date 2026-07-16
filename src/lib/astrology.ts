export function formatDegree(deg: number): string {
  const totalVikala = Math.round(deg * 3600);
  const anshaka = Math.floor(totalVikala / 3600);
  const kala = Math.floor((totalVikala % 3600) / 60);
  const vikala = totalVikala % 60;
  return `${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")}`;
}

export interface Aspect {
  planetName: number;
  aspectType: number;
  planetAbsoluteDegree: number;
  degreeGap: number;
  exactAspectDegree: number;
  isBeneficial: boolean;
}

export interface Planet {
  name: number;
  sign: number;
  degree: number;
  absoluteDegree: number;
  house: number;
  nakshatra: number;
  pada: number;
  retrograde: boolean;
  combustion: boolean;
  strength: number;
  strengthLabel: string;
  aspects: Aspect[];
}

export interface House {
  houseNumber: number;
  startDegree: number;
  middleDegree: number;
  endDegree: number;
  sign: number;
  lord: number;
}

export interface Ascendant {
  sign: number;
  degree: number;
  lord: number;
}

export interface Nakshatra {
  id: number;
  pada: number;
  lord: number;
}

export interface NakshatraInfo {
  moonNakshatra: Nakshatra;
  ascendantNakshatra: Nakshatra;
}

export interface Mahadasha {
  planet: number;
  startDate: string;
  endDate: string;
  durationYears: number;
  antardasha: unknown[];
}

export interface DashaInfo {
  mahadasha: Mahadasha[];
  currentPeriod: { mahadashaLord: number; antardashaLord: number };
}

export interface DoshaInfo {
  doshas: unknown[];
}

export interface CalculationResult {
  ascendant: Ascendant;
  houses: House[];
  planets: Planet[];
  nakshatra: NakshatraInfo;
  dashas: DashaInfo;
  lord22ndDrekkana: number;
  lord64thNavamsa: number;
  badhakaPlanet: number[];
  marakaPlanets: number[];
  atmakaraka: number;
  yogas: unknown[];
  doshas: DoshaInfo;
}
