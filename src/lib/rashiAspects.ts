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
