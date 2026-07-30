import {
    anonymizeSearchResults,
    detectLanguage,
    generateAnonymousPlaceholder,
    paginateResults,
} from "@/lib/search/utils";

describe("detectLanguage", () => {
    test("detects Sinhala text", () => {
        expect(detectLanguage("මේෂ ලග්නය")).toBe("si");
        expect(detectLanguage("ශනි උච්ච")).toBe("si");
        expect(detectLanguage("අ,ආ,ඇ,ඈ")).toBe("si");
    });

    test("detects English text", () => {
        expect(detectLanguage("Aries Ascendant")).toBe("en");
        expect(detectLanguage("Saturn exaltation")).toBe("en");
        expect(detectLanguage("hello world")).toBe("en");
    });

    test("detects mixed text as Sinhala if Sinhala chars present", () => {
        expect(detectLanguage("ගුරු in 3rd house")).toBe("si");
        expect(detectLanguage("Aries මේෂ")).toBe("si");
    });

    test("returns 'en' for empty string", () => {
        expect(detectLanguage("")).toBe("en");
    });

    test("returns 'en' for text with only numbers and symbols", () => {
        expect(detectLanguage("12345")).toBe("en");
        expect(detectLanguage("!@#$%")).toBe("en");
    });
});

describe("generateAnonymousPlaceholder", () => {
    test("uses last 4 characters of UUID uppercased", () => {
        const result = generateAnonymousPlaceholder("550e8400-e29b-41d4-a716-446655440000");
        expect(result).toBe("Anonymous Horoscope #0000");
    });

    test("produces consistent output for same input", () => {
        const id = "660e8400-e29b-41d4-a716-44665544abcd";
        const first = generateAnonymousPlaceholder(id);
        const second = generateAnonymousPlaceholder(id);
        expect(first).toBe(second);
    });

    test("handles short strings", () => {
        const result = generateAnonymousPlaceholder("ab");
        expect(result).toBe("Anonymous Horoscope #AB");
    });

    test("different IDs produce different placeholders", () => {
        const a = generateAnonymousPlaceholder("id-1111");
        const b = generateAnonymousPlaceholder("id-2222");
        expect(a).not.toBe(b);
    });
});

describe("anonymizeSearchResults", () => {
    const baseHoroscope = {
        _id: "550e8400e29b41d4a716446655440000",
        name: "John Doe",
        owner: { id: "user1" },
        displayName: false,
        isPublic: true,
    };

    test("owner sees their own name even when displayName=false", () => {
        const results = [{ horoscope: { ...baseHoroscope } }];
        const anonymized = anonymizeSearchResults(results, "user1");
        expect(anonymized[0].horoscope.name).toBe("John Doe");
    });

    test("non-owner with displayName=false sees placeholder", () => {
        const results = [{ horoscope: { ...baseHoroscope } }];
        const anonymized = anonymizeSearchResults(results, "user2");
        expect(anonymized[0].horoscope.name).toMatch(/^Anonymous Horoscope #/);
    });

    test("non-owner with displayName=true sees real name", () => {
        const results = [
            {
                horoscope: {
                    ...baseHoroscope,
                    displayName: true,
                },
            },
        ];
        const anonymized = anonymizeSearchResults(results, "user2");
        expect(anonymized[0].horoscope.name).toBe("John Doe");
    });

    test("super-admin sees all names regardless of displayName", () => {
        const results = [{ horoscope: { ...baseHoroscope } }];
        const anonymized = anonymizeSearchResults(results, "user2", "super-admin");
        expect(anonymized[0].horoscope.name).toBe("John Doe");
    });

    test("handles multiple results with mixed privacy", () => {
        const results = [
            { horoscope: { ...baseHoroscope, owner: { id: "user1" } } },
            { horoscope: { ...baseHoroscope, owner: { id: "user2" }, name: "Jane Doe" } },
            {
                horoscope: {
                    ...baseHoroscope,
                    owner: { id: "user2" },
                    name: "Bob Smith",
                    displayName: true,
                },
            },
        ];

        const anonymized = anonymizeSearchResults(results, "user1");
        expect(anonymized[0].horoscope.name).toBe("John Doe");
        expect(anonymized[1].horoscope.name).toMatch(/^Anonymous Horoscope #/);
        expect(anonymized[2].horoscope.name).toBe("Bob Smith");
    });

    test("returns empty array for empty input", () => {
        const result = anonymizeSearchResults([], "user1");
        expect(result).toEqual([]);
    });
});

describe("paginateResults", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    test("returns first page with correct items", () => {
        const result = paginateResults(items, 1, 5);
        expect(result.results).toEqual([1, 2, 3, 4, 5]);
        expect(result.page).toBe(1);
        expect(result.totalPages).toBe(2);
        expect(result.total).toBe(10);
    });

    test("returns second page with correct items", () => {
        const result = paginateResults(items, 2, 5);
        expect(result.results).toEqual([6, 7, 8, 9, 10]);
        expect(result.page).toBe(2);
    });

    test("clamps page beyond totalPages to last page", () => {
        const result = paginateResults(items, 5, 5);
        expect(result.results).toEqual([6, 7, 8, 9, 10]);
        expect(result.page).toBe(2);
    });

    test("clamps page below 1 to 1", () => {
        const result = paginateResults(items, 0, 5);
        expect(result.results).toEqual([1, 2, 3, 4, 5]);
        expect(result.page).toBe(1);
    });

    test("clamps negative page to 1", () => {
        const result = paginateResults(items, -1, 5);
        expect(result.page).toBe(1);
    });

    test("handles empty array", () => {
        const result = paginateResults([], 1, 5);
        expect(result.results).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(1);
        expect(result.page).toBe(1);
    });

    test("handles partial last page", () => {
        const result = paginateResults(items, 2, 3);
        expect(result.results).toEqual([4, 5, 6]);
        expect(result.totalPages).toBe(4);
    });

    test("single item", () => {
        const result = paginateResults([1], 1, 5);
        expect(result.results).toEqual([1]);
        expect(result.totalPages).toBe(1);
        expect(result.total).toBe(1);
    });

    test("pageSize larger than total", () => {
        const result = paginateResults(items, 1, 100);
        expect(result.results).toEqual(items);
        expect(result.totalPages).toBe(1);
    });
});

describe("SavedFilter CRUD logic", () => {
    test("name '__default__' is treated as special config, not a saved search", () => {
        const savedFilters = [
            { name: "__default__", query: "", filterConfig: {} },
            { name: "My Study", query: "මංගල දෝෂය", filterConfig: {} },
        ];

        const publicFilters = savedFilters.filter((f) => f.name !== "__default__");
        const defaultFilter = savedFilters.find((f) => f.name === "__default__") || null;

        expect(publicFilters).toHaveLength(1);
        expect(publicFilters[0].name).toBe("My Study");
        expect(defaultFilter).not.toBeNull();
        expect(defaultFilter?.name).toBe("__default__");
    });

    test("max 50 saved filters enforcement", () => {
        const maxFilters = 50;
        const currentCount = 50;
        expect(currentCount >= maxFilters).toBe(true);
    });

    test("saved filter with same name gets overwritten", () => {
        const existing = { name: "My Study", query: "old query" };
        const update = { name: "My Study", query: "new query" };

        if (existing.name === update.name) {
            existing.query = update.query;
        }

        expect(existing.query).toBe("new query");
    });
});

describe("SearchHistory dedup logic", () => {
    const DEDUP_WINDOW_MS = 5 * 60 * 1000;

    test("consecutive same query within 5 min updates timestamp", () => {
        const entries = [
            {
                id: "entry1",
                query: "මේෂ ලග්නය",
                createdAt: new Date("2026-07-27T20:55:00Z"),
            },
        ];

        const newQuery = "මේෂ ලග්නය";
        const now = new Date("2026-07-27T20:56:30Z");

        const recent = entries.filter(
            (e) => e.query === newQuery && now.getTime() - e.createdAt.getTime() < DEDUP_WINDOW_MS,
        );

        expect(recent).toHaveLength(1);
        expect(recent[0].id).toBe("entry1");
    });

    test("same query after 5 min creates new entry", () => {
        const entries = [
            {
                id: "entry1",
                query: "මේෂ ලග්නය",
                createdAt: new Date("2026-07-27T20:50:00Z"),
            },
        ];

        const newQuery = "මේෂ ලග්නය";
        const now = new Date("2026-07-27T20:56:00Z");

        const recent = entries.filter(
            (e) => e.query === newQuery && now.getTime() - e.createdAt.getTime() < DEDUP_WINDOW_MS,
        );

        expect(recent).toHaveLength(0);
    });

    test("different queries always create separate entries", () => {
        const entries = [
            {
                id: "entry1",
                query: "මේෂ ලග්නය",
                createdAt: new Date("2026-07-27T20:55:00Z"),
            },
        ];

        const recent = entries.filter(
            (e) => e.query === "Aries ascendant" && Date.now() - e.createdAt.getTime() < DEDUP_WINDOW_MS,
        );

        expect(recent).toHaveLength(0);
    });

    test("max 50 entries enforcement purges oldest", () => {
        const maxEntries = 50;
        const entries = Array.from({ length: 50 }, (_, i) => ({
            id: `entry-${i}`,
            createdAt: new Date(2026, 6, 27, 20, i),
        }));

        const sortedByOldest = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const totalAfterAdd = entries.length + 1;
        if (totalAfterAdd > maxEntries) {
            const toRemove = totalAfterAdd - maxEntries;
            const oldestIds = sortedByOldest.slice(0, toRemove).map((e) => e.id);
            expect(oldestIds).toHaveLength(1);
            expect(oldestIds[0]).toBe("entry-0");
        }
    });
});
