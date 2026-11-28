import { getServerSession } from "next-auth";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

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

describe("search: combined exact conditions (AND logic)", () => {
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
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        ...overrides,
    });

    test("මේෂ ලග්නය කුජ ලග්නයේයේ matches only when BOTH Mesha lagna and Mars in 1st house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: [{ name: 3, house: 1, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("මේෂ ලග්නය කුජ ලග්නයේයේ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_multiple");
        expect(body.queryUnderstanding.exactMatch).toEqual([
            { type: "ascendant", sign: 1 },
            { type: "planet_in_house", planet: 3, house: 1 },
        ]);
    });

    test("මේෂ ලග්නය කුජ ලග්නයේයේ rejects horoscope with Mesha lagna but Mars NOT in 1st house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: [{ name: 3, house: 7, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("මේෂ ලග්නය කුජ ලග්නයේයේ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("මේෂ ලග්නය කුජ ලග්නයේයේ rejects horoscope with Mars in 1st house but NOT Mesha lagna", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 5 },
                planets: [{ name: 3, house: 1, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("මේෂ ලග්නය කුජ ලග්නයේයේ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("කුජ ලග්නයේ alone still uses single exact_planet_in_house mode", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: [{ name: 3, house: 1, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ ලග්නයේ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_in_house");
    });

    test("මේෂ ලග්නය කුජ 10 matches Mesha lagna with Mars in 10th house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: [{ name: 3, house: 10, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("මේෂ ලග්නය කුජ 10");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_multiple");
        expect(body.queryUnderstanding.exactMatch).toEqual([
            { type: "ascendant", sign: 1 },
            { type: "planet_in_house", planet: 3, house: 10 },
        ]);
    });

    test("මේෂ ලග්නය කුජ 10 rejects horoscope with Mars NOT in 10th house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: [{ name: 3, house: 7, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("මේෂ ලග්නය කුජ 10");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("සිංහ ලග්නය ගුරු 3 matches Leo lagna with Jupiter in 3rd house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 5 },
                planets: [{ name: 5, house: 3, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("සිංහ ලග්නය ගුරු 3");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch).toEqual([
            { type: "ascendant", sign: 5 },
            { type: "planet_in_house", planet: 5, house: 3 },
        ]);
    });

    test("වෘෂභ ලග්නය ශුක්ර 7 matches Taurus lagna with Venus in 7th house", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 2 },
                planets: [{ name: 6, house: 7, strength: "Sama" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("වෘෂභ ලග්නය ශුක්ර 7");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch).toEqual([
            { type: "ascendant", sign: 2 },
            { type: "planet_in_house", planet: 6, house: 7 },
        ]);
    });
});

describe("search: planet_in_house uses the whole-sign Rashi house", () => {
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
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        ...overrides,
    });

    // Aries ascendant. Mars is at Pisces 14:40:48 (absoluteDegree 344.68).
    // Stored whole-sign house is 12 (Pisces). The 12th-house cusp boundary ends at Pisces
    // 13:45:49 (13.7636°), but the house is always the planet's Rashi location (p.house = 12),
    // never the cusp-boundary range.
    const makeCalculatedDetails = () => {
        const h = (
            houseNumber: number,
            startSign: number,
            startDegree: number,
            endSign: number,
            endDegree: number,
        ) => ({
            houseNumber,
            startDegree,
            startSign,
            startLord: 0,
            middleDegree: startDegree,
            middleSign: startSign,
            middleLord: 0,
            endDegree,
            endSign,
            endLord: 0,
            sign: startSign,
            lord: 0,
        });

        return {
            ascendant: { sign: 1 },
            houses: [
                h(1, 12, 13.7636, 1, 13),
                h(2, 1, 13, 2, 15),
                h(3, 2, 15, 3, 17),
                h(4, 3, 17, 4, 19),
                h(5, 4, 19, 5, 21),
                h(6, 5, 21, 6, 23),
                h(7, 6, 23, 7, 25),
                h(8, 7, 25, 8, 27),
                h(9, 8, 27, 9, 29),
                h(10, 9, 29, 10, 31),
                h(11, 10, 1, 11, 3),
                h(12, 11, 3, 12, 13.7636),
            ],
            planets: [{ name: 3, sign: 12, degree: 14.68, absoluteDegree: 344.68, house: 12, strength: "Sama" }],
        };
    };

    test("කුජ 1 does NOT match when whole-sign house is 12", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(makeCalculatedDetails()),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ 1");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("කුජ 12 matches when whole-sign house is 12 even though the cusp boundary ends earlier", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(makeCalculatedDetails()),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ 12");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_in_house");
    });
});

describe("search: combined planet-strength conditions (AND logic)", () => {
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
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        ...overrides,
    });

    test("කුජ උච්ච සඳු නීච matches only when Mars exalted AND Moon debilitated", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [
                    { name: 3, strength: "Uchcha" },
                    { name: 2, strength: "Neecha" },
                ],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ උච්ච සඳු නීච");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_multiple");
        expect(body.queryUnderstanding.exactMatch).toEqual([
            { type: "planet_strength", planet: 3, strength: 1 },
            { type: "planet_strength", planet: 2, strength: -1 },
        ]);
    });

    test("කුජ උච්ච සඳු නීච rejects when Moon is NOT debilitated", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [
                    { name: 3, strength: "Uchcha" },
                    { name: 2, strength: "Sama" },
                ],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ උච්ච සඳු නීච");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("කුජ උච්ච සඳු නීච rejects when Mars is NOT exalted", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [
                    { name: 3, strength: "Sama" },
                    { name: 2, strength: "Neecha" },
                ],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ උච්ච සඳු නීච");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("කුජ උච්ච alone still yields a single exact_planet_strength", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [{ name: 3, strength: "Uchcha" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("කුජ උච්ච");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_strength");
        expect(body.queryUnderstanding.exactMatch).toEqual([{ type: "planet_strength", planet: 3, strength: 1 }]);
    });
});
