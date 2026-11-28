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
describe("search: Parivartana yoga by name and by exchanged houses (e.g. 1 හා 4 පරිවර්තනය)", () => {
    const search = async (query: string) => {
        mockGetServerSession.mockResolvedValue({ user: { id: "owner-1", role: "student" } });
        const { POST } = await import("@/app/api/search/route");
        const response = await POST({ json: jest.fn().mockResolvedValue({ query }) } as any);
        return response.json();
    };

    // Planets not placed explicitly sit in their own signs, so they exchange with no one.
    const OWN_SIGNS: Record<number, number> = { 1: 5, 2: 4, 3: 1, 4: 3, 5: 9, 6: 2, 7: 10 };

    const mockSingle = (ascendant: number, placed: Record<number, number>) => {
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
                planets: Object.keys(OWN_SIGNS).map((key) => {
                    const name = Number(key);
                    const sign = placed[name] ?? OWN_SIGNS[name];
                    return {
                        name,
                        sign,
                        house: ((sign - ascendant + 12) % 12) + 1,
                        degree: 10,
                        absoluteDegree: (sign - 1) * 30 + 10,
                        aspects: [],
                    };
                }),
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    };

    const exchange = (house1: number, house2: number) => [[[{ type: "house_exchange", house1, house2 }]]];

    test("numbered and named house pairs parse to the same condition", async () => {
        mockSingle(1, {});
        for (const query of [
            "1 හා 4 පරිවර්තනය",
            "4 සහ 1 පරිවර්තනය",
            "ලග්නස්ථානය හා සුඛස්තාන පරිවර්තනය",
            "ලග්නස්ථානය හා සුඛස්ථානය පරිවර්තනය",
            "1st and 4th house exchange",
            "parivartana between 1 and 4",
        ]) {
            expect((await search(query)).queryUnderstanding.exactMatch).toEqual(exchange(1, 4));
        }
        expect((await search("ධනස්ථානය හා භාග්‍යස්ථානය පරිවර්තනය")).queryUnderstanding.exactMatch).toEqual(
            exchange(2, 9),
        );
    });

    test("4 හා 9 පරිවර්තනය matches the doc's Mithuna example, and not a chart without it", async () => {
        mockSingle(3, { 4: 11, 7: 6 });
        expect((await search("4 හා 9 පරිවර්තනය")).results).toHaveLength(1);
        expect((await search("සුඛස්ථානය හා භාග්‍යස්ථානය පරිවර්තනය")).results).toHaveLength(1);
        expect((await search("1 හා 4 පරිවර්තනය")).results).toHaveLength(0);

        mockSingle(3, {});
        expect((await search("4 හා 9 පරිවර්තනය")).results).toHaveLength(0);
    });

    test("පරිවර්තන යෝගය finds any type; මහා පරිවර්තන යෝගය finds only Maha", async () => {
        mockSingle(3, { 4: 11, 7: 6 });
        const any = await search("පරිවර්තන යෝගය");
        expect(any.queryUnderstanding.exactMatch).toEqual([[[{ type: "yoga_family", familyId: "parivartanaYoga" }]]]);
        expect(any.results).toHaveLength(1);

        const maha = await search("මහා පරිවර්තන යෝගය");
        expect(maha.queryUnderstanding.exactMatch).toEqual([[[{ type: "yoga_id", yogaId: "mahaParivartana" }]]]);
        expect(maha.results).toHaveLength(1);
        expect((await search("දෛන්‍ය පරිවර්තන යෝගය")).results).toHaveLength(0);

        // Mesha lagna, Mercury in Kumbha and Saturn in Kanya: a 6-11 Dainya exchange only.
        mockSingle(1, { 4: 11, 7: 6 });
        expect((await search("දෛන්‍ය පරිවර්තන යෝගය")).results).toHaveLength(1);
        expect((await search("මහා පරිවර්තන යෝගය")).results).toHaveLength(0);
        expect((await search("පරිවර්තන යෝගය")).results).toHaveLength(1);

        mockSingle(1, {});
        expect((await search("පරිවර්තන යෝගය")).results).toHaveLength(0);
    });

    test("ධනස්ථානය inside a house pair does not also demand Dhana yoga", async () => {
        const body = await search("ධනස්ථානය හා භාග්‍යස්ථානය පරිවර්තනය");
        expect(body.queryUnderstanding.exactMatch).toEqual(exchange(2, 9));
    });
});
