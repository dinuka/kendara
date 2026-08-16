import { NATURAL_ENEMIES } from "@/lib/astrology";
import type { House, Planet } from "@/lib/astrology";
import { computeMaranakaraka, computeThithiFromPlanets, findHouse } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { SIGN_LORD } from "@/lib/manualChart";

/** The six Shad Bala (ෂඩ් බලය) strengths. Keys are stored verbatim on CalculatedDetails and used
 *  as the API `bala` field, so they use the full names (never the short UI aliases). */
export type ShadBalayaKey = "sthanaBala" | "cheshtaBala" | "kalaBala" | "digBala" | "drishtiBala" | "naisargikaBala";

export const SHADBALAYA_KEYS: ShadBalayaKey[] = [
    "sthanaBala",
    "cheshtaBala",
    "kalaBala",
    "digBala",
    "drishtiBala",
    "naisargikaBala",
];

export interface ShadBalaReason {
    /** i18n key relative to `astrology.` — e.g. "shadbalaya.sthana.reason.uchcha". */
    key: string;
    /** Number params interpolated into the reason message (sign/house/strength/planet). */
    params?: Record<string, number>;
}

export interface ShadBalaValue {
    value: boolean;
    /** True when the student toggled this bala — sticky and preserved through recalculation. */
    overridden: boolean;
    reasons: ShadBalaReason[];
}

export type ShadBalayaPerPlanet = Record<ShadBalayaKey, ShadBalaValue>;

/** Record keyed by planet enum as string ("1".."9"). Never stores a ratio — derived at render. */
export type ShadBalaya = Record<string, ShadBalayaPerPlanet>;

export interface ShadBalayaContext {
    source: "auto" | "manual";
    /** Thithi (1-30). Falls back to computeThithiFromPlanets(planets). */
    thithi?: number;
    /** Day/night — Sun cusp house 7-12 for auto; manual charts may omit (then skipped). */
    day?: boolean;
    /** Maranakaraka planets (each planet in its designated death house; empty when none). Falls back to computeMaranakaraka. */
    maranakaraka?: number[];
    /** Graha-yuddha winner (deferred v1 — inert hook; the pipeline never sets it). */
    warWinnerPlanet?: number;
}

/** Planet subset the Shad Bala rules actually read, so fixtures and stored legacy docs (which may
 *  hold string strengths) typecheck without constructing full `Planet` objects. */
export type ShadBalaPlanet = Pick<Planet, "name" | "sign" | "house" | "absoluteDegree" | "strength" | "retrograde">;

const UTTARAYANA_SIGNS = new Set([10, 11, 12, 1, 2]);

const KALA_DAY_PLANETS: Record<number, boolean> = { 1: true, 5: true, 6: true };
const KALA_NIGHT_PLANETS: Record<number, boolean> = { 2: true, 3: true, 7: true };
const KALA_SHUKLA_PLANETS: Record<number, boolean> = { 4: true, 5: true, 6: true, 8: true };
const KALA_KRUSHNA_PLANETS: Record<number, boolean> = { 3: true, 7: true, 8: true };

/** Planets gaining Cheshta bala from a Shukla-paksha Moon conjunction: Kuja, Buda, Guru, Sikuru,
 *  Shani. Rahu/Ketu are excluded (the requirement lists exactly these five). */
const SHUKLA_CHANDRA_PLANETS: Record<number, boolean> = { 3: true, 4: true, 5: true, 6: true, 7: true };

/** Dig (directional) bala target house per planet: Jupiter/Mercury → 1st, Sun/Mars → 10th,
 *  Moon/Venus → 4th, Saturn → 7th. Rahu/Ketu never carry dig bala. */
const DIG_HOUSE: Record<number, number> = {
    5: 1,
    4: 1,
    1: 10,
    3: 10,
    2: 4,
    6: 4,
    7: 7,
};

/** Whether the sign's lord is a natural enemy of the planet (Sthana Bala removal rule). */
export function isEnemySign(planet: number, sign: number): boolean {
    return !!NATURAL_ENEMIES[planet]?.includes(SIGN_LORD[sign]);
}

/** Planets (by enum, ascending) sitting on their dig bala target house — Jupiter/Mercury in the 1st,
 *  Sun/Mars in the 10th, Moon/Venus in the 4th, Saturn in the 7th (see DIG_HOUSE). Rahu/Ketu never
 *  carry dig bala and are excluded. Used by the Warga Kendara per-chart tables. */
export function computeDigBalaPlanets(planets: Array<Pick<Planet, "name" | "house">>): number[] {
    return planets
        .filter((p) => p.house === DIG_HOUSE[p.name])
        .map((p) => p.name)
        .sort((a, b) => a - b);
}

/** Normalize stored strength to the numeric `PlanetaryStrength` enum. Legacy documents may hold
 *  string strengths ("Uchcha", "OwnSign", ...) — these map to the same numeric values. */
function normalizePlanetaryStrength(strength: number | string | undefined | null): PlanetaryStrength {
    if (typeof strength === "number") {
        const NUM_TO_STRENGTH: Record<number, PlanetaryStrength> = {
            1.25: PlanetaryStrength.ATHI_UCHCHA,
            1: PlanetaryStrength.UCHCHA,
            [-1]: PlanetaryStrength.NEECHA,
            [-1.25]: PlanetaryStrength.ATHI_NEECHA,
            0.75: PlanetaryStrength.MOOLATRIKONA,
            0.5: PlanetaryStrength.OWN_SIGN,
            0.1: PlanetaryStrength.MITRA,
            [-0.1]: PlanetaryStrength.SHATRU,
            0: PlanetaryStrength.SAMA,
        };
        return NUM_TO_STRENGTH[strength] ?? PlanetaryStrength.SAMA;
    }
    if (typeof strength === "string") {
        const STR_TO_ENUM: Record<string, PlanetaryStrength> = {
            athiuchcha: PlanetaryStrength.ATHI_UCHCHA,
            uchcha: PlanetaryStrength.UCHCHA,
            exalted: PlanetaryStrength.UCHCHA,
            neecha: PlanetaryStrength.NEECHA,
            debilitated: PlanetaryStrength.NEECHA,
            athineecha: PlanetaryStrength.ATHI_NEECHA,
            moolatrikona: PlanetaryStrength.MOOLATRIKONA,
            ownsign: PlanetaryStrength.OWN_SIGN,
            mitra: PlanetaryStrength.MITRA,
            friendly: PlanetaryStrength.MITRA,
            shatru: PlanetaryStrength.SHATRU,
            enemy: PlanetaryStrength.SHATRU,
            sama: PlanetaryStrength.SAMA,
            neutral: PlanetaryStrength.SAMA,
        };
        return STR_TO_ENUM[strength.toLowerCase().replace(/[\s_-]/g, "")] ?? PlanetaryStrength.SAMA;
    }
    return PlanetaryStrength.SAMA;
}

function computeSthanaBala(p: ShadBalaPlanet): ShadBalaValue {
    const strength = normalizePlanetaryStrength(p.strength);
    const isNeecha = strength === PlanetaryStrength.NEECHA || strength === PlanetaryStrength.ATHI_NEECHA;
    if (isNeecha && isEnemySign(p.name, p.sign)) {
        return {
            value: false,
            overridden: false,
            reasons: [
                {
                    key: "shadbalaya.sthana.reason.neecheShatru",
                    params: { strength, sign: p.sign },
                },
            ],
        };
    }
    if (isEnemySign(p.name, p.sign)) {
        return {
            value: false,
            overridden: false,
            reasons: [{ key: "shadbalaya.sthana.reason.shatru" }],
        };
    }
    let reasonKey: string;
    switch (strength) {
        case PlanetaryStrength.ATHI_UCHCHA:
            reasonKey = "shadbalaya.sthana.reason.athiUchcha";
            break;
        case PlanetaryStrength.UCHCHA:
            reasonKey = "shadbalaya.sthana.reason.uchcha";
            break;
        case PlanetaryStrength.MOOLATRIKONA:
            reasonKey = "shadbalaya.sthana.reason.moolatrikona";
            break;
        case PlanetaryStrength.OWN_SIGN:
            reasonKey = "shadbalaya.sthana.reason.ownSign";
            break;
        case PlanetaryStrength.MITRA:
            reasonKey = "shadbalaya.sthana.reason.mitra";
            break;
        default:
            reasonKey = "shadbalaya.sthana.reason.sama";
            break;
    }
    const reason: ShadBalaReason = isNeecha
        ? { key: "shadbalaya.sthana.reason.debilitated", params: { sign: p.sign } }
        : { key: reasonKey };
    return { value: true, overridden: false, reasons: [reason] };
}

function computeCheshtaBala(
    p: ShadBalaPlanet,
    thithi: number,
    moonSign: number | null,
    ctx: ShadBalayaContext,
): ShadBalaValue {
    const valueReasons: ShadBalaReason[] = [];
    const shuklaPaksha = thithi >= 1 && thithi <= 15;

    if (p.name === 1 && UTTARAYANA_SIGNS.has(p.sign)) {
        valueReasons.push({
            key:
                ctx.source === "auto"
                    ? "shadbalaya.cheshta.reason.uttarayana"
                    : "shadbalaya.cheshta.reason.uttarayanaSign",
        });
    }
    if (p.name === 2 && shuklaPaksha) {
        valueReasons.push({ key: "shadbalaya.cheshta.reason.shuklaPaksha" });
    }
    if (SHUKLA_CHANDRA_PLANETS[p.name] && shuklaPaksha && moonSign !== null && p.sign === moonSign) {
        valueReasons.push({ key: "shadbalaya.cheshta.reason.shuklaChandra" });
    }
    // Rahu/Ketu are retrograde by nature; only the opposite (direct) motion is exceptional vakra.
    const isVakra = p.name === 8 || p.name === 9 ? !p.retrograde : p.retrograde;
    if (isVakra) {
        valueReasons.push({ key: "shadbalaya.cheshta.reason.vakra" });
    }
    if (ctx.warWinnerPlanet === p.name) {
        valueReasons.push({ key: "shadbalaya.cheshta.reason.warWinner" });
    }

    const reasons = [...valueReasons];
    if (valueReasons.length === 0 && p.name === 2 && thithi >= 16) {
        reasons.push({ key: "shadbalaya.cheshta.reason.krushnaPaksha" });
    }
    return { value: valueReasons.length > 0, overridden: false, reasons };
}

function computeKalaBala(p: ShadBalaPlanet, thithi: number, ctx: ShadBalayaContext): ShadBalaValue {
    const reasons: ShadBalaReason[] = [];
    const shuklaPaksha = thithi >= 1 && thithi <= 15;
    // Ravi gets no Kala bala while the Moon is in Shukla paksha — not even for a day birth — and is
    // absent from the Krushna list too (his only Kala source is a Krushna-paksha day birth).
    const dayQualifies = ctx.day === true && KALA_DAY_PLANETS[p.name] && !(shuklaPaksha && p.name === 1);
    if (dayQualifies) {
        reasons.push({ key: "shadbalaya.kala.reason.day" });
    }
    if (ctx.day === false && KALA_NIGHT_PLANETS[p.name]) {
        reasons.push({ key: "shadbalaya.kala.reason.night" });
    }
    if (shuklaPaksha && KALA_SHUKLA_PLANETS[p.name]) {
        reasons.push({ key: "shadbalaya.kala.reason.shuklaPaksha" });
    }
    if (thithi >= 16 && KALA_KRUSHNA_PLANETS[p.name]) {
        reasons.push({ key: "shadbalaya.kala.reason.krushnaPaksha" });
    }
    return { value: reasons.length > 0, overridden: false, reasons };
}

function computeDigBala(p: ShadBalaPlanet, houses: House[], ctx: ShadBalayaContext): ShadBalaValue {
    if (p.name === 8 || p.name === 9) {
        return { value: false, overridden: false, reasons: [] };
    }
    const house = ctx.source === "manual" ? p.house : (findHouse(p.absoluteDegree, houses) ?? p.house);
    const target = DIG_HOUSE[p.name];
    if (target !== undefined && house === target) {
        return { value: true, overridden: false, reasons: [{ key: "shadbalaya.dig.reason.house", params: { house } }] };
    }
    return { value: false, overridden: false, reasons: [] };
}

function computeNaisargikaBala(
    p: ShadBalaPlanet,
    houses: House[],
    maranakaraka: number[],
    ctx: ShadBalayaContext,
): ShadBalaValue {
    if (maranakaraka.includes(p.name)) {
        const house = ctx.source === "manual" ? p.house : (findHouse(p.absoluteDegree, houses) ?? p.house);
        return {
            value: false,
            overridden: false,
            reasons: [{ key: "shadbalaya.naisargika.reason.maranakaraka", params: { house } }],
        };
    }
    return { value: true, overridden: false, reasons: [{ key: "shadbalaya.naisargika.reason.notMaranakaraka" }] };
}

function computeDrishtiBala(): ShadBalaValue {
    return { value: false, overridden: false, reasons: [{ key: "shadbalaya.drishti.reason.manual" }] };
}

/** Day/night derivation for auto charts: Sun above the horizon when its cusp-based house is 7-12
 *  (house 7 inclusive). Falls back to the entered `p.house` when findHouse has no range. */
export function deriveDay(planets: ShadBalaPlanet[], houses: House[]): boolean {
    const sun = planets.find((p) => p.name === 1);
    if (!sun) return true;
    const house = findHouse(sun.absoluteDegree, houses) ?? sun.house;
    return house >= 7;
}

const missingPlanet = (name: number): ShadBalaPlanet => ({
    name,
    sign: 1,
    house: 1,
    absoluteDegree: 0,
    strength: PlanetaryStrength.SAMA,
    retrograde: false,
});

/** Compute the full Shad Bala table for all nine planets (pure, deterministic, no I/O — the page
 *  and the recalculation pipeline both call this so legacy docs recompute at render). */
export function computeShadBalaya(planets: ShadBalaPlanet[], houses: House[], ctx: ShadBalayaContext): ShadBalaya {
    const thithi = ctx.thithi ?? computeThithiFromPlanets(planets);
    const maranakaraka = ctx.maranakaraka ?? computeMaranakaraka(planets, houses);
    const moonSign = planets.find((p) => p.name === 2)?.sign ?? null;

    const result: ShadBalaya = {};
    for (let name = 1; name <= 9; name++) {
        const p = planets.find((q) => q.name === name) ?? missingPlanet(name);
        result[String(name)] = {
            sthanaBala: computeSthanaBala(p),
            cheshtaBala: computeCheshtaBala(p, thithi, moonSign, ctx),
            kalaBala: computeKalaBala(p, thithi, ctx),
            digBala: computeDigBala(p, houses, ctx),
            drishtiBala: computeDrishtiBala(),
            naisargikaBala: computeNaisargikaBala(p, houses, maranakaraka, ctx),
        };
    }
    return result;
}

const defaultPerPlanet = (): ShadBalayaPerPlanet => ({
    sthanaBala: { value: true, overridden: false, reasons: [{ key: "shadbalaya.sthana.reason.sama" }] },
    cheshtaBala: { value: false, overridden: false, reasons: [] },
    kalaBala: { value: false, overridden: false, reasons: [] },
    digBala: { value: false, overridden: false, reasons: [] },
    drishtiBala: { value: false, overridden: false, reasons: [{ key: "shadbalaya.drishti.reason.manual" }] },
    naisargikaBala: {
        value: true,
        overridden: false,
        reasons: [{ key: "shadbalaya.naisargika.reason.notMaranakaraka" }],
    },
});

/** Merge freshly-computed Shad Bala with stored overrides: any bala the student toggled
 *  (`overridden: true`) keeps its stored value + reasons, everything else takes the computed value.
 *  Sparse stored records (a single legacy first-toggle) leave the other 53 cells computed. */
export function mergeShadBalaya(computed: ShadBalaya, stored?: ShadBalaya | null): ShadBalaya {
    const merged: ShadBalaya = {};
    for (let name = 1; name <= 9; name++) {
        const key = String(name);
        const computedPlanet = computed[key] ?? defaultPerPlanet();
        const storedPlanet = stored?.[key];
        const perPlanet = { ...computedPlanet };
        for (const bala of SHADBALAYA_KEYS) {
            const storedBala = storedPlanet?.[bala];
            if (storedBala?.overridden) {
                perPlanet[bala] = storedBala;
            }
        }
        merged[key] = perPlanet;
    }
    return merged;
}
