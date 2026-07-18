import { PlanetaryStrength } from "./astrologyEnums";

/** Maps a sign + navamsa-index-within-sign (1-9) to the D9 (navamsa) sign, using the standard
 *  movable/fixed/dual offset table. Shared by the D1 calculation pipeline and any client-side
 *  chart that needs to resolve navamsa wedge identity without a full recalculation. */
export function navamsaSign(sourceSign: number, navamsaNum: number): number {
    const NAVAMSA_OFFSET = [0, 8, 4];
    const offset = NAVAMSA_OFFSET[(sourceSign - 1) % 3];
    return ((sourceSign - 1 + offset + navamsaNum - 1) % 12) + 1;
}

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
    strength: PlanetaryStrength;
    navamsaSign: number;
    navamsaStrength: PlanetaryStrength;
    aspects: Aspect[];
}

export interface House {
    houseNumber: number;
    startDegree: number;
    startSign: number;
    startLord: number;
    middleDegree: number;
    middleSign: number;
    middleLord: number;
    endDegree: number;
    endSign: number;
    endLord: number;
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
