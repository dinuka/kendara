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
describe("search: a house lord placed in a house (e.g. 1 අධිපති 12, ලග්නාධිපති 12)", () => {
    const search = async (query: string) => {
        mockGetServerSession.mockResolvedValue({ user: { id: "owner-1", role: "student" } });
        const { POST } = await import("@/app/api/search/route");
        const response = await POST({ json: jest.fn().mockResolvedValue({ query }) } as any);
        return response.json();
    };

    const mockSingle = (ascendant: number, planets: Array<{ name: number; house: number }>) => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest
                .fn()
                .mockResolvedValue([
                    { _id: "horo-1", name: "John Doe", owner: { id: "owner-1" }, displayName: true, isPublic: true },
                ]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: ascendant },
                planets: planets.map((p) => ({ ...p, sign: ((ascendant + p.house - 2) % 12) + 1 })),
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    };

    const lordship = (house: number, inHouse: number) => [[[{ type: "house_lord_in_house", house, inHouse }]]];

    test("numbered and named forms parse to the same condition", async () => {
        mockSingle(1, []);
        for (const query of ["1 අධිපති 12", "ලග්නාධිපති 12", "1 වන භාවාධිපති 12 වැනි භාවයේ", "ලග්නයේ අධිපති 12"]) {
            expect((await search(query)).queryUnderstanding.exactMatch).toEqual(lordship(1, 12));
        }
        for (const query of ["4 අධිපති 1", "සුඛස්ථානාධිපති 1", "සුඛාධිපති 1", "4th lord in 1st house"]) {
            expect((await search(query)).queryUnderstanding.exactMatch).toEqual(lordship(4, 1));
        }
        expect((await search("lord of the 10th house in 7th")).queryUnderstanding.exactMatch).toEqual(lordship(10, 7));
        expect((await search("ධනාධිපති 11")).queryUnderstanding.exactMatch).toEqual(lordship(2, 11));
        expect((await search("ව්‍යයස්ථානාධිපති 6")).queryUnderstanding.exactMatch).toEqual(lordship(12, 6));
    });

    test("ලග්නාධිපති 12 matches a Mesha lagna with Mars in the 12th, not in the 11th", async () => {
        mockSingle(1, [{ name: 3, house: 12 }]);
        expect((await search("ලග්නාධිපති 12")).results).toHaveLength(1);

        mockSingle(1, [{ name: 3, house: 11 }]);
        expect((await search("ලග්නාධිපති 12")).results).toHaveLength(0);
    });

    test("the lord follows the ascendant: 4 අධිපති 1 is Jupiter for a Dhanu lagna", async () => {
        mockSingle(9, [{ name: 5, house: 1 }]);
        expect((await search("4 අධිපති 1")).results).toHaveLength(1);
        expect((await search("සුඛස්ථානාධිපති 1")).results).toHaveLength(1);

        mockSingle(9, [{ name: 3, house: 1 }]);
        expect((await search("4 අධිපති 1")).results).toHaveLength(0);
    });

    test("does not demand Dhana yoga or a lagna sign, and combines with other conditions", async () => {
        mockSingle(1, [
            { name: 6, house: 11 },
            { name: 3, house: 10 },
        ]);
        expect((await search("ධනාධිපති 11")).results).toHaveLength(1);

        const body = await search("ලග්නාධිපති 10, ධනාධිපති 11");
        expect(body.queryUnderstanding.exactMatch).toEqual([
            [[{ type: "house_lord_in_house", house: 1, inHouse: 10 }]],
            [[{ type: "house_lord_in_house", house: 2, inHouse: 11 }]],
        ]);
        expect(body.results).toHaveLength(1);
    });
});
