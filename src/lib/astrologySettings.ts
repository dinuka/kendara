import { AstrologySettings, IAstrologySettings } from "@/models/AstrologySettings";

import type { PlanetAspectsMap } from "@/lib/planetAspects";
import { validatePlanetAspectsPayload } from "@/lib/planetAspects";
import { DEFAULT_RASHI_ASPECTS, RashiAspectsSetting, validateRashiAspectsPayload } from "@/lib/rashiAspects";

/** Default per-planet orbs (Rāśmi). Same values as the former `User.DEFAULT_ORBS` — the legacy
 *  per-user orbs field was removed; these are now purely system-wide defaults. */
export const DEFAULT_PLANETARY_ORBS: Record<string, number> = {
    "1": 15,
    "2": 12,
    "3": 8,
    "4": 7,
    "5": 9,
    "6": 7,
    "7": 9,
    "8": 0,
    "9": 0,
};

/** No per-planet aspect overrides by default — every planet falls back to its per-planet default
 *  aspect houses/degrees (read-time fallback only; never persisted as `{}`). */
export const DEFAULT_PLANET_ASPECTS: PlanetAspectsMap = {};

export { DEFAULT_RASHI_ASPECTS };

export interface CalculationSettings {
    planetaryOrbs: Record<string, number>;
    planetAspects: PlanetAspectsMap;
    rashiAspects: RashiAspectsSetting;
}

/** Real-values-only seed (D2 storage policy): no `null`s, no empty `{}`/`[]` placeholder fields.
 *  `planetAspects`, `recalcStatus`, `auditLog`, `recalcHistory`, `updatedBy`, `lastRecalculatedAt`
 *  are intentionally absent — they are written only when actually set. */
const SEED_DOC = {
    planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS },
    rashiAspects: { enabled: true },
    version: 1,
};

/** Load the single system-wide settings document, seeding it lazily on first miss (US-SAS-007).
 *  The fixed `_id: "system"` + `$setOnInsert` makes concurrent seed attempts produce exactly one
 *  document. No in-memory cache in v1 — every call reads the current document fresh. */
export async function getAstrologySettings(forceFresh = false): Promise<IAstrologySettings> {
    void forceFresh;
    const existing = await AstrologySettings.findById("system");
    if (existing) return existing;
    const doc = await AstrologySettings.findByIdAndUpdate(
        "system",
        { $setOnInsert: SEED_DOC },
        { upsert: true, new: true },
    );
    return doc!;
}

/** Read-time fallbacks per field (D2 storage policy): consumers always receive the full shapes
 *  (`planetAspects: {}`, `rashiAspects: { enabled, overrides }`) even though those empty forms are
 *  never persisted. */
export async function getCalculationSettings(): Promise<CalculationSettings> {
    const doc = await getAstrologySettings();
    return {
        planetaryOrbs: doc.planetaryOrbs ?? DEFAULT_PLANETARY_ORBS,
        planetAspects: doc.planetAspects ?? DEFAULT_PLANET_ASPECTS,
        rashiAspects: doc.rashiAspects
            ? { enabled: doc.rashiAspects.enabled, overrides: doc.rashiAspects.overrides ?? {} }
            : DEFAULT_RASHI_ASPECTS,
    };
}

/** Storage normalization (D2): the persisted document omits empty forms — `planetAspects: {}` is
 *  `$unset`, `rashiAspects.overrides` is dropped when empty — and every number is a plain finite
 *  number (Mongoose `Mixed` returns cast wrappers). This is the canonical shape used both for the
 *  no-op comparison and the atomic write. */
function normalizeForStorage(field: "planetaryOrbs" | "planetAspects" | "rashiAspects", value: unknown): unknown {
    if (field === "planetaryOrbs") {
        if (value === undefined || value === null) return undefined;
        const orbs: Record<string, number> = {};
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            orbs[key] = Number(v);
        }
        return orbs;
    }
    if (field === "planetAspects") {
        if (value === undefined || value === null) return undefined;
        const map = value as PlanetAspectsMap;
        return Object.keys(map).length === 0 ? undefined : map;
    }
    if (value === undefined || value === null) return undefined;
    const rashi = value as RashiAspectsSetting;
    const stored: Record<string, unknown> = { enabled: rashi.enabled };
    if (rashi.overrides && Object.keys(rashi.overrides).length > 0) {
        stored.overrides = rashi.overrides;
    }
    return stored;
}

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export type SettingsUpdateResult =
    | { outcome: "no-op" }
    | { outcome: "updated"; doc: IAstrologySettings; newVersion: number }
    | { outcome: "conflict"; reason: "stale" | "running" };

export interface SettingsUpdateInput {
    version: number;
    planetaryOrbs?: Record<string, number>;
    planetAspects?: PlanetAspectsMap;
    rashiAspects?: RashiAspectsSetting;
    changedBy: { id: string; name?: string };
}

/** Apply a super-admin settings update (D7): subset semantics, all-or-nothing validation, no-op
 *  detection, `version` optimistic lock, single in-flight run guard, and one atomic write that
 *  bumps `version`, records `updatedBy`/`updatedAt`, stamps `recalcStatus` "running", and appends
 *  the audit entry (capped at 100). Does NOT start the job — the calling route fires
 *  `startRecalculation`. Nothing is persisted when any check fails. */
export async function applySettingsUpdate(input: SettingsUpdateInput): Promise<SettingsUpdateResult> {
    const { version, changedBy } = input;
    const doc = await getAstrologySettings();
    const currentVersion = doc.version ?? 1;

    if (version !== currentVersion) {
        return { outcome: "conflict", reason: "stale" };
    }
    if (doc.recalcStatus?.status === "running") {
        return { outcome: "conflict", reason: "running" };
    }

    const hasProvidedField =
        input.planetaryOrbs !== undefined || input.planetAspects !== undefined || input.rashiAspects !== undefined;
    if (!hasProvidedField) {
        throw new Error("no valid setting provided (planetaryOrbs, planetAspects, rashiAspects)");
    }

    const set: Record<string, unknown> = {};
    const unset: string[] = [];
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (input.planetaryOrbs !== undefined) {
        const orbs = input.planetaryOrbs;
        if (orbs === null || typeof orbs !== "object" || Array.isArray(orbs)) {
            throw new Error("Invalid planetaryOrbs: must be an object keyed by planet (1-9)");
        }
        const validKeys = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
        const normalized: Record<string, number> = {};
        for (const key of Object.keys(orbs)) {
            if (!validKeys.has(key)) {
                throw new Error(`Invalid planetaryOrbs: invalid planet key: ${key}`);
            }
            const val = orbs[key];
            if (typeof val !== "number" || !Number.isFinite(val) || val < 0 || val > 30) {
                throw new Error(`Invalid planetaryOrbs: value for planet ${key} must be 0-30`);
            }
            normalized[key] = val;
        }
        const incoming = normalizeForStorage("planetaryOrbs", normalized);
        const current = normalizeForStorage("planetaryOrbs", doc.planetaryOrbs ?? DEFAULT_PLANETARY_ORBS);
        if (!deepEqual(incoming, current)) {
            set.planetaryOrbs = incoming;
            changes.planetaryOrbs = { from: current, to: incoming };
        }
    }

    if (input.planetAspects !== undefined) {
        const result = validatePlanetAspectsPayload(input.planetAspects);
        if (!result.ok) {
            throw new Error(`Invalid planetAspects: ${result.error}`);
        }
        const incoming = normalizeForStorage("planetAspects", result.value);
        const current = normalizeForStorage("planetAspects", doc.planetAspects);
        if (!deepEqual(incoming, current)) {
            if (incoming === undefined) unset.push("planetAspects");
            else set.planetAspects = incoming;
            changes.planetAspects = { from: current, to: incoming };
        }
    }

    if (input.rashiAspects !== undefined) {
        const result = validateRashiAspectsPayload(input.rashiAspects);
        if (!result.ok) {
            throw new Error(`Invalid rashiAspects: ${result.error}`);
        }
        const incoming = normalizeForStorage("rashiAspects", result.value);
        const current = normalizeForStorage("rashiAspects", doc.rashiAspects ?? { enabled: true });
        if (!deepEqual(incoming, current)) {
            set.rashiAspects = incoming;
            changes.rashiAspects = { from: current, to: incoming };
        }
    }

    if (Object.keys(set).length === 0 && unset.length === 0) {
        return { outcome: "no-op" };
    }

    const newVersion = currentVersion + 1;
    const update: Record<string, unknown> = { $inc: { version: 1 } };
    const setters: Record<string, unknown> = {
        updatedBy: { id: changedBy.id },
        updatedAt: new Date(),
        "recalcStatus.status": "running",
        "recalcStatus.settingsVersion": newVersion,
        "recalcStatus.startedAt": new Date(),
        "recalcStatus.processed": 0,
        "recalcStatus.succeeded": 0,
        "recalcStatus.failed": 0,
        "recalcStatus.total": 0,
    };
    for (const [field, value] of Object.entries(set)) {
        setters[field] = value;
    }
    update.$set = setters;
    // A settings update starts a brand-new run for the new version — clear any stale resume
    // cursor / failure state left behind by a previous run so the job never resumes mid-list.
    update.$unset = {
        ...Object.fromEntries(unset.map((field) => [field, ""])),
        "recalcStatus.lastProcessedHoroscopeId": "",
        "recalcStatus.failedHoroscopeIds": "",
        "recalcStatus.error": "",
    };
    update.$push = {
        auditLog: {
            $each: [
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    version: newVersion,
                    changedBy: { id: changedBy.id, ...(changedBy.name ? { name: changedBy.name } : {}) },
                    changedAt: new Date(),
                    changes,
                },
            ],
            $slice: -100,
        },
    };

    const updated = await AstrologySettings.findByIdAndUpdate("system", update, { new: true });
    if (!updated) {
        throw new Error("failed to update astrology settings document");
    }
    return { outcome: "updated", doc: updated, newVersion };
}
