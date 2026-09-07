/**
 * Yoga / Dosha — evaluation pipeline (architecture §pipeline steps 1–9).
 * 1) build facts → 2) per catalog entry (fail-closed, US-YD-005 Edge) → 3) rules → 4) formation →
 * 5) context → 6) interpretation → 7) mitigation → 8) cancellation → 9) final assessment.
 */
import { Planet } from "@/lib/astrology";
import { CancellationStatus, YogaStrength } from "@/lib/astrologyEnums";
import logger from "@/lib/logger";
import { mitigationForKey } from "@/lib/yogaDosha/cancellation";
import { CatalogEntry, activeDoshaEntries, activeYogaEntries } from "@/lib/yogaDosha/catalog";
import { interpretHouses } from "@/lib/yogaDosha/interpretation";
import { evaluateRule } from "@/lib/yogaDosha/rules";
import {
    CancellationInfo,
    ChartFacts,
    ChartSource,
    DashaActivation,
    DoshaEvaluation,
    FinalAssessment,
    FormationInfo,
    MitigationFactor,
    MitigationKey,
    RuleEvaluation,
    ThemeInfo,
    Tradition,
    YogaDoshaResult,
    YogaEvaluation,
} from "@/lib/yogaDosha/types";

/** Bumped only when the persisted calculatedDetails evaluation shape changes
 *  (IT-YD-200 asserts === current). v3: Agni Marutha dosha added + Shani Mangala narrowed to its
 *  3 positional rules — stored v2 docs no longer match the current engine, so they recompute.
 *  v5: Kuja Dosha (manglik) activated with per-reference rules (Lagna/Moon/Venus) — stored v4
 *  dosha lists lack the manglik entry, so they recompute.
 *  v6: manglik context.houseImpact/themes now record the reference-relative dosha house (was
 *  absolute house — produced out-of-set theme keys like house9, e.g. a chart with Mars absolutely
 *  in house 9 but 4th from the Moon) — stored v5 manglik evaluations are corrected on recompute.
 *  v7: Dharma Karmadhipati Yoga activated as the first yoga in the catalog (docs/
 *  dharma-karmadipathi-yogaya.md) — stored v6 yoga lists lack the entry, so they recompute.
 *  v8: DK-02 no longer treats a 0° conjunction record as a "mutual aspect" (yuti is not drishti,
 *  horoscope 6a68e63506d2d7cd52c6fa9d) — stored v7 yogas carry the bogus dk02 reason, recompute. */
export const YOGA_DOSHA_VERSION = 8;

export type PlanetLike = Pick<
    Planet,
    | "name"
    | "sign"
    | "house"
    | "degree"
    | "absoluteDegree"
    | "strength"
    | "navamsaSign"
    | "navamsaStrength"
    | "nakshatra"
    | "aspects"
>;

export interface ChartFactsInput {
    ascendantSign: number;
    source: ChartSource;
    planets: PlanetLike[];
    thithi?: number;
    day?: number;
    maranakaraka?: number[];
}

export function buildChartFacts(input: ChartFactsInput): ChartFacts {
    return {
        ascendantSign: input.ascendantSign,
        source: input.source,
        tradition: "MAIN_STREAM",
        thithi: input.thithi,
        day: input.day,
        maranakaraka: input.maranakaraka,
        planets: input.planets.map((p) => ({
            planetName: p.name,
            sign: p.sign,
            house: p.house,
            degree: p.degree,
            absoluteDegree: p.absoluteDegree,
            strength: p.strength,
            navamsaSign: p.navamsaSign,
            navamsaStrength: p.navamsaStrength,
            // Legacy/manual records may omit nakshatra — nakshatra-ownership rules fail closed.
            nakshatra: p.nakshatra ?? 0,
            // Legacy or manual records may store no aspects — the engine treats absence as no drishti.
            aspects: (p.aspects ?? []).map((a) => ({
                planetName: a.planetName,
                aspectType: a.aspectType,
                degreeGap: a.degreeGap,
            })),
        })),
    };
}

interface FormationResult {
    rulesTriggered: string[];
    primaryRule: string;
    strength: number;
    reasons: Array<{ rule: string; reasonKey: string; params?: Record<string, string | number> }>;
    houseImpact: number[];
    ruleResults: RuleEvaluation[];
}

function formFromRules(entry: CatalogEntry, facts: ChartFacts): FormationResult {
    const ruleResults: RuleEvaluation[] = [];
    entry.rules.forEach(({ rule, strength, reasonKey }) => {
        const result = evaluateRule(rule as never, facts);
        if (result.triggered) {
            ruleResults.push({
                ...result,
                strength: result.strength || strength,
                reasonKey: result.reasonKey || reasonKey,
            });
        }
    });

    if (ruleResults.length === 0) {
        return { rulesTriggered: [], primaryRule: "", strength: 4, reasons: [], houseImpact: [], ruleResults };
    }

    const rulesTriggered = ruleResults.map((r) => r.rule);
    const strength = Math.min(...ruleResults.map((r) => r.strength), 4);
    const houseImpact = [...new Set(ruleResults.flatMap((r) => r.houseImpact ?? []))].sort((a, b) => a - b);
    const reasons = ruleResults.map((r) => ({ rule: r.rule, reasonKey: r.reasonKey, params: r.params }));
    return {
        rulesTriggered,
        primaryRule: rulesTriggered[0],
        strength,
        reasons,
        houseImpact,
        ruleResults,
    };
}

interface EvaluationBase {
    id: string;
    kind: "yoga" | "dosha";
    isPresent: boolean;
    tradition: Tradition;
    formation: FormationInfo;
    context: { houseImpact: number[] };
    interpretation: { themes: ThemeInfo[] };
    mitigation: MitigationFactor[];
    cancellation: CancellationInfo;
    finalAssessment: FinalAssessment;
    dashaActivation?: DashaActivation;
}

function absentBase(id: string, kind: "yoga" | "dosha"): YogaEvaluation | DoshaEvaluation {
    return {
        id,
        kind,
        isPresent: false,
        tradition: "MAIN_STREAM",
        formation: { rulesTriggered: [], primaryRule: "", strength: YogaStrength.WEAK, reasons: [] },
        context: { houseImpact: [] },
        interpretation: { themes: [] },
        mitigation: [],
        cancellation: { status: CancellationStatus.NOT_CANCELLED, factors: [] },
        finalAssessment: { severity: YogaStrength.WEAK, expressionKeys: [] },
        dashaActivation: undefined,
    } as unknown as YogaEvaluation | DoshaEvaluation;
}

function evaluateEntry(entry: CatalogEntry, facts: ChartFacts): YogaEvaluation | DoshaEvaluation {
    try {
        const formation = formFromRules(entry, facts);

        if (!formation.ruleResults.length) {
            return absentBase(entry.id, entry.kind) as YogaEvaluation | DoshaEvaluation;
        }

        // Planets of the formation come from the catalog entry (shaniMangala: [7,3], manglik: [3]).
        const planetsInFormation = entry.planets;
        // Mitigations live on CatalogEntryBase — both yoga and dosha entries can carry them.
        const mitigationKeys: MitigationKey[] = entry.mitigations ?? [];
        const mitigation = mitigationKeys
            .map((key) => mitigationForKey(key, facts, planetsInFormation))
            .filter((factor): factor is NonNullable<typeof factor> => factor !== null);

        // No cancellation rules are registered (CANCELLATION_REGISTRY empty), so CancellationStatus 2
        // is unreachable in this release by design (US-YD-006).
        const cancellationStatus: CancellationStatus = CancellationStatus.NOT_CANCELLED;

        // Severity synthesis (step 9): formation strength; each applied mitigation factor softens +1
        // (clamped ≤ 4, and never past the strongest factor target).
        const severityTarget = Math.max(...mitigation.map((m) => m.target), formation.strength);
        const severity = Math.min(
            (formation.strength + mitigation.length) as YogaStrength,
            severityTarget,
            YogaStrength.WEAK,
        );

        // BA note: when mitigation actually reduces severity, final status may read "Mitigated" (3);
        // it is never rendered as "Cancelled". (Data-model example shows status 1 with a reduction —
        // discrepancy reported to BA/QA.)
        const status: CancellationStatus =
            mitigation.length > 0 && severity > formation.strength ? CancellationStatus.MITIGATED : cancellationStatus;

        const interpretation = interpretHouses(formation.ruleResults, entry.expressionKeys);
        const dashaActivation = entry.dashaActivation;

        return {
            id: entry.id,
            kind: entry.kind,
            isPresent: true,
            tradition: "MAIN_STREAM",
            formation: {
                rulesTriggered: formation.rulesTriggered,
                primaryRule: formation.primaryRule,
                strength: formation.strength,
                reasons: formation.reasons,
            },
            context: { houseImpact: formation.houseImpact },
            interpretation,
            mitigation: mitigation.map((m) => ({
                factorKey: m.factorKey,
                type: m.type,
                effect: m.effect,
                target: m.target,
                confidence: m.confidence,
            })),
            cancellation: { status, factors: [] },
            finalAssessment: { severity, expressionKeys: interpretation.expressionKeys },
            dashaActivation,
        } as YogaEvaluation | DoshaEvaluation;
    } catch (error) {
        logger.warn({ err: error }, "[yogaDosha] evaluation failed for %s", entry.id);
        return absentBase(entry.id, entry.kind) as YogaEvaluation | DoshaEvaluation;
    }
}

/** Full pipeline entry point (architecture §index exports). */
export function computeYogaDoshas(facts: ChartFacts): YogaDoshaResult {
    const yogas = activeYogaEntries().map((entry) => evaluateEntry(entry, facts)) as YogaEvaluation[];
    const doshas = activeDoshaEntries().map((entry) => evaluateEntry(entry, facts)) as DoshaEvaluation[];
    return { yogas, doshas };
}
