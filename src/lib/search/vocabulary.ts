import { NAKSHATRA_NAMES, PLANET_NAMES, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { stripJoiners } from "@/lib/search/utils";

export const SINHALA_YOGA = ["යෝග", "යෝගය", "යෝග තිබෙන"];
export const ENGLISH_YOGA = ["yoga", "yogas", "yogic"];
export const ASCENDANT_WORDS = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];
export const DOSHA_WORDS = ["දෝෂය", "දෝෂ", "dosha", "doshas"];

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

const TRIGGER_WORDS = [...SINHALA_YOGA, ...ENGLISH_YOGA, ...ASCENDANT_WORDS, ...DOSHA_WORDS, ...ROLE_TRIGGER_WORDS];

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
];

export const SEARCH_VOCABULARY: string[] = [...new Set(VOCABULARY_WORDS)];

export const vocabularySkeleton = (word: string): string => stripJoiners(word).toLowerCase();
