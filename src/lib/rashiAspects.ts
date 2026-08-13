import type { Aspect, AspectReason, House, Planet } from "@/lib/astrology";
import {
    aspectPointSignedDelta,
    computeHouseAspectsByHouse,
    computeHouseAspectsByPlanet,
    resolveOrb,
} from "@/lib/planetAspects";
import type { PlanetAspectsMap } from "@/lib/planetAspects";

export type RashiCategory = "chara" | "thira" | "ubaya";

export interface RashiAspectOverride {
    /** Per-sign master switch (undefined -> inherit master enabled). */
    enabled?: boolean;
    /** Per-target sign enables/disables keyed by sign string "1".."12". true=enabled, false=disabled. */
    targets?: Record<string, boolean>;
}

export interface RashiAspectsSetting {
    enabled: boolean;
    overrides?: Record<string, RashiAspectOverride>;
}

/** Fixed Rashi Category per ZodiacSign enum (1-12). Identical for every student. */
export const RASHI_CATEGORY: Record<number, RashiCategory> = {
    1: "chara",
    4: "chara",
    7: "chara",
    10: "chara",
    2: "thira",
    5: "thira",
    8: "thira",
    11: "thira",
    3: "ubaya",
    6: "ubaya",
    9: "ubaya",
    12: "ubaya",
};

export const DEFAULT_RASHI_ASPECTS: RashiAspectsSetting = { enabled: true, overrides: {} };

const CATEGORY_SIGNS: Record<RashiCategory, number[]> = {
    chara: [1, 4, 7, 10],
    thira: [2, 5, 8, 11],
    ubaya: [3, 6, 9, 12],
};

/** Target category per aspecting category: Chara → Thira, Thira → Chara, Ubaya → Ubaya. */
const TARGET_CATEGORY: Record<RashiCategory, RashiCategory> = {
    chara: "thira",
    thira: "chara",
    ubaya: "ubaya",
};

const zodiacalArc = (fromSign: number, toSign: number): number =>
    Math.min(Math.abs(fromSign - toSign), 12 - Math.abs(fromSign - toSign));

/** Authoritative nearest-rashi exclusion. Among the candidate target signs (never the aspecting sign
 *  itself), find those at the minimal zodiacal arc; a two-way tie is broken by excluding the higher
 *  sign number (the one closer to Pisces/12). Reproduces the full 12-row data-model lookup. */
function nearestExcluded(aspectingSign: number, candidates: number[]): number {
    let minArc = Infinity;
    const nearest: number[] = [];
    for (const sign of candidates) {
        const arc = zodiacalArc(aspectingSign, sign);
        if (arc < minArc) {
            minArc = arc;
            nearest.length = 0;
            nearest.push(sign);
        } else if (arc === minArc) {
            nearest.push(sign);
        }
    }
    return Math.max(...nearest);
}

/** The aspected Zodiac signs for an aspecting sign, per the fixed Chara/Thira/Ubaya rules with the
 *  nearest-rashi exclusion (Ubaya ties exclude the higher sign number). Never includes itself. */
export function computeRashiAspectSigns(aspectingSign: number): number[] {
    const category = RASHI_CATEGORY[aspectingSign];
    const targetCategory = TARGET_CATEGORY[category];
    const candidates = CATEGORY_SIGNS[targetCategory].filter((s) => s !== aspectingSign);
    // Ubaya category aspects every other ubaya sign (no nearest-rashi exclusion) — they all aspect
    // each other. For Chara/Thira apply the nearest-rashi exclusion rules.
    if (targetCategory === "ubaya") return candidates;
    return candidates.filter((s) => s !== nearestExcluded(aspectingSign, candidates));
}

/** Strict validation of the `rashiAspects` payload. `enabled` must be a boolean; `overrides` keys
 *  ZodiacSign enum strings "1".."12" with boolean `enabled`. All-or-nothing. */
export function validateRashiAspectsPayload(
    raw: unknown,
): { ok: true; value: RashiAspectsSetting } | { ok: false; error: string } {
    if (raw === null || raw === undefined) {
        return { ok: true, value: DEFAULT_RASHI_ASPECTS };
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: "rashiAspects must be an object" };
    }
    const b = raw as Record<string, unknown>;
    if (typeof b.enabled !== "boolean") {
        return { ok: false, error: "rashiAspects.enabled must be a boolean" };
    }
    const overrides: Record<string, RashiAspectOverride> = {};
    if (b.overrides !== undefined && b.overrides !== null) {
        if (typeof b.overrides !== "object" || Array.isArray(b.overrides)) {
            return { ok: false, error: "rashiAspects.overrides must be an object keyed by sign (1-12)" };
        }
        for (const [key, value] of Object.entries(b.overrides as Record<string, unknown>)) {
            const sign = Number(key);
            if (!Number.isInteger(sign) || sign < 1 || sign > 12) {
                return { ok: false, error: `invalid rashiAspects.overrides sign key: ${key}` };
            }
            if (value === null || typeof value !== "object" || Array.isArray(value)) {
                return { ok: false, error: `rashiAspects.overrides["${key}"] must be an object` };
            }
            const overrideObj = value as Record<string, unknown>;
            // enabled is optional (inherit master) but if present must be boolean
            if (overrideObj.enabled !== undefined && typeof overrideObj.enabled !== "boolean") {
                return { ok: false, error: `rashiAspects.overrides["${key}"].enabled must be a boolean` };
            }
            const targets: Record<string, boolean> = {};
            if (overrideObj.targets !== undefined && overrideObj.targets !== null) {
                if (typeof overrideObj.targets !== "object" || Array.isArray(overrideObj.targets)) {
                    return {
                        ok: false,
                        error: `rashiAspects.overrides["${key}"].targets must be an object keyed by sign (1-12)`,
                    };
                }
                for (const [tkey, tval] of Object.entries(overrideObj.targets as Record<string, unknown>)) {
                    const tsign = Number(tkey);
                    if (!Number.isInteger(tsign) || tsign < 1 || tsign > 12) {
                        return {
                            ok: false,
                            error: `invalid rashiAspects.overrides["${key}"].targets sign key: ${tkey}`,
                        };
                    }
                    if (typeof tval !== "boolean") {
                        return {
                            ok: false,
                            error: `rashiAspects.overrides["${key}"].targets["${tkey}"] must be a boolean`,
                        };
                    }
                    targets[tkey] = tval as boolean;
                }
            }
            const override: RashiAspectOverride = {};
            if (overrideObj.enabled !== undefined) override.enabled = overrideObj.enabled as boolean;
            if (Object.keys(targets).length) override.targets = targets;
            overrides[key] = override;
        }
    }
    return { ok: true, value: { enabled: b.enabled, overrides } };
}

/** Whether a sign produces rashi drishti under the setting (master switch ∧ per-sign override). */
export function isRashiEnabledForSign(sign: number, setting: RashiAspectsSetting): boolean {
    if (!setting.enabled) return false;
    return setting.overrides?.[String(sign)]?.enabled !== false;
}

/** Whether a specific target sign is enabled for an aspecting sign (considers master switch,
 *  per-sign enabled flag, and per-target override). */
export function isRashiTargetEnabled(aspectingSign: number, targetSign: number, setting: RashiAspectsSetting): boolean {
    if (!isRashiEnabledForSign(aspectingSign, setting)) return false;
    const override = setting.overrides?.[String(aspectingSign)];
    if (!override || !override.targets) return true;
    const val = override.targets[String(targetSign)];
    return val !== false; // undefined or true -> enabled
}

export interface RashiHouseCandidate {
    houseNumber: number;
    aspectedSign: number;
}

export interface RashiPlanetCandidate {
    planetName: number;
    aspectedSign: number;
}

/** House-aspect rashi candidates: the houses whose whole-sign `sign` is in the aspecting sign's
 *  rashi-aspect set. Each candidate carries the aspected sign that triggered it. Empty when rashi
 *  is disabled for the aspecting sign. */
export function computeRashiHouseCandidates(
    aspectingSign: number,
    houses: Array<Pick<House, "houseNumber" | "sign">>,
    setting: RashiAspectsSetting,
): RashiHouseCandidate[] {
    if (!isRashiEnabledForSign(aspectingSign, setting)) return [];
    const aspectedSigns = computeRashiAspectSigns(aspectingSign);
    const result: RashiHouseCandidate[] = [];
    for (const h of houses) {
        if (aspectedSigns.includes(h.sign)) result.push({ houseNumber: h.houseNumber, aspectedSign: h.sign });
    }
    return result;
}

/** Planet-aspect rashi candidates: the other planets whose `sign` is in the aspecting sign's
 *  rashi-aspect set (own sign never included). Empty when rashi is disabled for the aspecting sign. */
export function computeRashiPlanetCandidates(
    aspectingSign: number,
    planets: Array<Pick<Planet, "name" | "sign">>,
    setting: RashiAspectsSetting,
): RashiPlanetCandidate[] {
    if (!isRashiEnabledForSign(aspectingSign, setting)) return [];
    const aspectedSigns = computeRashiAspectSigns(aspectingSign);
    const result: RashiPlanetCandidate[] = [];
    for (const p of planets) {
        if (aspectedSigns.includes(p.sign)) result.push({ planetName: p.name, aspectedSign: p.sign });
    }
    return result;
}

/** Build the rashi aspect reason for a target (`planet` or house-middle degree) when the degree +
 *  orb ("rashmi") check passes, else null. `targetSign` is the aspected whole-sign (used both for the
 *  candidate-set membership and the zodiacal gap). Empty candidate set / disabled → null. */
export function rashiReasonForTarget(
    aspecting: { name: number; sign: number; absoluteDegree: number },
    targetSign: number,
    targetAbs: number,
    planetaryOrbs?: Record<string, number>,
    setting: RashiAspectsSetting = DEFAULT_RASHI_ASPECTS,
): AspectReason | null {
    if (!isRashiEnabledForSign(aspecting.sign, setting)) return null;
    const aspectedSigns = computeRashiAspectSigns(aspecting.sign);
    if (!aspectedSigns.includes(targetSign)) return null;
    // Respect per-target overrides (allow disabling specific aspected signs)
    if (!isRashiTargetEnabled(aspecting.sign, targetSign, setting)) return null;
    const gapSigns = zodiacalArc(aspecting.sign, targetSign);
    const angle = gapSigns * 30;
    const delta = aspectPointSignedDelta(aspecting.absoluteDegree, angle, targetAbs);
    const orb = resolveOrb(aspecting.name, planetaryOrbs);
    if (Math.abs(delta) > orb) return null;
    return { type: "rashi", angle, aspectedSign: targetSign, delta: +delta.toFixed(2) };
}

/** Planet → aspected houses, the union of the Planet-Aspects arms (explicit `houses` ∪ degree arm)
 *  and the rashi arm (houses whose whole-sign `sign` is rashi-aspectable and whose middle degree is
 *  within the aspecting planet's orb of the rashi aspect point). Equal to `computeHouseAspectsByPlanet`
 *  when rashi is disabled. Result lists deduplicated, sorted ascending. */
export function computeHouseAspectsByPlanetWithRashi(
    planets: Array<Pick<Planet, "name" | "absoluteDegree" | "sign" | "house">>,
    houses: Array<Pick<House, "houseNumber" | "sign" | "middleSign" | "middleDegree">>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
    setting: RashiAspectsSetting = DEFAULT_RASHI_ASPECTS,
): Record<number, number[]> {
    const base = computeHouseAspectsByPlanet(planets, houses, planetAspects, planetaryOrbs);
    if (!setting.enabled) return base;
    const houseByNumber = new Map<number, Pick<House, "houseNumber" | "sign" | "middleSign" | "middleDegree">>();
    for (const h of houses) houseByNumber.set(h.houseNumber, h);
    const result: Record<number, number[]> = {};
    for (const planet of planets) {
        const aspected = new Set<number>(base[planet.name] ?? []);
        const candidates = computeRashiHouseCandidates(planet.sign, houses, setting);
        for (const candidate of candidates) {
            const house = houseByNumber.get(candidate.houseNumber);
            if (!house) continue;
            const targetAbs = (house.middleSign - 1) * 30 + house.middleDegree;
            const reason = rashiReasonForTarget(planet, candidate.aspectedSign, targetAbs, planetaryOrbs, setting);
            if (reason) aspected.add(candidate.houseNumber);
        }
        result[planet.name] = [...aspected].sort((a, b) => a - b);
    }
    return result;
}

/** House → aspecting planets, the union of the Planet-Aspects arms and the rashi arm. Equal to
 *  `computeHouseAspectsByHouse` when rashi is disabled. Every house 1-12 present. */
export function computeHouseAspectsByHouseWithRashi(
    planets: Array<Pick<Planet, "name" | "absoluteDegree" | "sign" | "house">>,
    houses: Array<Pick<House, "houseNumber" | "sign" | "middleSign" | "middleDegree">>,
    planetAspects?: PlanetAspectsMap,
    planetaryOrbs?: Record<string, number>,
    setting: RashiAspectsSetting = DEFAULT_RASHI_ASPECTS,
): Record<number, number[]> {
    const base = computeHouseAspectsByHouse(planets, houses, planetAspects, planetaryOrbs);
    if (!setting.enabled) return base;
    const byPlanet = computeHouseAspectsByPlanetWithRashi(planets, houses, planetAspects, planetaryOrbs, setting);
    const result: Record<number, number[]> = {};
    for (let h = 1; h <= 12; h++) result[h] = [];
    for (const [planetKey, aspectedHouses] of Object.entries(byPlanet)) {
        const planet = Number(planetKey);
        for (const h of aspectedHouses) (result[h] ??= []).push(planet);
    }
    for (let h = 1; h <= 12; h++) result[h].sort((a, b) => a - b);
    return result;
}

/** Merge rashi drishti reasons into the planet-to-planet aspects. Each target retains a single
 *  aspect record carrying every distinct reason (planetary first, then rashi) — UT-RA-141/142/143.
 *  Targets aspected only via rashi gain a record whose reason fields reflect the rashi angle/arc.
 *  When rashi is disabled the input map is returned unchanged. */
export function mergeRashiIntoPlanetAspects(
    aspectsByPlanet: Record<number, Aspect[]>,
    planets: Array<Pick<Planet, "name" | "sign" | "absoluteDegree">>,
    planetaryOrbs?: Record<string, number>,
    setting: RashiAspectsSetting = DEFAULT_RASHI_ASPECTS,
): Record<number, Aspect[]> {
    if (!setting.enabled) return aspectsByPlanet;
    const targetAbs: Record<number, number> = {};
    const targetSign: Record<number, number> = {};
    for (const p of planets) {
        targetAbs[p.name] = p.absoluteDegree;
        targetSign[p.name] = p.sign;
    }
    const result: Record<number, Aspect[]> = {};
    for (const aspecter of planets) {
        const existingByName = new Map<number, Aspect>();
        for (const a of aspectsByPlanet[aspecter.name] ?? []) existingByName.set(a.planetName, a);
        const rashiByTarget: Record<number, AspectReason> = {};
        for (const target of planets) {
            if (target.name === aspecter.name) continue;
            const reason = rashiReasonForTarget(aspecter, target.sign, target.absoluteDegree, planetaryOrbs, setting);
            if (reason) rashiByTarget[target.name] = reason;
        }
        const merged: Aspect[] = [];
        for (const target of planets) {
            if (target.name === aspecter.name) continue;
            const base = existingByName.get(target.name);
            const rashiReason = rashiByTarget[target.name];
            if (base && !rashiReason) {
                merged.push(base);
            } else if (!base && rashiReason) {
                merged.push({
                    planetName: target.name,
                    aspectType: rashiReason.angle,
                    planetAbsoluteDegree: targetAbs[target.name],
                    degreeGap: Math.abs(rashiReason.delta),
                    exactAspectDegree: rashiReason.angle,
                    isBeneficial: false,
                    delta: rashiReason.delta,
                    reasons: [rashiReason],
                });
            } else if (base && rashiReason) {
                merged.push({
                    ...base,
                    reasons: [
                        ...(base.reasons ?? [{ type: "planetary", angle: base.aspectType, delta: base.delta ?? 0 }]),
                        rashiReason,
                    ],
                });
            }
        }
        result[aspecter.name] = merged;
    }
    return result;
}
