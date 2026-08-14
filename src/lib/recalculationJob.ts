import { AstrologySettings } from "@/models/AstrologySettings";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { getAstrologySettings, getCalculationSettings } from "@/lib/astrologySettings";
import { calculateHoroscope } from "@/lib/calculation";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { compute, manualPlacementsToInput } from "@/lib/manualChart";
import {
    getCurrentShani,
    sanitizeManualHousePlacements,
    synthesizeCalculation,
    synthesizeNavamsaCalculation,
} from "@/lib/manualChartDetails";
import type { PlanetAspectsMap } from "@/lib/planetAspects";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";
import { mergeShadBalaya } from "@/lib/shadBalaya";

export const RECALC_BATCH_SIZE = Number(process.env.RECALC_BATCH_SIZE ?? 100);

/** Module-level single-flight guard (D5): at most one in-process run at a time. */
let activeRun: { settingsVersion: number } | null = null;

export function isRecalculationRunning(): boolean {
    return activeRun !== null;
}

/** Bulk recalculation of every stored `CalculatedDetails` snapshot against the current system-wide
 *  settings (US-SAS-003/004/009/010). In-process, batched, idempotent per `version`, resumable from
 *  `lastProcessedHoroscopeId`, and partial-failure-safe: a failing horoscope leaves its snapshot
 *  untouched, is counted, and never aborts the run. Charts are NOT regenerated (D8). */
export async function startRecalculation(opts?: { settingsVersion?: number; horoscopeIds?: string[] }): Promise<void> {
    await connectDB();
    const doc = await getAstrologySettings(true);
    const version = opts?.settingsVersion ?? doc.version;
    const isTargeted = Array.isArray(opts?.horoscopeIds);
    const targetedIds = isTargeted ? (opts?.horoscopeIds ?? []) : undefined;

    if (!isTargeted) {
        if (activeRun) {
            logger.info("recalc: an in-process run is already active for settings v%d", activeRun.settingsVersion);
            return;
        }
        const persisted = doc.recalcStatus;
        if (persisted?.status === "completed" && persisted.settingsVersion === version) {
            logger.info("recalc: settings v%d already recalculated; no-op", version);
            return;
        }
    }

    if (targetedIds) {
        logger.info("recalc: targeted run over %d horoscopes for settings v%d", targetedIds.length, version);
    } else {
        logger.info("recalc: starting run for settings v%d", version);
    }

    let ids: string[];
    let resumeFrom: string | null = null;
    if (targetedIds) {
        ids = [...new Set(targetedIds)];
    } else if (
        doc.recalcStatus?.status === "running" &&
        doc.recalcStatus.settingsVersion === version &&
        doc.recalcStatus.lastProcessedHoroscopeId
    ) {
        resumeFrom = doc.recalcStatus.lastProcessedHoroscopeId;
        logger.info("recalc: resuming settings v%d from %s", version, resumeFrom);
        const all = await snapshotHoroscopeIds();
        ids = all;
    } else {
        ids = await snapshotHoroscopeIds();
    }

    const { planetaryOrbs, planetAspects, rashiAspects } = await getCalculationSettings();
    const total = ids.length;
    const startedAt = new Date();
    const startedStatus =
        doc.recalcStatus?.status === "running" &&
        doc.recalcStatus.settingsVersion === version &&
        doc.recalcStatus.lastProcessedHoroscopeId
            ? doc.recalcStatus
            : undefined;

    const initial = {
        status: "running" as const,
        settingsVersion: version,
        startedAt: startedStatus?.startedAt ?? startedAt,
        total,
        processed: startedStatus?.processed ?? 0,
        succeeded: startedStatus?.succeeded ?? 0,
        failed: startedStatus?.failed ?? 0,
    };
    await AstrologySettings.findByIdAndUpdate("system", { $set: { recalcStatus: initial } });

    activeRun = { settingsVersion: version };

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const failedIds: string[] = [];
    let lastProcessedHoroscopeId: string | undefined;

    const startIndex = resumeFrom ? Math.max(0, ids.indexOf(resumeFrom) + 1) : 0;

    try {
        for (let i = startIndex; i < ids.length; i += RECALC_BATCH_SIZE) {
            const current = await getAstrologySettings(true);
            if (current.version !== version) {
                logger.warn(
                    "recalc: stale run for settings v%d stopped (current version is %d); leaving recalcStatus to the newer update",
                    version,
                    current.version,
                );
                return;
            }

            const batch = ids.slice(i, i + RECALC_BATCH_SIZE);
            for (const id of batch) {
                try {
                    await recalculateOne(id, planetaryOrbs, planetAspects, rashiAspects);
                    succeeded++;
                } catch (err) {
                    failed++;
                    const message = (err as Error).message;
                    failedIds.push(id);
                    logger.error("recalc: failed horoscope id=%s: %s", id, message);
                }
                processed++;
                lastProcessedHoroscopeId = id;
            }

            await AstrologySettings.findByIdAndUpdate("system", {
                $set: {
                    "recalcStatus.processed": processed,
                    "recalcStatus.succeeded": succeeded,
                    "recalcStatus.failed": failed,
                    "recalcStatus.lastProcessedHoroscopeId": lastProcessedHoroscopeId,
                },
            });
        }

        await finalizeRun(version, total, processed, succeeded, failed, failedIds, startedAt);
    } catch (err) {
        const message = (err as Error).message;
        logger.error("recalc: run failed for settings v%d: %s", version, message);
        const set: Record<string, unknown> = {
            "recalcStatus.status": "failed",
            "recalcStatus.error": message,
            "recalcStatus.settingsVersion": version,
            "recalcStatus.processed": processed,
            "recalcStatus.succeeded": succeeded,
            "recalcStatus.failed": failed,
            "recalcStatus.lastProcessedHoroscopeId": lastProcessedHoroscopeId,
        };
        await AstrologySettings.findByIdAndUpdate("system", { $set: set });
    } finally {
        activeRun = null;
    }
}

async function snapshotHoroscopeIds(): Promise<string[]> {
    const details = await CalculatedDetails.find({}, { "horoscope.id": 1, _id: 0 }).lean();
    const ids = [...new Set(details.map((d) => d.horoscope?.id).filter((id): id is string => !!id))];
    logger.info("recalc: snapshot of %d horoscopes with CalculatedDetails", ids.length);
    return ids;
}

async function recalculateOne(
    id: string,
    planetaryOrbs: Record<string, number>,
    planetAspects: PlanetAspectsMap,
    rashiAspects: RashiAspectsSetting,
): Promise<void> {
    const horoscope = await Horoscope.findById(id);
    if (!horoscope) {
        throw new Error("horoscope not found");
    }

    if (horoscope.source === "manual") {
        const existing = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
        if (!existing?.manualHousePlacements) {
            throw new Error("manual horoscope has no stored manualHousePlacements to recompute from");
        }
        const input = manualPlacementsToInput(existing.manualHousePlacements);
        input.aspectOptions = { planetaryOrbs, planetAspects, rashiAspects };
        const currentShani = getCurrentShani(input.lagna);
        const result = compute(input, currentShani);
        const synth = synthesizeCalculation(result, horoscope.birthDate);
        await CalculatedDetails.findOneAndUpdate(
            { "horoscope.id": id },
            {
                ...synth,
                // Student toggles (overridden: true) survive recalculation; everything else takes
                // the freshly-computed value (US-SB-013).
                shadbalaya: mergeShadBalaya(synth.shadbalaya ?? {}, existing?.shadbalaya),
                manualHousePlacements: sanitizeManualHousePlacements(result.manualHousePlacements),
                derivedRanges: result.derivedRanges,
            },
            { upsert: true },
        );
        return;
    }

    const calculated = calculateHoroscope(horoscope, planetaryOrbs, planetAspects, rashiAspects);
    const existing = await CalculatedDetails.findOne({ "horoscope.id": id }).lean();
    await CalculatedDetails.findOneAndUpdate(
        { "horoscope.id": id },
        {
            ...calculated,
            shadbalaya: mergeShadBalaya(calculated.shadbalaya ?? {}, existing?.shadbalaya),
        },
        { upsert: true },
    );
}

async function finalizeRun(
    version: number,
    total: number,
    processed: number,
    succeeded: number,
    failed: number,
    failedIds: string[],
    startedAt: Date,
): Promise<void> {
    const finishedAt = new Date();
    const set: Record<string, unknown> = {
        lastRecalculatedAt: finishedAt,
        "recalcStatus.status": "completed",
        "recalcStatus.settingsVersion": version,
        "recalcStatus.startedAt": startedAt,
        "recalcStatus.finishedAt": finishedAt,
        "recalcStatus.total": total,
        "recalcStatus.processed": processed,
        "recalcStatus.succeeded": succeeded,
        "recalcStatus.failed": failed,
    };
    if (failed > 0) {
        set["recalcStatus.failedHoroscopeIds"] = failedIds.slice(0, 100);
    }
    // A completed run must clear the resume cursor and any failure state (Mongoose drops
    // `undefined` values from $set, so $unset is the only reliable way to remove them).
    const unset: Record<string, string> = {
        "recalcStatus.lastProcessedHoroscopeId": "",
        "recalcStatus.error": "",
    };
    if (failed === 0) {
        unset["recalcStatus.failedHoroscopeIds"] = "";
    }
    const update: Record<string, unknown> = { $set: set, $unset: unset };
    update.$push = {
        recalcHistory: {
            $each: [
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    settingsVersion: version,
                    triggeredBy: { id: "system" },
                    startedAt,
                    finishedAt,
                    total,
                    succeeded,
                    failed,
                    ...(failed > 0 ? { failedHoroscopeIds: failedIds.slice(0, 100) } : {}),
                },
            ],
            $slice: -20,
        },
    };
    await AstrologySettings.findByIdAndUpdate("system", update);
    logger.info("recalc: completed settings v%d — %d/%d succeeded, %d failed", version, succeeded, total, failed);
}
