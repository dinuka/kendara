import { NAKSHATRA_COLLOQUIAL_KEYS, NAKSHATRA_NAMES } from "@/lib/astrologyEnums";

const SINHALA_UNICODE_RANGE = /[\u0D80-\u0DFF]/;
const ZERO_WIDTH_JOINERS = /[\u200C\u200D]/g;

export const detectLanguage = (query: string): "si" | "en" => {
    return SINHALA_UNICODE_RANGE.test(query) ? "si" : "en";
};

export const stripJoiners = (text: string): string => {
    return text.replace(ZERO_WIDTH_JOINERS, "");
};

// Sinhala virama (\u0DCA) and all dependent vowel signs (constructed forms like
// \u0DD9 + \u0DCA + \u0DBA collapse to the same skeleton as the bare consonant).
const SINHALA_VIRAMA_AND_VOWEL_SIGNS = /[\u0DCA-\u0DDF\u0DF2\u0DF3]/g;

// Aspirated/retroflex/sibilant consonants that Sinhala speakers routinely
// interchange with their plain counterparts in casual typing.
const SINHALA_CONSONANT_FOLD_MAP: Record<string, string> = {
    ඵ: "\u0DB4",
    ථ: "\u0DAD",
    ඛ: "\u0D9A",
    ඝ: "\u0D9C",
    ඡ: "\u0DA0",
    ඣ: "\u0DA2",
    ධ: "\u0DAF",
    භ: "\u0DB6",
    ඨ: "\u0DA7",
    ඪ: "\u0DA9",
    ෂ: "\u0DC3",
    ශ: "\u0DC3",
    ණ: "\u0DB1",
    ළ: "\u0DBD",
};

const foldSinhalaConsonants = (text: string): string => {
    return [...text].map((ch) => SINHALA_CONSONANT_FOLD_MAP[ch] ?? ch).join("");
};

// English-side folds for the same class of casual-typing variance
// (uthrapal / uttra phalguni / uttarphalguni should all normalize together).
const ENGLISH_FOLDS: Array<[RegExp, string]> = [
    [/ph/g, "p"],
    [/th/g, "t"],
    [/sh/g, "s"],
    [/kh/g, "k"],
    [/gh/g, "g"],
    [/aa/g, "a"],
    [/ee/g, "i"],
];

const collapseRepeats = (text: string): string => text.replace(/(.)\1+/g, "$1");

export const normalizeNakshatraQuery = (text: string): string => {
    let normalized = stripJoiners(text.toLowerCase());

    if (SINHALA_UNICODE_RANGE.test(normalized)) {
        normalized = normalized.replace(SINHALA_VIRAMA_AND_VOWEL_SIGNS, "");
        normalized = foldSinhalaConsonants(normalized);
    } else {
        for (const [pattern, replacement] of ENGLISH_FOLDS) {
            normalized = normalized.replace(pattern, replacement);
        }
    }

    normalized = normalized.replace(/\s+/g, "");
    normalized = collapseRepeats(normalized);
    return normalized;
};

const RAW_NAKSHATRA_WORDS = [
    "\u0DB1\u0DD0\u0D9A\u0DAD",
    "\u0DB1\u0DD0\u0D9A\u0DD0\u0DAD",
    "\u0DB1\u0D9A\u0DCA\u0DC2\u0DAD\u0DCA\u200D\u0DBB\u0DBA",
    "\u0DB1\u0D9A\u0DCA\u0DC2\u0DAD\u0DCA\u200D\u0DBB",
    "nakshatra",
    "nakshathra",
    "star",
];

// Gate words normalized the same way as query spans, so a query built from
// tokens that individually normalize (e.g. the ligature "\u0DB1\u0D9A\u0DCA\u0DC2\u0DAD\u0DCA\u200D\u0DBB\u0DBA") is still
// recognized after normalization strips the ligature joiner.
export const NAKSHATRA_WORDS = RAW_NAKSHATRA_WORDS.map(normalizeNakshatraQuery);

export const hasNakshatraTriggerWord = (rawQuery: string): boolean => {
    const normalizedQuery = normalizeNakshatraQuery(rawQuery);
    return NAKSHATRA_WORDS.some((w) => normalizedQuery.includes(w));
};

const NORMALIZED_NAKSHATRA_ALIASES: ReadonlyArray<readonly [string, number]> = Object.entries(NAKSHATRA_NAMES).map(
    ([word, value]) => [normalizeNakshatraQuery(word), value] as const,
);

const COLLOQUIAL_NORMALIZED = new Set(
    [...NAKSHATRA_COLLOQUIAL_KEYS].map(normalizeNakshatraQuery),
);

const matchNormalizedSpan = (normalizedSpan: string): number | null => {
    if (!normalizedSpan) return null;

    const exactMatches = new Set<number>();
    const containmentMatches = new Set<number>();
    for (const [alias, value] of NORMALIZED_NAKSHATRA_ALIASES) {
        if (alias === normalizedSpan) {
            exactMatches.add(value);
        } else if (
            !COLLOQUIAL_NORMALIZED.has(alias) &&
            (alias.includes(normalizedSpan) || normalizedSpan.includes(alias))
        ) {
            containmentMatches.add(value);
        }
    }

    if (exactMatches.size === 1) return [...exactMatches][0];
    if (exactMatches.size === 0 && containmentMatches.size === 1) return [...containmentMatches][0];
    return null;
};

// Tries every contiguous run of whitespace-separated tokens (longest first)
// so a nakshatra name embedded in a longer query \u2014 alongside a trigger word
// or unrelated terms like an ascendant sign \u2014 is still isolated and matched,
// without the surrounding text corrupting the normalized skeleton.
export const findNakshatraMatch = (rawQuery: string): number | null => {
    const tokens = rawQuery.split(/\s+/).filter(Boolean);

    for (let spanLength = tokens.length; spanLength >= 1; spanLength--) {
        for (let start = 0; start + spanLength <= tokens.length; start++) {
            const span = tokens.slice(start, start + spanLength).join(" ");
            const match = matchNormalizedSpan(normalizeNakshatraQuery(span));
            if (match !== null) return match;
        }
    }

    return null;
};

export const generateAnonymousPlaceholder = (horoscopeId: string): string => {
    const suffix = horoscopeId.slice(-4).toUpperCase();
    return `Anonymous Horoscope #${suffix}`;
};

interface HoroscopeLike {
    _id?: { toString(): string } | string;
    id?: string;
    name: string;
    owner: { id: string };
    displayName: boolean;
}

interface ResultLike {
    horoscope: HoroscopeLike;
}

export const anonymizeSearchResults = <T extends ResultLike>(results: T[], userId: string, userRole?: string): T[] => {
    if (userRole === "super-admin") return results;

    return results.map((r) => {
        if (r.horoscope.owner.id !== userId && !r.horoscope.displayName) {
            const horoscopeId = r.horoscope._id ? r.horoscope._id.toString() : r.horoscope.id || "";

            return {
                ...r,
                horoscope: {
                    ...r.horoscope,
                    name: generateAnonymousPlaceholder(horoscopeId),
                },
            };
        }
        return r;
    });
};

export const paginateResults = <T>(items: T[], page: number, pageSize: number) => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
        results: paginatedItems,
        total,
        page: safePage,
        pageSize,
        totalPages,
    };
};
