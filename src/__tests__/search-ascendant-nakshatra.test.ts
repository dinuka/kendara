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

describe("search: lagna nakshatra (e.g. ලග්න නැකත අස්ලිස = Ascendant's nakshatra is Ashlesha)", () => {
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

    const ashlesha = { id: 9 };
    const punarvasu = { id: 7 };

    test("ලග්න නැකත අස්ලිස matches only when the ASCENDANT's nakshatra is Ashlesha", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: punarvasu, ascendantNakshatra: ashlesha },
        });

        const response = await search("ලග්න නැකත අස්ලිස");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_ascendant_nakshatra");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "ascendant_nakshatra", nakshatra: 9 }]]]);
    });

    test("ලග්න නැකත අස්ලිස rejects when the MOON's nakshatra is Ashlesha but the ascendant's is not", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: ashlesha, ascendantNakshatra: punarvasu },
        });

        const response = await search("ලග්න නැකත අස්ලිස");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("ලග්න නැකත අස්ලිස rejects when neither nakshatra is Ashlesha", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: punarvasu, ascendantNakshatra: punarvasu },
        });

        const response = await search("ලග්න නැකත අස්ලිස");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("ascendant nakshatra ashlesha (English) matches the ascendant's nakshatra", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: punarvasu, ascendantNakshatra: ashlesha },
        });

        const response = await search("ascendant nakshatra ashlesha");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_ascendant_nakshatra");
    });

    test("නැකත අස්ලිස without an ascendant word still means the MOON's nakshatra", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: ashlesha, ascendantNakshatra: punarvasu },
        });

        const response = await search("නැකත අස්ලිස");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_nakshatra");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "nakshatra", nakshatra: 9 }]]]);
    });

    test("නැකත අස්ලිස rejects when only the ascendant's nakshatra is Ashlesha", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            nakshatra: { moonNakshatra: punarvasu, ascendantNakshatra: ashlesha },
        });

        const response = await search("නැකත අස්ලිස");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });
});
