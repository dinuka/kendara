import { NAKSHATRA_NAMES, PLANET_NAMES, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { stripJoiners } from "@/lib/search/utils";
import { DOSHA_CATALOG, YOGA_CATALOG } from "@/lib/yogaDosha/catalog";
import type { YogaId } from "@/lib/yogaDosha/types";

export const SINHALA_YOGA = ["යෝග", "යෝගය", "යෝග තිබෙන"];
export const ENGLISH_YOGA = ["yoga", "yogas", "yogic"];
export const ASCENDANT_WORDS = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];
export const DOSHA_WORDS = ["දෝෂය", "දෝෂ", "dosha", "doshas"];

// Words that negate the yoga/dosha name next to them, so the search matches charts where it is
// absent or cancelled. Sinhala (and the English "absent"/"cancelled") follow the name ("කුජ දෝෂය
// නැති", "Kuja dosha cancelled"); the English prefix words lead it ("without Kuja dosha").
export const NEGATION_SUFFIX_WORDS = [
    "නොමැති",
    "නොමැත",
    "නැති",
    "නැත",
    "රහිත",
    "අවලංගු",
    "not present",
    "absent",
    "cancelled",
    "canceled",
];
export const NEGATION_PREFIX_WORDS = ["without", "not", "non", "no"];

// Search-only "families" of yoga ids that share a common group term (e.g. the five Pancha
// Maha Purusha yogas). A family condition matches a horoscope when ANY member id is present,
// so the group term "පංච මහා පුරුෂ යෝග" stays an OR across the family — NOT an AND of five
// separate yoga_id conditions (which would wrongly demand every Maha Purusha yoga at once).
// Family terms name a group, not a single yoga, so they intentionally live here rather than in
// the yoga catalog (which must stay one-entry-per-yoga for per-yoga evaluation/reasoning).
export const YOGA_FAMILIES: Record<string, YogaId[]> = {
    panchaMahaPurusha: ["ruchaka", "bhadra", "hamsa", "malavya", "sasha"],
    parasharaYoga: [
        "pushkala",
        "rajaChitta",
        "champaka",
        "amathya",
        "dharukaKarma",
        "priyamrityu",
        "bhagyaVyaya",
        "dharmaKarmadhipati",
        "bhumiDravya",
        "rinaVyaya",
        "chittaHani",
    ],
    parivartanaYoga: ["mahaParivartana", "khalaParivartana", "dainyaParivartana"],
};

// Family group-term aliases (bilingual) → familyId. Keyed on the same stripJoiners().lowercase()
// skeleton used elsewhere so catalog-word-boundary matching can reuse the same span scan. Kept in
// vocabulary.ts (not catalogs) so search suggestions and the API parse from the SAME source.
export const FAMILY_NAME_WORDS: Record<string, string> = Object.fromEntries(
    Object.entries({
        panchaMahaPurusha: [
            "Pancha Maha Purusha Yoga",
            "Pancha Mahapurusha Yoga",
            "The Five Maha Purusha Yogas",
            "පංච මහා පුරුෂ යෝග",
            "පංච මහා පුරුෂ යෝගය",
        ],
        parasharaYoga: [
            "Parashara Yoga",
            "Parashara Yogas",
            "Parashara Sambandha Yoga",
            "පරාශර යෝග",
            "පරාශර යෝගය",
            "පරාශර සම්බන්ධ යෝග",
        ],
        parivartanaYoga: [
            "Parivartana Yoga",
            "Parivartana Yogaya",
            "Pariwarthana Yoga",
            "පරිවර්තන යෝග",
            "පරිවර්තන යෝගය",
            "පරිවර්තන යෝගයක්",
        ],
    }).flatMap(([familyId, words]) => words.map((word) => [stripJoiners(word).toLowerCase(), familyId] as const)),
);

// Yoga/Dosha catalog display names + aliases → catalog id (e.g. "ශනි කුජ" → "shaniMangala").
// The catalog (src/lib/yogaDosha/catalog.ts) is the single source of aliases — deriving this map
// keeps search vocabulary and the catalog in lock-step (normalize the candidate word with
// vocabularySkeleton before lookup).
export const YOGA_DOSHA_NAME_WORDS: Record<string, string> = Object.fromEntries(
    [...YOGA_CATALOG, ...DOSHA_CATALOG].flatMap((entry) =>
        [entry.keywordEn, entry.keywordSi, ...entry.searchAliasesEn, ...entry.searchAliasesSi].map(
            (word) => [stripJoiners(word).toLowerCase(), entry.id] as const,
        ),
    ),
);

// Strong-classification names ("ප්‍රබල ධන යෝග", "Prabala Dhana Yoga") → `<yogaId>.<classification>`
// key, derived from each catalog entry's `strongClassification`. They share the catalog span scan,
// so the longer strong name overshadows the base "ධන යෝග" and matches only Prabala charts.
export const YOGA_CLASSIFICATIONS: Record<string, { yogaId: YogaId; classification: string }> = {};
export const CLASSIFICATION_NAME_WORDS: Record<string, string> = {};

YOGA_CATALOG.forEach(({ id, strongClassification }) => {
    if (!strongClassification) return;
    const { classification, keywordEn, keywordSi, searchAliasesEn, searchAliasesSi } = strongClassification;
    const key = `${id}.${classification}`;
    YOGA_CLASSIFICATIONS[key] = { yogaId: id, classification };
    [keywordEn, keywordSi, ...searchAliasesEn, ...searchAliasesSi].forEach((word) => {
        CLASSIFICATION_NAME_WORDS[stripJoiners(word).toLowerCase()] = key;
    });
});

// Words that refer to the Navamsa (D9) chart itself — a sign paired with one of
// these words (e.g. "Mesha lagna Mesha Navanshaka") means the navamsa lagna sign,
// distinct from PLANET_ROLE_WORDS.navamsa (the 64th Navamsa lord).
export const NAVAMSA_WORDS = [
    "නවාංශකා",
    "නවාංශක",
    "නවාංශය",
    "නවාංශ",
    "නවාම්ශ",
    "navamsa",
    "navamsha",
    "navanshaka",
    "navamsaka",
    "navansaka",
    "navamshaka",
];

// Words that trigger a Bhava Suchika (භාව සුචික) query — the house (1-12) a point's
// Navamsa sign occupies in the birth chart. "භාව" alone is deliberately excluded (it
// means "house", a different concept — see the planet_in_house regex).
export const BHAVA_SUCHIKA_WORDS = ["භාව සුචික", "bhava suchika", "house index", "නිවාස දර්ශක"];

// Display-form Bhava Suchika house-index names (Sinhala + English) keyed exactly as the
// `astrology.bhavaSuchika.names.*` i18n messages, so tests can diff the two maps and the
// search UI can look names up by key. Matching lowercases + strips joiners on both sides.
export const BHAVA_SUCHIKA_NAMES_SI: Record<string, number> = {
    ලග්නාංශකය: 1,
    ධනාංශකය: 2,
    වික්‍රමාංශකය: 3,
    සුඛාංශකය: 4,
    පූර්වපුන්‍යාංශකය: 5,
    ශෂ්ඨාංශකය: 6,
    සප්තමාංශකය: 7,
    නිධානාංශකය: 8,
    භාග්‍යාංශකය: 9,
    අභිමානාංශකය: 10,
    ලාභාංශකය: 11,
    ව්‍යාංශකය: 12,
};

export const BHAVA_SUCHIKA_NAMES_EN: Record<string, number> = {
    Lagnamshaka: 1,
    Dhanamshaka: 2,
    Vikramamshaka: 3,
    Sukhamshaka: 4,
    Purvapunyamshaka: 5,
    Shashthamshaka: 6,
    Saptamamshaka: 7,
    Nidhanamshaka: 8,
    Bhagyamshaka: 9,
    Abhimanamshaka: 10,
    Labhamshaka: 11,
    Vyamshaka: 12,
};

// Sinhala house (භාව) names, keyed to the house number. A name followed by "අධිපති" or the
// joined "ාධිපති" ("ලග්නාධිපති", "සුඛස්ථානාධිපති") names that house's lord; the optional
// "ස්ථාන" after a name is handled by the parser, so only the bare names are listed.
export const HOUSE_NAMES_SI: Record<string, number> = {
    ලග්න: 1,
    තනු: 1,
    ධන: 2,
    කුටුම්බ: 2,
    සහජ: 3,
    සහෝදර: 3,
    වික්‍රම: 3,
    පරාක්‍රම: 3,
    භ්‍රාතෘ: 3,
    සුඛ: 4,
    සුක: 4,
    බන්ධු: 4,
    මාතෘ: 4,
    පුත්‍ර: 5,
    පූර්වපුණ්‍ය: 5,
    පූර්වපුන්‍ය: 5,
    පංචම: 5,
    ශත්‍රු: 6,
    සතුරු: 6,
    රෝග: 6,
    රිපු: 6,
    අරි: 6,
    ෂෂ්ඨ: 6,
    ශෂ්ඨ: 6,
    කලත්‍ර: 7,
    කළත්‍ර: 7,
    භාර්යා: 7,
    සප්තම: 7,
    යුවති: 7,
    ආයු: 8,
    ආයුෂ: 8,
    මරණ: 8,
    අෂ්ටම: 8,
    අෂ්ඨම: 8,
    රන්ධ්‍ර: 8,
    නිධාන: 8,
    නිධන: 8,
    භාග්‍ය: 9,
    ධර්ම: 9,
    පිතෘ: 9,
    නවම: 9,
    කර්ම: 10,
    රාජ්‍ය: 10,
    දශම: 10,
    ලාභ: 11,
    ආය: 11,
    ව්‍යය: 12,
    වැය: 12,
    මෝක්ෂ: 12,
    ද්වාදශ: 12,
};

export type PlanetRoleKey =
    | "ashtamansha"
    | "nidhanamsha"
    | "maraka"
    | "badhaka"
    | "drekkana"
    | "navamsa"
    | "atmakaraka"
    | "wargoththama"
    | "gandanta"
    | "gandamula"
    | "pushkara";

// Words that signal a planet's special role (varga) in the horoscope. Each maps to a
// field on CalculatedDetails: ashtamanshaPlanets, nidhanamshaPlanets, marakaPlanets,
// badhakaPlanet (arrays), wargoththamaPlanets/gandanthaPlanets/gandamulaPlanets (arrays),
// and lord22ndDrekkana, lord64thNavamsa, atmakaraka (single).
export const PLANET_ROLE_WORDS: Record<PlanetRoleKey, string[]> = {
    ashtamansha: [
        "අෂ්ඨමාංශ",
        "අෂ්ටමාංශ",
        "අශ්ඨමාංශ",
        "අස්ථමාංශ",
        "අස්ටමාංශ",
        "ashtamansha",
        "astamansha",
        "astamamsha",
    ],
    nidhanamsha: ["නිධනාම්ශ", "නිධනාම්ෂ", "නිධනාංශ", "nidhanamsha"],
    maraka: ["මාරක", "maraka"],
    badhaka: ["බාධක", "badhaka", "badaka"],
    drekkana: [
        "ද්‍රැක්කානාධිපති",
        "ද්‍රැක්කාන",
        "ද්‍රෙක්කාන",
        "ද්‍රැකාන",
        "දෙර්කාණාධිපති",
        "දෙර්කාණ",
        "දෙර්කාන",
        "දෙර්කානාධිපති",
        "drekkana",
        "drekana",
        "derkana",
    ],
    navamsa: ["නවාංශකාධිපති", "නවාංශකාධිපතියා", "නවාම්ශකාධිපති", "නවාම්ශ", "නවාංශ", "navamsa", "navamsha"],
    atmakaraka: ["ආත්මකාරක", "atmakaraka"],
    wargoththama: ["වර්ගෝත්තම", "වර්ගොත්තම", "wargoththama", "wargottama", "wargotthama", "vargottama"],
    gandanta: ["ගණ්ඩාන්ත", "ගන්ඩාන්ත", "gandanta", "gandaanta"],
    gandamula: ["ගණ්ඩමූල", "ගන්ඩමූල", "gandamula", "gandamoola"],
    pushkara: ["පුෂ්කර", "පුෂ්කර ග්‍රහ", "pushkara", "pushkar", "pushkaram"],
};

const ROLE_TRIGGER_WORDS = Object.values(PLANET_ROLE_WORDS).flat();

const TRIGGER_WORDS = [
    ...SINHALA_YOGA,
    ...ENGLISH_YOGA,
    ...ASCENDANT_WORDS,
    ...DOSHA_WORDS,
    ...NEGATION_SUFFIX_WORDS,
    ...NEGATION_PREFIX_WORDS,
    ...Object.keys(YOGA_DOSHA_NAME_WORDS),
    ...Object.keys(FAMILY_NAME_WORDS),
    ...ROLE_TRIGGER_WORDS,
];

// Every word the search API can actually parse into a filter — sign, planet,
// nakshatra (including colloquial Sinhala forms), strength, and trigger words.
// Suggestions must be drawn only from this pool so a suggested word is
// guaranteed to be searchable.
const VOCABULARY_WORDS: string[] = [
    ...Object.keys(PLANET_NAMES),
    ...Object.keys(ZODIAC_SIGN_NAMES),
    ...Object.keys(NAKSHATRA_NAMES),
    ...Object.keys(STRENGTH_LABELS),
    ...TRIGGER_WORDS,
    ...BHAVA_SUCHIKA_WORDS,
    ...Object.keys(BHAVA_SUCHIKA_NAMES_SI),
    ...Object.keys(BHAVA_SUCHIKA_NAMES_EN),
    ...Object.keys(HOUSE_NAMES_SI).map((name) => `${name}ස්ථානාධිපති`),
];

export const SEARCH_VOCABULARY: string[] = [...new Set(VOCABULARY_WORDS)];

export const vocabularySkeleton = (word: string): string => stripJoiners(word).toLowerCase();
