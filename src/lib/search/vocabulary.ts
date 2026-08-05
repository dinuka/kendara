import { NAKSHATRA_NAMES, PLANET_NAMES, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { stripJoiners } from "@/lib/search/utils";

export const SINHALA_YOGA = ["යෝග", "යෝගය", "යෝග තිබෙන"];
export const ENGLISH_YOGA = ["yoga", "yogas", "yogic"];
export const ASCENDANT_WORDS = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];
export const DOSHA_WORDS = ["දෝෂය", "දෝෂ", "dosha", "doshas"];

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
    | "gandamula";

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
];

export const SEARCH_VOCABULARY: string[] = [...new Set(VOCABULARY_WORDS)];

export const vocabularySkeleton = (word: string): string => stripJoiners(word).toLowerCase();
