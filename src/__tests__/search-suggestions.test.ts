import { NAKSHATRA_NAMES } from "@/lib/astrologyEnums";
import { getSuggestions, insertSuggestion, splitLastToken } from "@/lib/search/suggestions";
import { NAKSHATRA_WORDS, normalizeNakshatraQuery } from "@/lib/search/utils";

describe("getSuggestions", () => {
    test("ග suggests ගුරු", () => {
        expect(getSuggestions("ග")).toContain("ගුරු");
    });

    test("උ suggests උච්ච, උත්‍රසල, and උත්‍රපුටුප", () => {
        const suggestions = getSuggestions("උ");
        expect(suggestions).toContain("උච්ච");
        expect(suggestions).toContain("උත්‍රසල");
        expect(suggestions).toContain("උත්‍රපුටුප");
    });

    test("english prefix suggests planet names", () => {
        expect(getSuggestions("jup")).toContain("jupiter");
    });

    test("matches a word inside a multi-word nakshatra entry", () => {
        expect(getSuggestions("uttara")).toContain("uttara phalguni");
        expect(getSuggestions("phal")).toContain("uttara phalguni");
    });

    test("දෙර්කාණ suggests දෙර්කාණාධිපති", () => {
        expect(getSuggestions("දෙර්කාණ")).toContain("දෙර්කාණාධිපති");
    });

    test("නවාංශ suggests නවාංශකාධිපති", () => {
        expect(getSuggestions("නවාංශ")).toContain("නවාංශකාධිපති");
    });

    test("වර්ගෝත්තම is suggested", () => {
        expect(getSuggestions("වර්ග")).toContain("වර්ගෝත්තම");
    });

    test("ගණ්ඩාන්ත and ගණ්ඩමූල are suggested", () => {
        expect(getSuggestions("ගණ්ඩ")).toContain("ගණ්ඩාන්ත");
        expect(getSuggestions("ගණ්ඩ")).toContain("ගණ්ඩමූල");
    });

    test("wargottama is suggested from the english prefix", () => {
        expect(getSuggestions("varg")).toContain("vargottama");
    });

    test("is ZWJ-insensitive when the token omits the joiner", () => {
        expect(getSuggestions("ශුක")).toContain("ශුක්‍ර");
    });

    test("returns no suggestions for an empty token", () => {
        expect(getSuggestions("")).toEqual([]);
    });

    test("returns no suggestions for a token matching nothing", () => {
        expect(getSuggestions("zzz")).toEqual([]);
    });
});

describe("colloquial nakshatra alias safety", () => {
    // NAKSHATRA_COLLOQUIAL_NAMES only ever participates in exact-equality
    // comparisons against a query span's skeleton (see matchNormalizedSpan in
    // search/utils.ts), never containment — so the invariant that matters is
    // that no skeleton is shared by two different nakshatra values (which
    // would make matchNormalizedSpan return null for a previously-working
    // lookup), and no skeleton coincides with a bare NAKSHATRA_WORDS trigger
    // word (which would make findNakshatraMatch resolve a nakshatra out of
    // the trigger word alone).
    test("every alias/trigger skeleton maps to at most one nakshatra value", () => {
        const skeletonToValues = new Map<string, Set<number>>();

        const record = (skeleton: string, value: number | null) => {
            const values = skeletonToValues.get(skeleton) ?? new Set<number>();
            if (value !== null) values.add(value);
            skeletonToValues.set(skeleton, values);
        };

        for (const [word, value] of Object.entries(NAKSHATRA_NAMES)) {
            record(normalizeNakshatraQuery(word), value);
        }
        for (const triggerSkeleton of NAKSHATRA_WORDS) {
            record(triggerSkeleton, null);
        }

        const ambiguous = [...skeletonToValues.entries()].filter(([, values]) => values.size > 1);
        expect(ambiguous).toEqual([]);

        const triggerWordSet = new Set(NAKSHATRA_WORDS);
        const aliasSkeletonsCollidingWithTrigger = [...skeletonToValues.keys()].filter(
            (skeleton) => triggerWordSet.has(skeleton) && skeletonToValues.get(skeleton)!.size > 0,
        );
        expect(aliasSkeletonsCollidingWithTrigger).toEqual([]);
    });
});

describe("splitLastToken", () => {
    test("splits the in-progress last token from preceding text", () => {
        expect(splitLastToken("සිංහ ලග්නය ග")).toEqual({ prefix: "සිංහ ලග්නය ", lastToken: "ග" });
    });

    test("treats a single word as the last token with empty prefix", () => {
        expect(splitLastToken("ග")).toEqual({ prefix: "", lastToken: "ග" });
    });
});

describe("insertSuggestion", () => {
    test("replaces only the last token and appends a trailing space", () => {
        expect(insertSuggestion("සිංහ ලග්නය ග", "ගුරු")).toBe("සිංහ ලග්නය ගුරු ");
    });

    test("works when the query is a single in-progress token", () => {
        expect(insertSuggestion("ග", "ගුරු")).toBe("ගුරු ");
    });
});
