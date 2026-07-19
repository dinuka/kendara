<<<<<<< Updated upstream
=======
import { PlanetaryStrength } from "./astrologyEnums";

export const PLANET_SYMBOLS: Record<number, string> = {
    1: "\u2609",
    2: "\u263D",
    3: "\u2642",
    4: "\u263F",
    5: "\u2643",
    6: "\u2640",
    7: "\u2644",
    8: "\u260A",
    9: "\u260B",
};

export const PLANET_COLORS: Record<number, string> = {
    1: "#dc2626",
    2: "#64748b",
    3: "#c2410c",
    4: "#16a34a",
    5: "#1e293b",
    6: "#1d4ed8",
    7: "#0891b2",
    8: "#7c3aed",
    9: "#92400e",
};

/** Maps a sign + navamsa-index-within-sign (1-9) to the D9 (navamsa) sign, using the standard
 *  movable/fixed/dual offset table. Shared by the D1 calculation pipeline and any client-side
 *  chart that needs to resolve navamsa wedge identity without a full recalculation. */
export function navamsaSign(sourceSign: number, navamsaNum: number): number {
    const NAVAMSA_OFFSET = [0, 8, 4];
    const offset = NAVAMSA_OFFSET[(sourceSign - 1) % 3];
    return ((sourceSign - 1 + offset + navamsaNum - 1) % 12) + 1;
}

export function formatDashaDuration(years: number, months: number, days: number): string {
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "0 days";
}

export function formatYearDuration(years: number): string {
    const y = Math.floor(years);
    const rem = years - y;
    const m = Math.floor(rem * 12);
    const d = Math.round((rem * 12 - m) * 30);
    return formatDashaDuration(y, m, d);
}

export function formatMonthDuration(months: number): string {
    const m = Math.floor(months);
    const d = Math.round((months - m) * 30);
    return formatDashaDuration(0, m, d);
}

export function formatDayDuration(days: number): string {
    const d = Math.round(days);
    return formatDashaDuration(0, 0, d);
}

>>>>>>> Stashed changes
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

export interface Prana {
    planet: number;
    startDate: string;
    endDate: string;
    durationHours: number;
    startAge: number;
}

export interface Sukshama {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    prana: Prana[];
    startAge: number;
}

export interface Vidasa {
    planet: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    sukshama: Sukshama[];
    startAge: number;
}

export interface Antardasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationMonths: number;
    vidasa: Vidasa[];
    startAge: number;
}

export interface Mahadasha {
    planet: number;
    startDate: string;
    endDate: string;
    durationYears: number;
    remainingYearsAtBirth: number;
    antardasha: Antardasha[];
    startAge: number;
}

export interface CurrentPeriod {
    mahadashaLord: number;
    antardashaLord: number;
    vidasaLord: number | null;
    sukshamaLord: number | null;
    pranaLord: number | null;
}

export interface Dashas {
    mahadasha: Mahadasha[];
    currentPeriod: CurrentPeriod;
}

export interface DashaInfo {
    mahadasha: Mahadasha[];
    currentPeriod: CurrentPeriod;
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
