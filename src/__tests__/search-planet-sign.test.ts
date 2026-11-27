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

describe("search: planet in sign (e.g. සඳු වෘශ්චික = Moon in Scorpio)", () => {
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

    test("සඳු වෘශ්චික matches only when the Moon itself is in Scorpio", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [
                { name: 2, sign: 8, house: 2 },
                { name: 3, sign: 8, house: 2 },
            ],
        });

        const response = await search("සඳු වෘශ්චික");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_in_sign");
        expect(body.queryUnderstanding.exactMatch).toEqual([[[{ type: "planet_in_sign", planet: 2, sign: 8 }]]]);
    });

    test("සඳු වෘශ්චික rejects a horoscope whose Moon is NOT in Scorpio even when another planet is", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [
                { name: 2, sign: 4, house: 12 },
                { name: 3, sign: 8, house: 2 },
            ],
        });

        const response = await search("සඳු වෘශ්චික");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("සඳු වෘශ්චික rejects a Scorpio-ascendant horoscope when the Moon is not in Scorpio", async () => {
        mockSingle({
            ascendant: { sign: 8 },
            planets: [{ name: 2, sign: 4, house: 9 }],
        });

        const response = await search("සඳු වෘශ්චික");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("කුජ මේෂ matches only when Mars is in Aries (works for other planets)", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [{ name: 3, sign: 1, house: 9 }],
        });

        const response = await search("කුජ මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_in_sign");
    });

    test("කුජ මේෂ rejects when Mars is not in Aries", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [{ name: 3, sign: 8, house: 4 }],
        });

        const response = await search("කුජ මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("moon scorpio (English) matches when the Moon is in Scorpio", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [{ name: 2, sign: 8, house: 2 }],
        });

        const response = await search("moon scorpio");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("සඳු වෘශ්චික කුජ මේෂ matches only when Moon is in Scorpio AND Mars is in Aries", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [
                { name: 2, sign: 8, house: 4 },
                { name: 3, sign: 1, house: 9 },
            ],
        });

        const response = await search("සඳු වෘශ්චික කුජ මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch).toEqual([
            [
                [
                    { type: "planet_in_sign", planet: 2, sign: 8 },
                    { type: "planet_in_sign", planet: 3, sign: 1 },
                ],
            ],
        ]);
    });

    test("සඳු වෘශ්චික කුජ මේෂ rejects when only one of the two pairs holds", async () => {
        mockSingle({
            ascendant: { sign: 5 },
            planets: [
                { name: 2, sign: 8, house: 4 },
                { name: 3, sign: 8, house: 4 },
            ],
        });

        const response = await search("සඳු වෘශ්චික කුජ මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("සඳු වෘශ්චික ලග්නය still means Scorpio lagna with Moon in the 1st house, not Moon-in-Scorpio", async () => {
        mockSingle({
            ascendant: { sign: 8 },
            planets: [{ name: 2, sign: 8, house: 1 }],
        });

        const response = await search("සඳු වෘශ්චික ලග්නය");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch).toEqual([
            [
                [
                    { type: "ascendant", sign: 8 },
                    { type: "planet_in_house", planet: 2, house: 1 },
                ],
            ],
        ]);
    });
});
