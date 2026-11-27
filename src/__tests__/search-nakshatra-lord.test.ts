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

describe("search: planet nakshatra lord (e.g. සඳගේ නැකත් අධිපති කුජ = Moon in a nakshatra of Mars)", () => {
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

    const mockSingle = (calculatedDetails: Record<string, unknown>) => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(calculatedDetails),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
    };

    // Mrigashira (5) is ruled by Mars; Rohini (4) is ruled by the Moon.
    const moonInMarsNakshatra = {
        nakshatra: { moonNakshatra: { id: 5, pada: 1 } },
        planets: [{ name: 2, sign: 8, nakshatra: 5 }],
    };
    const moonNotInMarsNakshatra = {
        nakshatra: { moonNakshatra: { id: 4, pada: 1 } },
        planets: [{ name: 2, sign: 4, nakshatra: 4 }],
    };

    test("සඳගේ නැකත් අධිපති කුජ matches when the Moon is in a Mars-ruled nakshatra", async () => {
        mockSingle(moonInMarsNakshatra);

        const response = await search("සඳගේ නැකත් අධිපති කුජ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_nakshatra_lord");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "planet_nakshatra_lord", planet: 2, lord: 3 }]]]);
    });

    test("සඳගේ නැකත් අධිපති කුජ rejects a Moon not in a Mars-ruled nakshatra", async () => {
        mockSingle(moonNotInMarsNakshatra);

        const response = await search("සඳගේ නැකත් අධිපති කුජ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("සඳ කුජගේ නැකතක (possessive form) matches the same Moon-in-Mars-nakshatra rule", async () => {
        mockSingle(moonInMarsNakshatra);

        const response = await search("සඳ කුජගේ නැකතක");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_nakshatra_lord");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "planet_nakshatra_lord", planet: 2, lord: 3 }]]]);
    });

    test("සඳ කුජගේ නැකතක does not misread නැකතක as a nakshatra name", async () => {
        mockSingle(moonNotInMarsNakshatra);

        const response = await search("සඳ කුජගේ නැකතක");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "planet_nakshatra_lord", planet: 2, lord: 3 }]]]);
        expect(body.queryUnderstanding.conditions).not.toContain("nakshatra:3");
    });

    test("moon nakshatra lord mars (English) matches", async () => {
        mockSingle(moonInMarsNakshatra);

        const response = await search("moon nakshatra lord mars");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_nakshatra_lord");
    });

    test("moon in mars's nakshatra (English possessive) matches", async () => {
        mockSingle(moonInMarsNakshatra);

        const response = await search("moon in mars's nakshatra");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("කුජගේ නැකත් අධිපති සඳ matches when MARS is in a Moon-ruled nakshatra", async () => {
        // Rohini (4) is ruled by the Moon (2).
        mockSingle({
            nakshatra: { moonNakshatra: { id: 1, pada: 1 } },
            planets: [{ name: 3, sign: 1, nakshatra: 4 }],
        });

        const response = await search("කුජගේ නැකත් අධිපති සඳ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "planet_nakshatra_lord", planet: 3, lord: 2 }]]]);
    });

    test("කුජගේ නැකත් අධිපති සඳ rejects when Mars is in a Moon-ruled nakshatra", async () => {
        // Ashwini (1) is ruled by Ketu (9).
        mockSingle({
            nakshatra: { moonNakshatra: { id: 1, pada: 1 } },
            planets: [{ name: 3, sign: 1, nakshatra: 1 }],
        });

        const response = await search("කුජගේ නැකත් අධිපති සඳ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("a nakshatra-name query with a single planet is unchanged", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: { id: 9, pada: 1 } },
            planets: [{ name: 2, sign: 8, nakshatra: 9 }],
        });

        const response = await search("නැකත අස්ලිය");
        const body = await response.json();

        expect(body.queryUnderstanding.mode).toBe("exact_nakshatra");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "nakshatra", nakshatra: 9 }]]]);
    });
});
