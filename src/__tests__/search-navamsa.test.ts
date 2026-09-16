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

describe("search: navamsa ascendant condition (Mesha lagna Mesha Navanshaka)", () => {
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

    test("parses Mesha lagna + navamsa_ascendant Mesha from the query", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1, degree: 2 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.queryUnderstanding.conditions).toContain("navamsa_ascendant");
        expect(body.queryUnderstanding.conditions).toContain("ascendant");
        expect(body.results).toHaveLength(1);
    });

    test("matches when BOTH lagna is Mesha and navamsa lagna is Mesha", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1, degree: 2 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("rejects horoscope with Mesha lagna but non-Mesha navamsa lagna", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1, degree: 5 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("rejects horoscope with Mesha navamsa lagna but non-Mesha birth lagna", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 5, degree: 2 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("manual horoscope with manualHousePlacements.navamsaLagna is honored", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                manualHousePlacements: { lagna: 1, navamsaLagna: 1, houses: [] },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("manual horoscope with mismatched navamsaLagna is rejected", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 1 },
                manualHousePlacements: { lagna: 1, navamsaLagna: 5, houses: [] },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("Mesha lagna Mesha Navanshaka");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });
});

describe("search: lagna Dhanu + navamsa Mesha (ලග්නය ධනු නවාංශකය මේෂ)", () => {
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

    test("parses ascendant=Sagittarius alongside navamsa_ascendant=Aries", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 9, degree: 3 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("ලග්නය ධනු නවාංශකය මේෂ");
        const body = await response.json();

        expect(body.queryUnderstanding.exactMatch).toEqual([
            [
                [{ type: "ascendant", sign: 9 }, { type: "navamsa_ascendant", sign: 1 }],
            ],
        ]);
        expect(body.results).toHaveLength(1);
    });

    test("matches a Sagittarius-ascendant horoscope whose navamsa lagna is Aries", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 9, degree: 3 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("ලග්නය ධනු නවාංශකය මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
    });

    test("rejects a Sagittarius-ascendant horoscope whose navamsa lagna is NOT Aries", async () => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ascendant: { sign: 9, degree: 15 },
                planets: [],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("ලග්නය ධනු නවාංශකය මේෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });
});
