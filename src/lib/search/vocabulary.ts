import { NAKSHATRA_NAMES, PLANET_NAMES, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { stripJoiners } from "@/lib/search/utils";

export const SINHALA_YOGA = ["යෝග", "යෝගය", "යෝග තිබෙන"];
export const ENGLISH_YOGA = ["yoga", "yogas", "yogic"];
export const ASCENDANT_WORDS = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];
export const DOSHA_WORDS = ["දෝෂය", "දෝෂ", "dosha", "doshas"];

const TRIGGER_WORDS = [
    ...SINHALA_YOGA,
    ...ENGLISH_YOGA,
    ...ASCENDANT_WORDS,
    ...DOSHA_WORDS,
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
];

export const SEARCH_VOCABULARY: string[] = [...new Set(VOCABULARY_WORDS)];

export const vocabularySkeleton = (word: string): string => stripJoiners(word).toLowerCase();
