/**
 * Yoga / Dosha — rule catalog registry.
 * Mirrors the §Rule Catalog table in specs/business-analysis/data-model.md (registered rules,
 * strengths, tradition gates). English names are authoritative. Shani Mangala (narrow subset),
 * Agni Marutha (broad Saturn–Mars relationship, docs/agni-marutha-dosha.md) and Kuja Dosha
 * (docs/kuja-doshaya.md) are evaluated as distinct doshas; the Yoga catalog is empty this release.
 * Sinhala strings for pending-domain themes stay English placeholders until confirmed (BI-YD-703).
 */
import { DashaActivation, DoshaId, DoshaRuleId, MitigationKey, Tradition, YogaId, YogaRuleId } from "@/lib/yogaDosha/types";

export interface CatalogEntryBase {
    kind: "yoga" | "dosha";
    id: string;
    tradition: Tradition;
    /** `ACTIVE` entries are evaluated every calculation; `PENDING_DOMAIN` ones are seeded but
     *  never evaluated until the business term is confirmed (US-YD-007 / QA IT-YD-109). */
    status: "ACTIVE" | "PENDING_DOMAIN";
    /** English/Sinhala display keywords used by the search layer (also aliases below). */
    keywordEn: string;
    keywordSi: string;
    searchAliasesEn: string[];
    searchAliasesSi: string[];
    /** i18n namespace root, e.g. "dosha.shaniMangala" → dosha.shaniMangala.name. */
    i18nKey: string;
    /** Planets in the formation (feeds mitigation target lookup, e.g. Saturn+Mars = [7,3]). */
    planets: number[];
    /** i18n expression keys rendered in the Expression block (relative to the entry root). */
    expressionKeys: string[];
    rules: Array<{ rule: string; strength: number; reasonKey: string }>;
    /** Registered mitigation rules (evaluateEntry applies the ones that fire). */
    mitigations?: MitigationKey[];
    /** Dasha-period activation note (present when a defining dasha rule exists for the entry). */
    dashaActivation?: DashaActivation;
}

export interface YogaCatalogEntry extends CatalogEntryBase {
    kind: "yoga";
    id: YogaId;
    rules: Array<{
        rule: YogaRuleId;
        strength: number;
        reasonKey: string;
        /** Tradition gate: rules gated off for MAIN_STREAM are registered but never fire (SM-06). */
        traditions?: Tradition[];
    }>;
}

export interface DoshaCatalogEntry extends CatalogEntryBase {
    kind: "dosha";
    id: DoshaId;
    rules: Array<{ rule: DoshaRuleId; strength: number; reasonKey: string }>;
    cancellations: string[];
}

export type CatalogEntry = YogaCatalogEntry | DoshaCatalogEntry;

export const YOGA_CATALOG: YogaCatalogEntry[] = [];

export const DOSHA_CATALOG: DoshaCatalogEntry[] = [
    {
        kind: "dosha",
        id: "shaniMangala",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Shani Mangala Dosha",
        keywordSi: "ශනි මංගල දෝෂය",
        searchAliasesEn: ["Shani-Mangala", "Shani Mangala", "Saturn Mars yoga", "Saturn Mars dosha", "Saturn-Mars conjunction"],
        searchAliasesSi: ["ශනි මංගල", "ශනි කුජ යෝග", "ශනි කුජ දෝෂය"],
        i18nKey: "dosha.shaniMangala",
        planets: [7, 3],
        expressionKeys: ["expression.main"],
        dashaActivation: { planets: [7, 3], noteKey: "dosha.shaniMangala.dashaNote" },
        rules: [
            { rule: "shaniMangala.sm01", strength: 1, reasonKey: "rule.sm01" },
            { rule: "shaniMangala.sm02", strength: 2, reasonKey: "rule.sm02" },
            { rule: "shaniMangala.sm03", strength: 2, reasonKey: "rule.sm03" },
        ],
        // Jupiter's benefic aspect on either member (cancellation.ts) softens the harsh union.
        mitigations: ["shaniMangala.mitigation.sm-mit-001"],
        cancellations: [],
    },
    {
        kind: "dosha",
        id: "agniMarutha",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Agni Marutha Dosha",
        keywordSi: "අග්නි මාරුත දෝෂය",
        searchAliasesEn: ["Agni Marutha", "Agni-Marutha", "Saturn-Mars relationship", "Saturn and Mars conflict"],
        searchAliasesSi: ["අග්නි මාරුත", "අග්නිමාරුත"],
        i18nKey: "dosha.agniMarutha",
        planets: [7, 3],
        expressionKeys: ["expression.main"],
        dashaActivation: { planets: [7, 3], noteKey: "dosha.agniMarutha.dashaNote" },
        rules: [
            { rule: "agniMarutha.am01", strength: 1, reasonKey: "rule.am01" },
            { rule: "agniMarutha.am02", strength: 2, reasonKey: "rule.am02" },
            { rule: "agniMarutha.am03", strength: 2, reasonKey: "rule.am03" },
            { rule: "agniMarutha.am04", strength: 2, reasonKey: "rule.am04" },
            { rule: "agniMarutha.am05", strength: 2, reasonKey: "rule.am05" },
            { rule: "agniMarutha.am06", strength: 3, reasonKey: "rule.am06" },
            { rule: "agniMarutha.am07", strength: 3, reasonKey: "rule.am07" },
            { rule: "agniMarutha.am08", strength: 1, reasonKey: "rule.am08" },
        ],
        // No mitigations registered yet — the doc defines existence rules only (domain pending).
        mitigations: [],
        cancellations: [],
    },
    {
        kind: "dosha",
        id: "manglik",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Kuja Dosha",
        keywordSi: "කුජ දෝෂය",
        searchAliasesEn: ["Mangal", "Manglik dosha", "Kuja dosha", "Manglik"],
        searchAliasesSi: ["මංගල දෝෂ", "කුජ දෝෂ", "කුජ", "මංගල"],
        i18nKey: "dosha.manglik",
        planets: [3],
        expressionKeys: ["expression.partnershipStress"],
        rules: [
            { rule: "manglik.mk01", strength: 2, reasonKey: "rule.mk01" },
            { rule: "manglik.mk02", strength: 2, reasonKey: "rule.mk02" },
            { rule: "manglik.mk03", strength: 2, reasonKey: "rule.mk03" },
        ],
        mitigations: ["manglik.mitigation.mk-mit-001"],
        cancellations: [],
    },
];

export function yogaCatalogEntry(id: YogaId): YogaCatalogEntry | undefined {
    return YOGA_CATALOG.find((entry) => entry.id === id);
}

export function doshaCatalogEntry(id: DoshaId): DoshaCatalogEntry | undefined {
    return DOSHA_CATALOG.find((entry) => entry.id === id);
}

/** Catalog entries that are actually evaluated in a calculation (US-YD-007). */
export function activeYogaEntries(): YogaCatalogEntry[] {
    return YOGA_CATALOG.filter((entry) => entry.status === "ACTIVE");
}

export function activeDoshaEntries(): DoshaCatalogEntry[] {
    return DOSHA_CATALOG.filter((entry) => entry.status === "ACTIVE");
}

/** Display name for an evaluation (used by search results and CSV export). */
export function catalogNameFor(id: string, locale: "en" | "si"): string {
    const yoga = yogaCatalogEntry(id as YogaId);
    if (yoga) return locale === "si" ? yoga.keywordSi : yoga.keywordEn;
    const dosha = doshaCatalogEntry(id as DoshaId);
    if (dosha) return locale === "si" ? dosha.keywordSi : dosha.keywordEn;
    return "";
}

/** Search aliases for an evaluation id (both languages, folded lower-case). */
export function catalogAliasesFor(id: string): string[] {
    const yoga = yogaCatalogEntry(id as YogaId);
    if (yoga) return [...yoga.searchAliasesEn, ...yoga.searchAliasesSi].map((alias) => alias.toLowerCase());
    const dosha = doshaCatalogEntry(id as DoshaId);
    if (dosha) return [...dosha.searchAliasesEn, ...dosha.searchAliasesSi].map((alias) => alias.toLowerCase());
    return [];
}