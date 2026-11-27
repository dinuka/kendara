/**
 * Yoga / Dosha — read-time resolution + shared shape validator.
 * Canonical pattern: stored value wins (when `yogaDoshaVersion === YOGA_DOSHA_VERSION` and valid);
 * legacy documents lacking the field are recomputed purely from stored chart data at render time
 * (architecture supersedes BA "no migration at read" — a pure recompute is not a migration).
 * When nothing derivable is present → undefined (caller shows the empty state).
 */
import logger from "@/lib/logger";
import { YOGA_DOSHA_VERSION, buildChartFacts, computeYogaDoshas } from "@/lib/yogaDosha/ruleEngine";
import { PlanetLike } from "@/lib/yogaDosha/ruleEngine";
import { ChartSource, YogaDoshaEvaluation, YogaDoshaResult } from "@/lib/yogaDosha/types";

export interface ShapeProblem {
    path: string;
    message: string;
}

/** Basic structural guard used by the resolver (distinct from the QA validator below). */
export function isWellFormedEntry(entry: unknown): entry is YogaDoshaEvaluation {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
        typeof e.id === "string" &&
        e.id.length > 0 &&
        typeof e.isPresent === "boolean" &&
        typeof e.tradition === "string" &&
        typeof e.formation === "object" &&
        e.formation !== null &&
        typeof e.cancellation === "object" &&
        e.cancellation !== null &&
        typeof e.finalAssessment === "object" &&
        e.finalAssessment !== null
    );
}

/**
 * Shared shape validator (QA UT-YD-155): rulesTriggered non-empty for exists:true, strength in
 * 1..4, cancellation.status in 1..3, and no exists:false entries are ever persisted upstream.
 */
export function validateYogaDoshaShape(entry: unknown): ShapeProblem[] {
    const problems: ShapeProblem[] = [];
    if (typeof entry !== "object" || entry === null) {
        return [{ path: "", message: "entry is not an object" }];
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || e.id.length === 0) problems.push({ path: "id", message: "missing non-empty id" });
    if (e.isPresent === true) {
        const formation = e.formation as Record<string, unknown> | null | undefined;
        if (!formation || !Array.isArray(formation.rulesTriggered) || formation.rulesTriggered.length === 0) {
            problems.push({ path: "formation.rulesTriggered", message: "exists:true requires at least one rule" });
        }
        const strength = formation?.strength;
        if (typeof strength !== "number" || strength < 1 || strength > 4) {
            problems.push({ path: "formation.strength", message: `strength out of range 1..4: ${String(strength)}` });
        }
        const finalAssessment = e.finalAssessment as Record<string, unknown> | null | undefined;
        const severity = finalAssessment?.severity;
        if (typeof severity !== "number" || severity < 1 || severity > 4) {
            problems.push({
                path: "finalAssessment.severity",
                message: `severity out of range 1..4: ${String(severity)}`,
            });
        }
    }
    const cancellation = e.cancellation as Record<string, unknown> | null | undefined;
    const status = cancellation?.status;
    if (typeof status !== "number" || status < 1 || status > 3) {
        problems.push({ path: "cancellation.status", message: `status out of range 1..3: ${String(status)}` });
    }
    return problems;
}

function hasStoredChartData(doc: Record<string, unknown>): boolean {
    return (
        typeof doc.ascendant === "object" &&
        doc.ascendant !== null &&
        typeof (doc.ascendant as Record<string, unknown>).sign === "number" &&
        Array.isArray(doc.planets)
    );
}

function deriveResult(doc: Record<string, unknown>, source: ChartSource): YogaDoshaResult | undefined {
    if (!hasStoredChartData(doc)) return undefined;
    try {
        const ascendantSign = (doc.ascendant as Record<string, unknown>).sign as number;
        const planets = doc.planets as PlanetLike[];
        return computeYogaDoshas(buildChartFacts({ ascendantSign, source, planets }));
    } catch (error) {
        logger.warn({ err: error }, "[yogaDosha] failed to derive result from stored chart data");
        return undefined;
    }
}

function sourceOf(doc: Record<string, unknown>): ChartSource {
    return doc.manualHousePlacements !== undefined && doc.manualHousePlacements !== null ? "manual" : "auto";
}

/** Resolves yogas: stored v1 array wins; legacy docs recompute at render (never migrated). */
export function resolveYogas(calculatedDetails: unknown, source?: ChartSource): YogaDoshaResult["yogas"] | undefined {
    const doc = (calculatedDetails ?? {}) as Record<string, unknown> | null | undefined;
    if (!doc) return undefined;

    if (doc.yogaDoshaVersion === YOGA_DOSHA_VERSION && Array.isArray(doc.yogas)) {
        const entries = doc.yogas.filter(isWellFormedEntry);
        if (entries.length === doc.yogas.length) return entries as YogaDoshaResult["yogas"];
        logger.warn("[yogaDosha] stored yogas contain corrupt entries — deriving from chart data");
    }

    return deriveResult(doc, source ?? sourceOf(doc))?.yogas;
}

/** Resolves doshas: stored v1 array wins; legacy docs recompute at render. */
export function resolveDoshas(calculatedDetails: unknown, source?: ChartSource): YogaDoshaResult["doshas"] | undefined {
    const doc = (calculatedDetails ?? {}) as Record<string, unknown> | null | undefined;
    if (!doc) return undefined;

    const storedDoshas =
        doc.doshas && typeof doc.doshas === "object" ? (doc.doshas as Record<string, unknown>).doshas : undefined;
    if (doc.yogaDoshaVersion === YOGA_DOSHA_VERSION && Array.isArray(storedDoshas)) {
        const entries = storedDoshas.filter(isWellFormedEntry);
        if (entries.length === storedDoshas.length) return entries as YogaDoshaResult["doshas"];
        logger.warn("[yogaDosha] stored doshas contain corrupt entries — deriving from chart data");
    }

    return deriveResult(doc, source ?? sourceOf(doc))?.doshas;
}

/** Both families in one call (page render + search + notepad consumers). */
export function resolveYogaDoshas(calculatedDetails: unknown, source?: ChartSource): YogaDoshaResult | undefined {
    const yogas = resolveYogas(calculatedDetails, source);
    const doshas = resolveDoshas(calculatedDetails, source);
    if (!yogas || !doshas) return undefined;
    return { yogas, doshas };
}
