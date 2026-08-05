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

describe("search: planet role (varga) matching", () => {
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

    test("බාධක බුධ matches only when Mercury (Budha) is a badhaka planet", async () => {
        mockSingle({ badhakaPlanet: [4] });
        const response = await search("බාධක බුධ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_role");
    });

    test("බාධක බුධ does not match when Mercury is not a badhaka planet", async () => {
        mockSingle({ badhakaPlanet: [6] });
        const response = await search("බාධක බුධ");
        const body = await response.json();
        expect(body.results).toHaveLength(0);
    });

    test("badaka planet is budha (English spelling variants) matches Mercury as badhaka", async () => {
        mockSingle({ badhakaPlanet: [4] });
        const response = await search("badaka planet is budha");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
    });

    test("22 derkana guru matches when Jupiter is the 22nd Drekkana lord", async () => {
        mockSingle({ lord22ndDrekkana: 5 });
        const response = await search("22 derkana guru");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_role");
    });

    test("22 derkana guru does not match when Jupiter is not the 22nd Drekkana lord", async () => {
        mockSingle({ lord22ndDrekkana: 4 });
        const response = await search("22 derkana guru");
        const body = await response.json();
        expect(body.results).toHaveLength(0);
    });

    test("නිධනාම්ශ ගුරු matches when Jupiter is a nidhanamsha planet", async () => {
        mockSingle({ nidhanamshaPlanets: [5] });
        const response = await search("නිධනාම්ශ ගුරු");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
    });

    test("ashtamansha presence-only matches when any ashtamansha planet exists", async () => {
        mockSingle({ ashtamanshaPlanets: [3] });
        const response = await search("ashtamansha");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("ashtamansha_present");
    });

    test("ashtamansha presence-only matches nothing when no ashtamansha planets exist", async () => {
        mockSingle({ ashtamanshaPlanets: [] });
        const response = await search("ashtamansha");
        const body = await response.json();
        expect(body.results).toHaveLength(0);
    });

    test("අෂ්ඨමාංශ කුජ matches only when Mars is an ashtamansha planet", async () => {
        mockSingle({ ashtamanshaPlanets: [3] });
        const response = await search("අෂ්ඨමාංශ කුජ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("ashtamansha=කුජ");
    });

    test("අස්ථමාංශ කුජ (colloquial Sinhala spelling) matches ashtamansha", async () => {
        mockSingle({ ashtamanshaPlanets: [3] });
        const response = await search("අස්ථමාංශ කුජ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("ashtamansha=කුජ");
    });

    test("bare '22nd drekkana lord' (no planet) matches when a drekkana lord exists", async () => {
        mockSingle({ lord22ndDrekkana: 5 });
        const response = await search("22nd drekkana lord");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("drekkana_present");
    });

    test("bare '64th navamsa lord' (no planet) matches when a navamsa lord exists", async () => {
        mockSingle({ lord64thNavamsa: 7 });
        const response = await search("64th navamsa lord");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("navamsa_present");
    });

    test("සිකුරු 22 වන ද්‍රැක්කාන matches when Venus is the 22nd Drekkana lord", async () => {
        mockSingle({ lord22ndDrekkana: 6 });
        const response = await search("සිකුරු 22 වන ද්‍රැක්කාන");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_role");
    });

    test("දෙර්කාණාධිපති ගුරු matches when Jupiter is the 22nd Drekkana lord", async () => {
        mockSingle({ lord22ndDrekkana: 5 });
        const response = await search("දෙර්කාණාධිපති ගුරු");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_role");
    });

    test("නවාංශකාධිපති ශනි matches when Saturn is the 64th Navamsa lord", async () => {
        mockSingle({ lord64thNavamsa: 7 });
        const response = await search("නවාංශකාධිපති ශනි");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.mode).toBe("exact_planet_role");
    });

    test("වර්ගෝත්තම බුධ matches when Mercury is a wargoththama planet", async () => {
        mockSingle({ wargoththamaPlanets: [4] });
        const response = await search("වර්ගෝත්තම බුධ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("wargoththama=බුධ");
    });

    test("වර්ගෝත්තම බුධ does not match when Mercury is not wargoththama", async () => {
        mockSingle({ wargoththamaPlanets: [6] });
        const response = await search("වර්ගෝත්තම බුධ");
        const body = await response.json();
        expect(body.results).toHaveLength(0);
    });

    test("wargottama presence-only matches when any wargoththama planet exists", async () => {
        mockSingle({ wargoththamaPlanets: [3] });
        const response = await search("wargottama");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("wargoththama_present");
    });

    test("ගණ්ඩාන්ත ශුක්‍ර matches when Venus is a gandanta planet", async () => {
        mockSingle({ gandanthaPlanets: [6] });
        const response = await search("ගණ්ඩාන්ත ශුක්‍ර");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("gandanta=ශුක්‍ර");
    });

    test("ගණ්ඩමූල සඳ matches when Moon is a gandamula planet", async () => {
        mockSingle({ gandamulaPlanets: [2] });
        const response = await search("ගණ්ඩමූල සඳ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("gandamula=සඳු");
    });

    test("gandanta presence-only matches when any gandanta planet exists", async () => {
        mockSingle({ gandanthaPlanets: [3] });
        const response = await search("gandanta");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("gandanta_present");
    });

    test("පුෂ්කර බුධ matches when Mercury is a pushkara planet", async () => {
        mockSingle({ pushkaraPlanets: [4] });
        const response = await search("පුෂ්කර බුධ");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("pushkara=බුධ");
    });

    test("පුෂ්කර සඳ does not match when Moon is not a pushkara planet", async () => {
        mockSingle({ pushkaraPlanets: [6] });
        const response = await search("පුෂ්කර සඳ");
        const body = await response.json();
        expect(body.results).toHaveLength(0);
    });

    test("pushkara presence-only matches when any pushkara planet exists", async () => {
        mockSingle({ pushkaraPlanets: [8] });
        const response = await search("pushkara");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("pushkara_present");
    });

    test("pushkaram buhda matches Mercury when it is a pushkara planet (English variant)", async () => {
        mockSingle({ pushkaraPlanets: [4] });
        const response = await search("pushkaram budha");
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].matchedConditions).toContain("pushkara=බුධ");
    });
});
