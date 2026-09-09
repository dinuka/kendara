/**
 * Yoga / Dosha — rule catalog registry.
 * Mirrors the §Rule Catalog table in specs/business-analysis/data-model.md (registered rules,
 * strengths, tradition gates). English names are authoritative. Shani Mangala (narrow subset),
 * Agni Marutha (broad Saturn–Mars relationship, docs/agni-marutha-dosha.md) and Kuja Dosha
 * (docs/kuja-doshaya.md) are evaluated as distinct doshas; the Dharma Karmadhipati Yoga
 * (docs/dharma-karmadipathi-yogaya.md) is evaluated as the first yoga in the catalog.
 * Sinhala strings for pending-domain themes stay English placeholders until confirmed (BI-YD-703).
 */
import {
    BhadraRuleId,
    DashaActivation,
    DeeptaYogaRuleId,
    DoshaId,
    DoshaRuleId,
    HamsaRuleId,
    KalaAmurthaRuleId,
    KalaSarpaRuleId,
    MalavyaRuleId,
    MitigationKey,
    RuchakaRuleId,
    SashaRuleId,
    Tradition,
    YogaId,
    YogaRuleId,
} from "@/lib/yogaDosha/types";

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

export const YOGA_CATALOG: YogaCatalogEntry[] = [
    {
        kind: "yoga",
        id: "dharmaKarmadhipati",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Dharma Karmadhipati Yoga",
        keywordSi: "ධර්ම කර්මාධිපති යෝගය",
        searchAliasesEn: [
            "Dharma Karmadhipati",
            "Dharma-Karmadhipati",
            "Dharma Karmadhipathi",
            "9th lord 10th lord yoga",
        ],
        searchAliasesSi: ["ධර්ම කර්මාධිපති", "ධර්මකර්මාධිපති", "ධර්ම කර්මාධිපති යෝග"],
        i18nKey: "yoga.dharmaKarmadhipati",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "dharmaKarmadhipati.dk01", strength: 1, reasonKey: "rule.dk01" },
            { rule: "dharmaKarmadhipati.dk02", strength: 2, reasonKey: "rule.dk02" },
            { rule: "dharmaKarmadhipati.dk03", strength: 1, reasonKey: "rule.dk03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "pushkala",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Pushkala Yoga",
        keywordSi: "පුෂ්කල යෝගය",
        searchAliasesEn: ["Pushkala", "Parashara Pushkala", "1st lord 2nd lord yoga"],
        searchAliasesSi: ["පුෂ්කල", "පරාශර පුෂ්කල"],
        i18nKey: "yoga.pushkala",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "pushkala.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "pushkala.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "pushkala.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "rajaChitta",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Raja Chitta Yoga",
        keywordSi: "රාජ චිත්ත යෝගය",
        searchAliasesEn: ["Raja Chitta", "Rajachitta", "Parashara Raja Chitta", "2nd lord 3rd lord yoga"],
        searchAliasesSi: ["රාජ චිත්ත", "රාජචිත්ත", "පරාශර රාජ චිත්ත"],
        i18nKey: "yoga.rajaChitta",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "rajaChitta.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "rajaChitta.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "rajaChitta.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "champaka",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Champaka Yoga",
        keywordSi: "චම්පක යෝගය",
        searchAliasesEn: ["Champaka", "Parashara Champaka", "3rd lord 4th lord yoga"],
        searchAliasesSi: ["චම්පක", "පරාශර චම්පක"],
        i18nKey: "yoga.champaka",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "champaka.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "champaka.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "champaka.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "amathya",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Amathya Yoga",
        keywordSi: "අමාත්‍ය යෝගය",
        searchAliasesEn: ["Amathya", "Amatya", "Parashara Amathya", "4th lord 5th lord yoga"],
        searchAliasesSi: ["අමාත්‍ය", "අමාත්‍ය යෝග", "පරාශර අමාත්‍ය"],
        i18nKey: "yoga.amathya",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "amathya.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "amathya.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "amathya.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "dharukaKarma",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Dharuka Karma Yoga",
        keywordSi: "ධාරුක කර්ම යෝගය",
        searchAliasesEn: ["Dharuka Karma", "Dharukakarma", "Parashara Dharuka Karma", "5th lord 6th lord yoga"],
        searchAliasesSi: ["ධාරුක කර්ම", "ධාරුකකර්ම", "පරාශර ධාරුක කර්ම"],
        i18nKey: "yoga.dharukaKarma",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "dharukaKarma.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "dharukaKarma.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "dharukaKarma.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "priyamrityu",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Priyamrityu Yoga",
        keywordSi: "ප්‍රියමෘත්‍ය යෝගය",
        searchAliasesEn: [
            "Priyamrityu",
            "Priya Mrityu",
            "Parashara Priyamrityu",
            "6th lord 7th lord yoga",
            "7th lord 8th lord yoga",
        ],
        searchAliasesSi: ["ප්‍රියමෘත්‍ය", "ප්‍රිය මෘත්‍ය", "පරාශර ප්‍රියමෘත්‍ය"],
        i18nKey: "yoga.priyamrityu",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "priyamrityu.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "priyamrityu.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "priyamrityu.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "bhagyaVyaya",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Bhagya Vyaya Yoga",
        keywordSi: "භාග්‍ය වැය යෝගය",
        searchAliasesEn: ["Bhagya Vyaya", "Bhagyavyaya", "Parashara Bhagya Vyaya", "8th lord 9th lord yoga"],
        searchAliasesSi: ["භාග්‍ය වැය", "භාග්‍යව්‍යය", "පරාශර භාග්‍ය වැය"],
        i18nKey: "yoga.bhagyaVyaya",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "bhagyaVyaya.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "bhagyaVyaya.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "bhagyaVyaya.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "bhumiDravya",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Bhumi Dravya Yoga",
        keywordSi: "භූමි ද්‍රව්‍ය යෝගය",
        searchAliasesEn: ["Bhumi Dravya", "Bhoomi Dravya", "Parashara Bhumi Dravya", "10th lord 11th lord yoga"],
        searchAliasesSi: ["භූමි ද්‍රව්‍ය", "භූමිද්‍රව්‍ය", "පරාශර භූමි ද්‍රව්‍ය"],
        i18nKey: "yoga.bhumiDravya",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "bhumiDravya.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "bhumiDravya.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "bhumiDravya.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "rinaVyaya",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Rina Vyaya Yoga",
        keywordSi: "ඍණ වැය යෝගය",
        searchAliasesEn: ["Rina Vyaya", "Rinavyaya", "Runa Vyaya", "Parashara Rina Vyaya", "11th lord 12th lord yoga"],
        searchAliasesSi: ["ඍණ වැය", "රුණ වැය", "පරාශර ඍණ වැය"],
        i18nKey: "yoga.rinaVyaya",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "rinaVyaya.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "rinaVyaya.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "rinaVyaya.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "chittaHani",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Chitta Hani Yoga",
        keywordSi: "චිත්ත හානි යෝගය",
        searchAliasesEn: ["Chitta Hani", "Chittahani", "Parashara Chitta Hani", "12th lord 1st lord yoga"],
        searchAliasesSi: ["චිත්ත හානි", "චිත්තහානි", "පරාශර චිත්ත හානි"],
        i18nKey: "yoga.chittaHani",
        planets: [1, 2, 3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [
            { rule: "chittaHani.ps01", strength: 1, reasonKey: "rule.ps01" },
            { rule: "chittaHani.ps02", strength: 2, reasonKey: "rule.ps02" },
            { rule: "chittaHani.ps03", strength: 1, reasonKey: "rule.ps03" },
        ],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "ruchaka",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Ruchaka Yoga",
        keywordSi: "රැචක යෝගය",
        searchAliasesEn: ["Ruchaka", "Mars mahapurusha", "Pancha Maha Purusha Mars", "Mars kendra own sign exaltation"],
        searchAliasesSi: ["රැචක", "කුජ මහාපුරුෂ", "පංච මහා පුර්ෂ කුජ"],
        i18nKey: "yoga.ruchaka",
        planets: [3],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "ruchaka.pmp01", strength: 2, reasonKey: "rule.pmp01" }],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "bhadra",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Bhadra Yoga",
        keywordSi: "බද්‍රා යෝගය",
        searchAliasesEn: [
            "Bhadra",
            "Mercury mahapurusha",
            "Pancha Maha Purusha Mercury",
            "Mercury kendra own sign exaltation",
        ],
        searchAliasesSi: ["බද්‍රා", "බුධ මහාපුරුෂ", "පංච මහා පුර්ෂ බුධ"],
        i18nKey: "yoga.bhadra",
        planets: [4],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "bhadra.pmp02", strength: 2, reasonKey: "rule.pmp02" }],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "hamsa",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Hamsa Yoga",
        keywordSi: "හංස යෝගය",
        searchAliasesEn: [
            "Hamsa",
            "Jupiter mahapurusha",
            "Pancha Maha Purusha Jupiter",
            "Jupiter kendra own sign exaltation",
        ],
        searchAliasesSi: ["හංස", "ගුරු මහාපුරුෂ", "පංච මහා පුර්ෂ ගුරු"],
        i18nKey: "yoga.hamsa",
        planets: [5],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "hamsa.pmp03", strength: 2, reasonKey: "rule.pmp03" }],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "malavya",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Malavya Yoga",
        keywordSi: "මාලව්‍ය යෝගය",
        searchAliasesEn: [
            "Malavya",
            "Venus mahapurusha",
            "Pancha Maha Purusha Venus",
            "Venus kendra own sign exaltation",
        ],
        searchAliasesSi: ["මාලව්‍ය", "ශුක්‍ර මහාපුරුෂ", "පංච මහා පුර්ෂ ශුක්‍ර"],
        i18nKey: "yoga.malavya",
        planets: [6],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "malavya.pmp04", strength: 2, reasonKey: "rule.pmp04" }],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "sasha",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Sasha Yoga",
        keywordSi: "ශශ යෝගය",
        searchAliasesEn: [
            "Sasha",
            "Shasha",
            "Saturn mahapurusha",
            "Pancha Maha Purusha Saturn",
            "Saturn kendra own sign exaltation",
        ],
        searchAliasesSi: ["ශශ", "ශශය", "ශනි මහාපුරුෂ", "පංච මහා පුර්ෂ ශනි"],
        i18nKey: "yoga.sasha",
        planets: [7],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "sasha.pmp05", strength: 2, reasonKey: "rule.pmp05" }],
        mitigations: [],
    },
    {
        kind: "yoga",
        id: "deeptaYoga",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Deeptha Yoga",
        keywordSi: "දීප්ත යෝගය",
        searchAliasesEn: [
            // Both spellings resolve (SR-…): "Deeptha" is the display spelling, "Deepta" is kept
            // as a search alias so legacy / transliteration queries still resolve to this yoga.
            "Deeptha Yoga",
            "Deeptha",
            "Deepta Yoga",
            "Deepta",
            // Planet-qualified classifications match the i18n classification display names and
            // the user-facing phrasing ("Guru Deeptha Yoghaya", "Kuja Deepta Yoghaya").
            "Kuja Deeptha Yoga",
            "Kuja Deepta Yoga",
            "Budha Deeptha Yoga",
            "Budha Deepta Yoga",
            "Guru Deeptha Yoga",
            "Guru Deepta Yoga",
            "Shukra Deeptha Yoga",
            "Shukra Deepta Yoga",
            "Shani Deeptha Yoga",
            "Shani Deepta Yoga",
            "Pancha Maha Purusha partial",
            "One planet outside Rahu Ketu",
        ],
        searchAliasesSi: ["දීප්ත යෝග", "දීප්ත"],
        i18nKey: "yoga.deeptaYoga",
        planets: [3, 4, 5, 6, 7],
        expressionKeys: ["expression.main"],
        rules: [{ rule: "deeptaYoga.dy01", strength: 2, reasonKey: "rule.dy01" }],
        mitigations: [],
    },
];

export const DOSHA_CATALOG: DoshaCatalogEntry[] = [
    {
        kind: "dosha",
        id: "shaniMangala",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Shani Mangala Dosha",
        keywordSi: "ශනි මංගල දෝෂය",
        searchAliasesEn: [
            "Shani-Mangala",
            "Shani Mangala",
            "Saturn Mars yoga",
            "Saturn Mars dosha",
            "Saturn-Mars conjunction",
        ],
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
    {
        kind: "dosha",
        id: "kalaSarpa",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Kala Sarpa Dosha",
        keywordSi: "කාල සර්ප දෝෂය",
        searchAliasesEn: ["Kala Sarpa", "Kala Sarpa Dosha", "Kalasarpa", "Kala Sarpa yoga"],
        searchAliasesSi: ["කාල සර්ප", "කාල සර්ප දෝෂ", "කාලසර්ප"],
        i18nKey: "dosha.kalaSarpa",
        planets: [8, 9],
        expressionKeys: ["expression.main"],
        dashaActivation: { planets: [8], noteKey: "dosha.kalaSarpa.dashaNote" },
        rules: [{ rule: "kalaSarpa.ks01", strength: 1, reasonKey: "rule.ks01" }],
        mitigations: [],
        cancellations: [],
    },
    {
        kind: "dosha",
        id: "kalaAmurtha",
        tradition: "MAIN_STREAM",
        status: "ACTIVE",
        keywordEn: "Kala Amurtha Dosha",
        keywordSi: "කාල අමුර්ත දෝෂය",
        searchAliasesEn: ["Kala Amurtha", "Kala Amurtha Dosha", "Kala Amrita"],
        searchAliasesSi: ["කාල අමුර්ත", "කාල අමෘත"],
        i18nKey: "dosha.kalaAmurtha",
        planets: [8, 9],
        expressionKeys: ["expression.main"],
        dashaActivation: { planets: [9], noteKey: "dosha.kalaAmurtha.dashaNote" },
        rules: [{ rule: "kalaAmurtha.ka01", strength: 1, reasonKey: "rule.ka01" }],
        mitigations: [],
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

/** i18n key for an entry's classification-qualified display name, when one exists. Only
 *  deeptaYoga renders planet-qualified names today (e.g. `yoga.deeptaYoga.classification.Guru`
 *  → "Guru Deeptha Yoga"); other entries fall back to their base `name` key. */
export function classificationNameKey(entry: { kind: string; id: string; classification?: string }): string | null {
    if (entry.kind === "yoga" && entry.id === "deeptaYoga" && entry.classification) {
        return `yoga.deeptaYoga.classification.${entry.classification}`;
    }
    return null;
}

/** i18n key for an entry's classification-qualified expression, when one exists. Only
 *  deeptaYoga has per-planet expression text today (e.g. `yoga.deeptaYoga.expression.Guru`);
 *  other entries keep their generic `expression.main` key. */
export function classificationExpressionKey(entry: {
    kind: string;
    id: string;
    classification?: string;
}): string | null {
    if (entry.kind === "yoga" && entry.id === "deeptaYoga" && entry.classification) {
        return `yoga.deeptaYoga.expression.${entry.classification}`;
    }
    return null;
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
