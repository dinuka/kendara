/**
 * Yoga / Dosha — shared domain types.
 * QA plan: specs/qa/20260906-0837-yoga-dosha-tags-test-plan.md (UT-YD-001..155).
 * Architecture: specs/architecture/20260906-0905-yoga-dosha-tags-architecture.md (module files).
 *
 * All astrological values stay numeric enums (astrologyEnums) and every display string is an
 * i18n key (messages/*.json) — never a hardcoded sentence. Field meanings mirror §Yogas/§Doshas
 * in specs/business-analysis/data-model.md.
 */
import { CancellationStatus, PlanetaryStrength, YogaStrength } from "@/lib/astrologyEnums";

/** Mainstream (Parasara) tradition is the only evaluated tradition in this release. */
export type Tradition = "MAIN_STREAM";

export type CatalogKind = "yoga" | "dosha";

/** Yoga catalog ids (registered in catalog.ts). */
export type YogaId = "dharmaKarmadhipati";

/** Dosha catalog ids (registered in catalog.ts). */
export type DoshaId = "shaniMangala" | "agniMarutha" | "manglik";

/** Registered rule ids per catalog entry (rules.ts).
 *  Shani Mangala (narrow subset) and Agni Marutha (broad Saturn–Mars relationship) are distinct
 *  doshas — docs/agni-marutha-dosha.md: SM = conjunction / 7th-from-each-other / 4-10 only; all
 *  other Saturn–Mars relationships (aspects, ownership, nakshatra, parivartana) are Agni Marutha. */
export type ShaniMangalaRuleId = "shaniMangala.sm01" | "shaniMangala.sm02" | "shaniMangala.sm03";
export type AgniMaruthaRuleId =
    | "agniMarutha.am01"
    | "agniMarutha.am02"
    | "agniMarutha.am03"
    | "agniMarutha.am04"
    | "agniMarutha.am05"
    | "agniMarutha.am06"
    | "agniMarutha.am07"
    | "agniMarutha.am08";
export type ManglikRuleId = "manglik.mk01" | "manglik.mk02" | "manglik.mk03";
export type DharmaKarmadhipatiRuleId =
    "dharmaKarmadhipati.dk01" | "dharmaKarmadhipati.dk02" | "dharmaKarmadhipati.dk03";
export type YogaRuleId = DharmaKarmadhipatiRuleId;
export type DoshaRuleId = ShaniMangalaRuleId | AgniMaruthaRuleId | ManglikRuleId;

/** Registered mitigation rule ids (cancellation.ts). */
export type MitigationKey = "shaniMangala.mitigation.sm-mit-001" | "manglik.mitigation.mk-mit-001";
export type MitigationType = "BENEFIC_INFLUENCE";
export type MitigationEffect = "REDUCES_SEVERITY";
export type MitigationConfidence = 1 | 2 | 3;

/** Registered cancellation rule ids (cancellation.ts — none registered yet). */
export type CancellationKey = "shaniMangala.cancellation.sm-can-001";

export type RuleId = YogaRuleId | DoshaRuleId | MitigationKey | CancellationKey;

/** A single planet as the engine consumes it (subset of the stored Planet record). */
export interface PlanetFact {
    planetName: number;
    sign: number;
    house: number;
    degree: number;
    absoluteDegree: number;
    strength: PlanetaryStrength;
    navamsaSign: number;
    navamsaStrength: PlanetaryStrength;
    /** Stored nakshatra id (1..27; 0/missing on legacy records → nakshatra rules fail closed). */
    nakshatra: number;
    /** Stored graha drishti records — reused verbatim, never recomputed (US-YD-002 Edge). */
    aspects: AspectFact[];
}

export interface AspectFact {
    planetName: number;
    /** Numeric aspect angle in degrees (repo convention from planetAspects.ts). */
    aspectType: number;
    degreeGap: number;
}

export type ChartSource = "auto" | "manual";

/** Input facts for the evaluation pipeline (architecture §ChartFacts, adapted to numeric enums). */
export interface ChartFacts {
    ascendantSign: number;
    source: ChartSource;
    tradition: Tradition;
    thithi?: number;
    day?: number;
    maranakaraka?: number[];
    planets: PlanetFact[];
}

/** One evaluated rule: how it was triggered and what it contributes. */
export interface RuleReason {
    rule: RuleId;
    /** i18n key under yoga.<id>.rule / dosha.<id>.rule (params substitute at render). */
    reasonKey: string;
    params?: Record<string, string | number>;
}

export interface FormationInfo {
    /** Every satisfied rule of the catalog entry, deduped, in catalog order. */
    rulesTriggered: RuleId[];
    /** Highest-ranked satisfied rule (catalog order) — the named yoga/dosha basis. */
    primaryRule: RuleId;
    /** Lower enum = stronger/more severe (data-model §Yoga Strength). */
    strength: YogaStrength;
    reasons: RuleReason[];
}

export interface ThemeInfo {
    /** i18n key with house{n} prefixes (the Result block groups by these). */
    key: string;
    params?: Record<string, string | number>;
}

export interface ContextInfo {
    /** Houses whose life areas the formation emphasises. */
    houseImpact: number[];
}

export interface InterpretationInfo {
    themes: ThemeInfo[];
}

export interface MitigationFactor {
    factorKey: MitigationKey;
    type: MitigationType;
    effect: MitigationEffect;
    /** The lowermost severity (weakest) this factor may produce. */
    target: YogaStrength;
    confidence: MitigationConfidence;
}

export interface CancellationInfo {
    /** 1 Not Cancelled, 2 Cancelled, 3 Mitigated (data-model §CancellationStatus). */
    status: CancellationStatus;
    factors: MitigationFactor[];
}

export interface FinalAssessment {
    /** Weighted synthesis of formation/affliction/mitigation/cancellation, clamped 1..4. */
    severity: YogaStrength;
    /** i18n expression keys (expression paragraph lines). */
    expressionKeys: string[];
}

export interface DashaActivation {
    /** Planets whose dasha periods activate the result. */
    planets: number[];
    noteKey: string;
}

interface RuleEvaluationBase {
    id: string;
    kind: CatalogKind;
    isPresent: boolean;
    tradition: Tradition;
    formation: FormationInfo;
    context: ContextInfo;
    interpretation: InterpretationInfo;
    mitigation: MitigationFactor[];
    cancellation: CancellationInfo;
    finalAssessment: FinalAssessment;
    dashaActivation?: DashaActivation;
}

export interface YogaEvaluation extends RuleEvaluationBase {
    id: YogaId;
    kind: "yoga";
}

export interface DoshaEvaluation extends RuleEvaluationBase {
    id: DoshaId;
    kind: "dosha";
}

export type YogaDoshaEvaluation = YogaEvaluation | DoshaEvaluation;

/** Persisted CalculatedDetails shape: `yogas: YogaEvaluation[]`, `doshas: { doshas: DoshaEvaluation[] }`. */
export interface YogaDoshaResult {
    yogas: YogaEvaluation[];
    doshas: DoshaEvaluation[];
}

/** Rule definition shape returned by rules.ts evaluators. */
export interface RuleEvaluation {
    rule: RuleId;
    triggered: boolean;
    strength: number;
    reasonKey: string;
    params?: Record<string, string | number>;
    /** Houses the rule's result emphasises (feeds context.houseImpact). */
    houseImpact?: number[];
}
