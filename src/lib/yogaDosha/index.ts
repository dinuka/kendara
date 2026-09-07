/**
 * Yoga / Dosha — module entry point.
 * Architecture §index exports: computeYogaDoshas, buildChartFacts, resolveYogas, resolveDoshas
 * plus the catalog registry and the shared shape validator (QA UT-YD-155).
 */
export {
    DOSHA_CATALOG,
    YOGA_CATALOG,
    activeDoshaEntries,
    activeYogaEntries,
    catalogAliasesFor,
    catalogNameFor,
    doshaCatalogEntry,
    yogaCatalogEntry,
} from "@/lib/yogaDosha/catalog";

export { buildChartFacts, computeYogaDoshas, YOGA_DOSHA_VERSION } from "@/lib/yogaDosha/ruleEngine";

export {
    isWellFormedEntry,
    resolveDoshas,
    resolveYogaDoshas,
    resolveYogas,
    validateYogaDoshaShape,
} from "@/lib/yogaDosha/resolve";

export type { CatalogEntry, CatalogEntryBase, DoshaCatalogEntry, YogaCatalogEntry } from "@/lib/yogaDosha/catalog";
export type { ChartFactsInput } from "@/lib/yogaDosha/ruleEngine";
export type {
    AspectFact,
    CancellationInfo,
    CatalogKind,
    ChartFacts,
    ChartSource,
    ContextInfo,
    DashaActivation,
    DoshaEvaluation,
    DoshaId,
    DoshaRuleId,
    FinalAssessment,
    FormationInfo,
    InterpretationInfo,
    MitigationFactor,
    MitigationKey,
    PlanetFact,
    RuleEvaluation,
    RuleId,
    RuleReason,
    ThemeInfo,
    Tradition,
    YogaDoshaEvaluation,
    YogaDoshaResult,
    YogaEvaluation,
    YogaId,
    YogaRuleId,
} from "@/lib/yogaDosha/types";
export type { ShapeProblem } from "@/lib/yogaDosha/resolve";
export type { PlanetLike } from "@/lib/yogaDosha/ruleEngine";
