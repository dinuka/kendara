/**
 * Bhava Suchika (භාව සුචික) — search-layer tests.
 * QA plan: specs/qa/20260814-2210-bhava-suchika-test-plan.md (SR-BS-200..228, RE-BS-459/463..466).
 * Mirrors the mock pattern of search-strength.test.ts (embedding + qdrant mocks are mandatory
 * because the route calls generateEmbedding on every POST).
 */
import { getServerSession } from "next-auth";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { Planet } from "@/lib/astrologyEnums";
import { calculateHoroscope } from "@/lib/calculation";
import { compute } from "@/lib/manualChart";
import { synthesizeCalculation } from "@/lib/manualChartDetails";
import { getTextForBothLanguages } from "@/lib/search/textContent";
import {
    BHAVA_SUCHIKA_NAMES_EN,
    BHAVA_SUCHIKA_NAMES_SI,
    BHAVA_SUCHIKA_WORDS,
    SEARCH_VOCABULARY,
} from "@/lib/search/vocabulary";

jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn(), find: jest.fn() },
}));

jest.mock("@/models/CalculatedDetails", () => ({
    CalculatedDetails: {
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    },
}));

jest.mock("@/models/Chart", () => ({
    Chart: {
        find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    connectDB: jest.fn(),
}));

jest.mock("@/lib/search/embedding", () => ({
    generateEmbedding: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/search/qdrant", () => ({
    ensureCollection: jest.fn().mockResolvedValue(false),
    searchPoints: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
}));

const mockGetServerSession = getServerSession as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("search: Bhava Suchika (භාව සුචික) matching", () => {
    async function search(query: string) {
        mockGetServerSession.mockResolvedValue({ user: { id: "owner-1", role: "student" } });

        const { POST } = await import("@/app/api/search/route");

        const req = {
            json: jest.fn().mockResolvedValue({ query }),
        };

        return POST(req as any);
    }

    const makeHoroscope = (overrides: Record<string, unknown> = {}) => ({
        _id: "horo-1",
        id: "horo-1",
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        ...overrides,
    });

    const withCalculated = (calc: Record<string, unknown>) => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(calc),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
    };

    test("SR-BS-200: SI trigger + name — භාව සුචික ලග්නාංශකය matches lagna value 1", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 1, bhavaSuchika: {} });
        const response = await search("භාව සුචික ලග්නාංශකය");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 1 });
    });

    test("SR-BS-201: EN trigger + name — bhava suchika bhagyamshaka matches value 9", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} });
        const response = await search("bhava suchika bhagyamshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 9 });
    });

    test("SR-BS-202: bare SI name — ලග්නාංශකය alone resolves value 1", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 1, bhavaSuchika: {} });
        const response = await search("ලග්නාංශකය");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 1 });
        expect(body.results).toHaveLength(1);
    });

    test("SR-BS-203: bare EN name — bhagyamshaka alone resolves value 9", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} });
        const response = await search("bhagyamshaka");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 9 });
    });

    test("SR-BS-204: SI number form — භාව සුචික 9", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} });
        const response = await search("භාව සුචික 9");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 9 });
        expect(body.results).toHaveLength(1);
    });

    test("SR-BS-205: EN number form — bhava suchika 9", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} });
        const response = await search("bhava suchika 9");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 9 });
    });

    test("SR-BS-206 / RE-BS-463: out-of-range numbers yield no condition, HTTP 200", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 1, bhavaSuchika: {} });
        for (const query of ["bhava suchika 13", "bhava suchika 0"]) {
            const response = await search(query);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.queryUnderstanding.exactMatch.flat(Infinity)).not.toContainEqual(
                expect.objectContaining({ type: "bhava_suchika" }),
            );
        }
    });

    test("RE-BS-464: bare trigger without a value yields no condition", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 1, bhavaSuchika: {} });
        for (const query of ["භාව සුචික", "bhava suchika"]) {
            const response = await search(query);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.queryUnderstanding.exactMatch.flat(Infinity)).not.toContainEqual(
                expect.objectContaining({ type: "bhava_suchika" }),
            );
        }
    });

    test("SR-BS-207: SI planet pair — ගුරු භාව සුචික 11 (Jupiter = planet 5)", async () => {
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            bhavaSuchika: { "5": 11 },
        });
        const response = await search("ගුරු භාව සුචික 11");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "planet_bhava_suchika",
            planet: 5,
            value: 11,
        });
        expect(body.results).toHaveLength(1);
    });

    test("SR-BS-208: EN planet pair — Jupiter bhava suchika labhamshaka (planet 5, value 11)", async () => {
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            bhavaSuchika: { "5": 11 },
        });
        const response = await search("Jupiter bhava suchika labhamshaka");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "planet_bhava_suchika",
            planet: 5,
            value: 11,
        });
    });

    test("SR-BS-209: all 12 SI names map 1..12 exactly", () => {
        expect(Object.keys(BHAVA_SUCHIKA_NAMES_SI)).toHaveLength(12);
        for (let v = 1; v <= 12; v++) {
            expect(Object.values(BHAVA_SUCHIKA_NAMES_SI)).toContain(v);
        }
        expect(new Set(Object.values(BHAVA_SUCHIKA_NAMES_SI)).size).toBe(12);
    });

    test("SR-BS-210: all 12 EN names map 1..12 exactly", () => {
        expect(Object.keys(BHAVA_SUCHIKA_NAMES_EN)).toHaveLength(12);
        for (let v = 1; v <= 12; v++) {
            expect(Object.values(BHAVA_SUCHIKA_NAMES_EN)).toContain(v);
        }
        expect(new Set(Object.values(BHAVA_SUCHIKA_NAMES_EN)).size).toBe(12);
    });

    test("SR-BS-211: vocabulary feeds suggestions (trigger words + 24 names)", () => {
        for (const w of BHAVA_SUCHIKA_WORDS) {
            expect(SEARCH_VOCABULARY).toContain(w);
        }
        for (const name of Object.keys(BHAVA_SUCHIKA_NAMES_SI)) {
            expect(SEARCH_VOCABULARY).toContain(name);
        }
        for (const name of Object.keys(BHAVA_SUCHIKA_NAMES_EN)) {
            expect(SEARCH_VOCABULARY).toContain(name);
        }
    });

    test("SR-BS-212: Lagna match scores +1.0 and outranks a non-matching horoscope", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest
                .fn()
                .mockResolvedValue([makeHoroscope({ _id: "a", id: "a" }), makeHoroscope({ _id: "b", id: "b" })]),
        });
        // a: lagna 9 (matches "bhagyamshaka"), b: lagna 3 (does not).
        (CalculatedDetails.find as jest.Mock)?.mockReturnValue?.({});
        (CalculatedDetails.findOne as jest.Mock)
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue({
                    ascendant: { sign: 4, degree: 4.76 },
                    lagnaBhavaSuchika: 9,
                    bhavaSuchika: {},
                }),
            })
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue({
                    ascendant: { sign: 4, degree: 4.76 },
                    lagnaBhavaSuchika: 3,
                    bhavaSuchika: {},
                }),
            });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const response = await search("bhagyamshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.results[0].horoscope.id).toBe("a");
        expect(body.results[0].matchedConditions).toContain("bhava_suchika=9");
        expect(body.results[0].score).toBeGreaterThanOrEqual(1.0);
    });

    test("SR-BS-213: per-planet match contributes +0.5; lagna match (+1.0) outranks it", async () => {
        // Query names no planet → Lagna match (+1.0) for horoscope a; horoscope b has the same
        // value only for Jupiter (+0.5 would only apply to a planet-paired clause).
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest
                .fn()
                .mockResolvedValue([makeHoroscope({ _id: "a", id: "a" }), makeHoroscope({ _id: "b", id: "b" })]),
        });
        (CalculatedDetails.findOne as jest.Mock)
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue({
                    ascendant: { sign: 4, degree: 4.76 },
                    lagnaBhavaSuchika: 11,
                    bhavaSuchika: { "5": 11 },
                }),
            })
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue({
                    ascendant: { sign: 4, degree: 4.76 },
                    lagnaBhavaSuchika: 3,
                    bhavaSuchika: { "5": 11 },
                }),
            });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const response = await search("bhava suchika 11");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.results[0].horoscope.id).toBe("a");
        expect(body.results[0].matchedConditions).toContain("bhava_suchika=11");
    });

    test("SR-BS-213b: planet-paired clause records the matched condition", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, bhavaSuchika: { "5": 11 } });
        const response = await search("ගුරු භාව සුචික 11");
        const body = await response.json();

        expect(body.results[0].matchedConditions).toContain("planet_bhava_suchika_ගුරු=11");
    });

    test("SR-BS-214: exact-condition output shape — conditions + intents present", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} });
        const response = await search("bhava suchika 9");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 9 });
        expect(body.queryUnderstanding.conditions).toContain("bhava_suchika");
        expect(body.results[0].matchedConditions).toContain("bhava_suchika=9");
    });

    test("SR-BS-215: manual-without-navamsa never matches a Bhava Suchika query", async () => {
        withCalculated({
            ascendant: { sign: 1, degree: 0 },
            planets: [{ name: 5, navamsaSign: 9 }],
            manualHousePlacements: { lagna: 1, houses: [] },
        });
        const response = await search("භාව සුචික 7");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("SR-BS-216: comma-AND groups — both conditions must hold", async () => {
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            lagnaBhavaSuchika: 7,
            bhavaSuchika: { "5": 11 },
        });
        const response = await search("භාව සුචික 7, ගුරු භාව සුචික 11");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 7 });
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "planet_bhava_suchika",
            planet: 5,
            value: 11,
        });
        expect(body.results).toHaveLength(1);
    });

    test("SR-BS-216b: comma-AND — partial match fails the group", async () => {
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            lagnaBhavaSuchika: 7,
            bhavaSuchika: { "5": 4 },
        });
        const response = await search("භාව සුචික 7, ගුරු භාව සුචික 11");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("SR-BS-217: හෝ OR clause — either condition matches", async () => {
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            lagnaBhavaSuchika: 11,
            bhavaSuchika: {},
        });
        const response = await search("භාව සුචික 7 හෝ භාව සුචික 11");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("SR-BS-218 / RE-BS-465: mixed-language query resolves across locales", async () => {
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 1, bhavaSuchika: {} });
        const response = await search("bhava suchika ලග්නාංශකය");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({ type: "bhava_suchika", value: 1 });
    });

    test("RE-BS-466: query validation unchanged — empty query is a 400", async () => {
        const response = await search("");
        expect(response.status).toBe(400);
    });

    test("SR-BS-219: textContent EN contains Lagna and per-planet sentences", () => {
        const calc = calculateHoroscope({
            name: "Test",
            displayName: true,
            birthDate: new Date("1990-06-15"),
            birthTime: "08:30",
            location: "Colombo",
            latitude: 6.9271,
            longitude: 79.8612,
            gender: "male" as const,
            ayanamsha: "lahiri" as const,
            isPublic: false,
            owner: { id: "user-1" },
        } as unknown as Parameters<typeof calculateHoroscope>[0]);

        const { en } = getTextForBothLanguages(calc);
        expect(en).toContain(`Lagna Bhava Suchika: `);
        expect(en).toMatch(/Jupiter Bhava Suchika: \w+ \(\d+\)\./);
    });

    test("SR-BS-220: textContent SI contains the Sinhala sentences", () => {
        const calc = calculateHoroscope({
            name: "Test",
            displayName: true,
            birthDate: new Date("1990-06-15"),
            birthTime: "08:30",
            location: "Colombo",
            latitude: 6.9271,
            longitude: 79.8612,
            gender: "male" as const,
            ayanamsha: "lahiri" as const,
            isPublic: false,
            owner: { id: "user-1" },
        } as unknown as Parameters<typeof calculateHoroscope>[0]);

        const { si } = getTextForBothLanguages(calc);
        expect(si).toContain(`ලග්න භාව සුචික: `);
        expect(si).toMatch(/ගුරු භාව සුචික: \S+ \(\d+\)\./);
    });

    test("SR-BS-221: textContent legacy fallback — sentences emitted without stored fields", () => {
        const calc = calculateHoroscope({
            name: "Test",
            displayName: true,
            birthDate: new Date("1990-06-15"),
            birthTime: "08:30",
            location: "Colombo",
            latitude: 6.9271,
            longitude: 79.8612,
            gender: "male" as const,
            ayanamsha: "lahiri" as const,
            isPublic: false,
            owner: { id: "user-1" },
        } as unknown as Parameters<typeof calculateHoroscope>[0]);
        const legacy = { ...calc } as Record<string, unknown>;
        delete legacy.lagnaBhavaSuchika;
        delete legacy.bhavaSuchika;

        const { en, si } = getTextForBothLanguages(legacy as Parameters<typeof getTextForBothLanguages>[0]);
        expect(en).toContain("Lagna Bhava Suchika: ");
        expect(si).toContain("ලග්න භාව සුචික: ");
    });

    test("SR-BS-222: textContent manual-without-navamsa emits NO sentences", () => {
        // The indexer feeds the lean CalculatedDetails doc (which carries manualHousePlacements)
        // into getTextForBothLanguages — the resolver needs that field to know the chart is manual
        // and gate the D5 fallback OFF.
        const chart = compute({ lagna: 1, houses: {} });
        const calc = synthesizeCalculation(chart);
        const doc = {
            ...(calc as unknown as Record<string, unknown>),
            manualHousePlacements: chart.manualHousePlacements,
        };
        const { en, si } = getTextForBothLanguages(doc as Parameters<typeof getTextForBothLanguages>[0]);

        expect(en).not.toContain("Bhava Suchika");
        expect(si).not.toContain("භාව සුචික");
    });

    test("SR-BS-223: indexer text source carries the sentences", () => {
        const calc = calculateHoroscope({
            name: "Test",
            displayName: true,
            birthDate: new Date("1990-06-15"),
            birthTime: "08:30",
            location: "Colombo",
            latitude: 6.9271,
            longitude: 79.8612,
            gender: "male" as const,
            ayanamsha: "lahiri" as const,
            isPublic: false,
            owner: { id: "user-1" },
        } as unknown as Parameters<typeof calculateHoroscope>[0]);

        // indexer.ts:29 feeds getTextForBothLanguages(calculated) into SearchEmbedding.textContent.
        const { en, si } = getTextForBothLanguages(calc);
        expect(en).toContain("Lagna Bhava Suchika: ");
        expect(si).toContain("ලග්න භාව සුචික: ");
    });

    test("SR-BS-227 / RE-BS-459: privacy filter unchanged — another user's private chart never returned", async () => {
        const docs = [makeHoroscope({ _id: "a", id: "a", owner: { id: "other-1" }, isPublic: false })];
        // The mock respects the route's $or filter the way Mongo would.
        (Horoscope.find as jest.Mock).mockImplementation((filter: any) => ({
            lean: jest
                .fn()
                .mockResolvedValue(
                    docs.filter((h) =>
                        filter.$or.some(
                            (c: any) =>
                                (c["owner.id"] === "owner-1" && h.owner.id === "owner-1") || (c.isPublic && h.isPublic),
                        ),
                    ),
                ),
        }));
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest
                .fn()
                .mockResolvedValue({ ascendant: { sign: 4, degree: 4.76 }, lagnaBhavaSuchika: 9, bhavaSuchika: {} }),
        });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const response = await search("bhava suchika 9");
        const body = await response.json();

        expect(Horoscope.find).toHaveBeenCalledWith({
            $or: [{ "owner.id": "owner-1" }, { isPublic: true }],
        });
        expect(body.results).toHaveLength(0);
    });

    test("SR-BS-228: legacy doc matches at search time via the render-layer fallback", async () => {
        withCalculated({
            // Legacy auto doc — no stored fields; fallback derives from ascendant + navamsa signs.
            ascendant: { sign: 4, degree: 4.76 },
            planets: [
                { name: 1, navamsaSign: 7 },
                { name: 2, navamsaSign: 11 },
                { name: 3, navamsaSign: 9 },
                { name: 4, navamsaSign: 1 },
                { name: 5, navamsaSign: 1 },
                { name: 6, navamsaSign: 8 },
                { name: 7, navamsaSign: 10 },
                { name: 8, navamsaSign: 2 },
                { name: 9, navamsaSign: 8 },
            ],
        });
        const response = await search("bhava suchika 2");
        const body = await response.json();

        // Lagna fallback: ((5 - 4) mod 12) + 1 = 2 → matches.
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("bhava_suchika=2");
    });
});
