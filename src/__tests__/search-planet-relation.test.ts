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
describe("search: planet counted from another planet (e.g. රවි සඳුගෙන් 6 වැන්නේ)", () => {
    const search = async (query: string) => {
        mockGetServerSession.mockResolvedValue({ user: { id: "owner-1", role: "student" } });
        const { POST } = await import("@/app/api/search/route");
        const response = await POST({ json: jest.fn().mockResolvedValue({ query }) } as any);
        return response.json();
    };

    const mockSingle = (planets: Array<{ name: number; sign: number }>) => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest
                .fn()
                .mockResolvedValue([
                    { _id: "horo-1", name: "John Doe", owner: { id: "owner-1" }, displayName: true, isPublic: true },
                ]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                planets: planets.map((p) => ({ ...p, house: p.sign })),
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    };

    test("රවි සඳුගෙන් 6 වැන්නේ parses the Moon 6th from the Sun", async () => {
        mockSingle([
            { name: 2, sign: 3 },
            { name: 1, sign: 8 },
        ]);
        const body = await search("රවි සඳුගෙන් 6 වැන්නේ");

        expect(body.queryUnderstanding.exactMatch).toEqual([
            [[{ type: "planet_from_planet", planet: 2, from: 1, distance: 6 }]],
        ]);
        expect(body.results).toHaveLength(0);
    });

    test("රවි සඳුගෙන් 6 වැන්නේ matches the Moon 6th from the Sun, not the Moon 8th from it", async () => {
        mockSingle([
            { name: 1, sign: 3 },
            { name: 2, sign: 8 },
        ]);
        expect((await search("රවි සඳුගෙන් 6 වැන්නේ")).results).toHaveLength(1);

        mockSingle([
            { name: 1, sign: 8 },
            { name: 2, sign: 3 },
        ]);
        expect((await search("රවි සඳුගෙන් 6 වැන්නේ")).results).toHaveLength(0);
    });

    test("counting wraps past Pisces", async () => {
        mockSingle([
            { name: 3, sign: 10 },
            { name: 5, sign: 5 },
        ]);
        const body = await search("කුජ ගුරුගෙන් 8 වැන්නේ");

        expect(body.queryUnderstanding.exactMatch).toEqual([
            [[{ type: "planet_from_planet", planet: 5, from: 3, distance: 8 }]],
        ]);
        expect(body.results).toHaveLength(1);
    });

    test("rejects a chart where the planet is in a different house from the reference", async () => {
        mockSingle([
            { name: 3, sign: 10 },
            { name: 5, sign: 6 },
        ]);
        const body = await search("කුජ ගුරුගෙන් 8 වැන්නේ");

        expect(body.results).toHaveLength(0);
    });

    test("රාහු රවි සමග means Rahu in the same sign as the Sun", async () => {
        mockSingle([
            { name: 1, sign: 4 },
            { name: 8, sign: 4 },
        ]);
        const match = await search("රාහු රවි සමග");
        expect(match.queryUnderstanding.exactMatch).toEqual([
            [[{ type: "planet_from_planet", planet: 8, from: 1, distance: 1 }]],
        ]);
        expect(match.results).toHaveLength(1);

        mockSingle([
            { name: 1, sign: 4 },
            { name: 8, sign: 5 },
        ]);
        expect((await search("රාහු රවි සමඟ")).results).toHaveLength(0);
    });

    test("the count may come first, and English counts from the planet after 'from'", async () => {
        mockSingle([
            { name: 5, sign: 1 },
            { name: 3, sign: 8 },
        ]);
        expect((await search("කුජ 8 වැන්නේ ගුරුගෙන්")).queryUnderstanding.exactMatch).toEqual([
            [[{ type: "planet_from_planet", planet: 5, from: 3, distance: 8 }]],
        ]);

        const expected = [[[{ type: "planet_from_planet", planet: 3, from: 5, distance: 8 }]]];
        expect((await search("mars 8th from jupiter")).queryUnderstanding.exactMatch).toEqual(expected);
        expect((await search("mars 8th house from the jupiter")).queryUnderstanding.exactMatch).toEqual(expected);
    });

    test("combines with other conditions across comma groups", async () => {
        mockSingle([
            { name: 1, sign: 3 },
            { name: 2, sign: 8 },
            { name: 8, sign: 3 },
        ]);
        const body = await search("රවි සඳුගෙන් 6 වැන්නේ, රාහු රවි සමග");

        expect(body.results).toHaveLength(1);
    });
});
