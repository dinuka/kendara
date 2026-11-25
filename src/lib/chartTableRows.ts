/**
 * Row models for the shared Houses / Planets tables.
 *
 * Every chart (the D1 from `calculatedDetails`, or a Warga Kendara entry) is converted into these
 * rows plus the set of columns it can actually fill. The table components only render rows — so
 * the Charts tab and the Calculations tab show identical values for the same column.
 */
import type { Aspect } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { ownedHousesOf } from "@/lib/manualChart";
import type { SubaAsubaEntry } from "@/lib/subaAsuba";
import type { HouseColumnId, PlanetColumnId } from "@/lib/tableColumns";
import type { WargaChartEntry } from "@/lib/wargaKendara";

/** A text tag of the Planets table "Other" column; `key` is one of PLANET_TAG_OPTIONS. */
export interface PlanetTableTag {
    key: string;
    text: string;
    strikethrough?: boolean;
}

export interface HouseTableRow {
    houseNumber: number;
    sign: number;
    /** Pre-formatted cusp labels — only charts with real cusps (D1) carry them. */
    start?: string;
    mid?: string;
    end?: string;
    /** Planets in the house, in display order; `degreeLabel` when a degree is known. */
    planets: { name: number; degreeLabel?: string }[];
    aspects: Aspect[];
    kendrasthana?: Aspect[];
}

export interface PlanetTableRow {
    name: number;
    retrograde: boolean;
    sign: number;
    /** In-sign degree (or manual navamsa range) label when known. */
    degreeLabel?: string;
    strength: PlanetaryStrength;
    house: number;
    ownership: number[];
    subaAsuba?: SubaAsubaEntry;
    navamsaSign?: number;
    navamsaStrength?: PlanetaryStrength;
    nakshatra?: { id: number; pada: number };
    bhavaSuchika?: number;
    conjunctions: Aspect[];
    aspects: Aspect[];
    kendrasthana?: Aspect[];
    tags: PlanetTableTag[];
}

export interface HouseTableData {
    rows: HouseTableRow[];
    available: ReadonlySet<HouseColumnId>;
}

export interface PlanetTableData {
    rows: PlanetTableRow[];
    available: ReadonlySet<PlanetColumnId>;
    /** Aspect tooltips show the degree delta only on degree-based charts (D1 and its rotations). */
    showAspectDelta: boolean;
}

/** Columns every chart can fill. */
export const CORE_HOUSE_COLUMNS: readonly HouseColumnId[] = ["number", "sign", "planets", "aspects"];
export const CORE_PLANET_COLUMNS: readonly PlanetColumnId[] = [
    "planet",
    "sign",
    "strength",
    "house",
    "ownership",
    "conjunctions",
    "aspects",
    "other",
];

/** AspectChip record for a whole-sign aspect: the sign angle IS the aspect — no degree gap or delta. */
export function wholeSignAspect(planetName: number, aspectType: number): Aspect {
    return {
        planetName,
        aspectType,
        planetAbsoluteDegree: 0,
        degreeGap: 0,
        exactAspectDegree: aspectType,
        isBeneficial: aspectType === 60 || aspectType === 120,
        delta: 0,
        reasons: [{ type: "planetary", angle: aspectType, delta: 0 }],
    };
}

/** Warga entry flag lists → "Other" tag keys (the same keys as the D1 tags). */
const WARGA_FLAG_TAGS: { key: string; labelKey: string; applies: (e: WargaChartEntry, p: number) => boolean }[] = [
    { key: "combustion", labelKey: "astrology.combustLabel", applies: (e, p) => !!e.combustPlanets?.includes(p) },
    { key: "drekkana", labelKey: "astrology.drekkanaLordLabel", applies: (e, p) => e.lord22ndDrekkana === p },
    { key: "navamsa", labelKey: "astrology.navamsaLordLabel", applies: (e, p) => e.lord64thNavamsa === p },
    { key: "atmakaraka", labelKey: "astrology.atmakarakaLabel", applies: (e, p) => e.atmakaraka === p },
    { key: "maranakaraka", labelKey: "astrology.maranakarakaLabel", applies: (e, p) => e.maranakaraka.includes(p) },
    { key: "maraka", labelKey: "astrology.marakaLabel", applies: (e, p) => e.marakaPlanets.includes(p) },
    { key: "badhaka", labelKey: "astrology.badhakaLabel", applies: (e, p) => !!e.badhakaPlanets?.includes(p) },
    { key: "ashtamansha", labelKey: "astrology.ashtamanshaLabel", applies: (e, p) => !!e.ashtamanshaPlanets?.includes(p) },
    { key: "wargoththama", labelKey: "astrology.wargoththamaLabel", applies: (e, p) => !!e.wargoththamaPlanets?.includes(p) },
    { key: "gandanta", labelKey: "astrology.gandantaLabel", applies: (e, p) => !!e.gandanthaPlanets?.includes(p) },
    { key: "gandamula", labelKey: "astrology.gandamulaLabel", applies: (e, p) => !!e.gandamulaPlanets?.includes(p) },
    { key: "pushkara", labelKey: "astrology.pushkaraLabel", applies: (e, p) => !!e.pushkaraPlanets?.includes(p) },
    { key: "cheshtaBala", labelKey: "astrology.cheshtaBalaLabel", applies: (e, p) => !!e.cheshtaBalaPlanets?.includes(p) },
    { key: "kalaBala", labelKey: "astrology.kalaBalaLabel", applies: (e, p) => !!e.kalaBalaPlanets?.includes(p) },
    { key: "digBala", labelKey: "astrology.digBalaLabel", applies: (e, p) => e.digBalaPlanets.includes(p) },
];

export function wargaPlanetTags(
    entry: WargaChartEntry,
    planetName: number,
    t: (key: string) => string,
): PlanetTableTag[] {
    const crossed = !!(entry.gandanthaPlanets?.includes(planetName) || entry.gandamulaPlanets?.includes(planetName));
    return WARGA_FLAG_TAGS.filter(({ applies }) => applies(entry, planetName)).map(({ key, labelKey }) => ({
        key,
        text: t(labelKey),
        ...(key === "wargoththama" ? { strikethrough: crossed } : {}),
    }));
}

export interface WargaRowOptions {
    /** Degree-based house aspect records (D1 rotations); omitted → the entry's whole-sign aspects. */
    houseAspects?: Record<number, Aspect[]>;
    /** Degree-based received-aspect records per planet; omitted → whole-sign from the entry. */
    planetAspects?: Record<number, Aspect[]>;
    /** Degree-based conjunction records per planet; omitted → whole-sign from the entry. */
    conjunctions?: Record<number, Aspect[]>;
    /** Whether aspects carry real degree differences (D1 rotations) — tooltips show the delta. */
    degreeBased: boolean;
    t: (key: string) => string;
}

/** Houses rows for a Warga Kendara entry (D9 / D3 / D30 / Surya & Chandra Lagna). */
export function buildWargaHouseData(entry: WargaChartEntry, options: WargaRowOptions): HouseTableData {
    return {
        rows: entry.houses.map((house) => ({
            houseNumber: house.houseNumber,
            sign: house.sign,
            planets: house.planets.map((name) => ({ name })),
            aspects:
                options.houseAspects?.[house.houseNumber] ??
                house.aspects.map(({ planetName, aspectType }) => wholeSignAspect(planetName, aspectType)),
        })),
        available: new Set(CORE_HOUSE_COLUMNS),
    };
}

/** Planets rows for a Warga Kendara entry. Aspects are those RECEIVED by the row planet. */
export function buildWargaPlanetData(entry: WargaChartEntry, options: WargaRowOptions): PlanetTableData {
    const receivedAspects = (planetName: number): Aspect[] => {
        if (options.planetAspects) return options.planetAspects[planetName] ?? [];
        const received: Aspect[] = [];
        entry.planets.forEach(({ name, aspects }) => {
            const aspect = aspects.find((a) => a.planetName === planetName);
            if (aspect) received.push(wholeSignAspect(name, aspect.aspectType));
        });
        return received;
    };
    const hasNakshatra = entry.planets.some((p) => p.nakshatra !== undefined && p.pada !== undefined);
    const available = new Set<PlanetColumnId>(CORE_PLANET_COLUMNS);
    if (hasNakshatra) available.add("nakshatra");
    return {
        rows: entry.planets.map((planet) => ({
            name: planet.name,
            retrograde: false,
            sign: planet.sign,
            strength: planet.strength ?? PlanetaryStrength.SAMA,
            house: planet.house,
            ownership: ownedHousesOf(planet.name, entry.houses),
            nakshatra:
                planet.nakshatra !== undefined && planet.pada !== undefined
                    ? { id: planet.nakshatra, pada: planet.pada }
                    : undefined,
            conjunctions:
                options.conjunctions?.[planet.name] ?? planet.conjunctions.map((n) => wholeSignAspect(n, 0)),
            aspects: receivedAspects(planet.name),
            tags: wargaPlanetTags(entry, planet.name, options.t),
        })),
        available,
        showAspectDelta: options.degreeBased,
    };
}
