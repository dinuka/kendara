import { getServerSession } from "next-auth";

import { AuditLog } from "@/models/AuditLog";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";

import { anonymizeIfNeeded, getAnonymousPlaceholder } from "@/lib/privacy";

jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn(), find: jest.fn() },
}));

jest.mock("@/models/AuditLog", () => ({
    AuditLog: { create: jest.fn() },
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

jest.mock("@/models/Metadata", () => ({
    Metadata: { find: jest.fn() },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    connectDB: jest.fn(),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
}));

const mockGetServerSession = getServerSession as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("getAnonymousPlaceholder", () => {
    test("returns placeholder with last 4 chars uppercased", () => {
        expect(getAnonymousPlaceholder("abc123def456")).toBe("Anonymous Horoscope #F456");
    });

    test("returns consistent results for same input", () => {
        const id = "507f1f77bcf86cd799439011";
        const first = getAnonymousPlaceholder(id);
        const second = getAnonymousPlaceholder(id);
        expect(first).toBe(second);
    });

    test("different inputs produce different placeholders", () => {
        const a = getAnonymousPlaceholder("id-aaaa1111");
        const b = getAnonymousPlaceholder("id-bbbb2222");
        expect(a).not.toBe(b);
    });

    test("handles short IDs gracefully", () => {
        const result = getAnonymousPlaceholder("ab");
        expect(result).toBe("Anonymous Horoscope #AB");
    });

    test("returns uppercase suffix", () => {
        const result = getAnonymousPlaceholder("test-abcde");
        expect(result).toMatch(/[A-Z]$/);
    });
});

describe("anonymizeIfNeeded", () => {
    const baseHoroscope = {
        _id: "horo-1",
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
    } as const;

    test("returns horoscope unchanged for owner", () => {
        const result = anonymizeIfNeeded(baseHoroscope, "owner-1");
        expect(result.name).toBe("John Doe");
    });

    test("returns horoscope unchanged for super admin", () => {
        const result = anonymizeIfNeeded(baseHoroscope, "other-user", "super-admin");
        expect(result.name).toBe("John Doe");
    });

    test("returns horoscope unchanged when displayName is true for non-owner", () => {
        const result = anonymizeIfNeeded(baseHoroscope, "other-user");
        expect(result.name).toBe("John Doe");
    });

    test("returns anonymized name when displayName is false for non-owner", () => {
        const horoscope = { ...baseHoroscope, displayName: false };
        const result = anonymizeIfNeeded(horoscope, "other-user");
        expect(result.name).toMatch(/^Anonymous Horoscope #/);
    });

    test("does not mutate the original horoscope object", () => {
        const horoscope = { ...baseHoroscope, displayName: false };
        const originalName = horoscope.name;
        anonymizeIfNeeded(horoscope, "other-user");
        expect(horoscope.name).toBe(originalName);
    });

    test("owner sees actual name even when displayName is false", () => {
        const horoscope = { ...baseHoroscope, displayName: false };
        const result = anonymizeIfNeeded(horoscope, "owner-1");
        expect(result.name).toBe("John Doe");
    });
});

describe("PATCH /api/horoscope/[id]/privacy", () => {
    async function patchPrivacy(
        horoscopeId: string,
        body: Record<string, unknown>,
        session: { user: { id: string; role: string } } | null,
    ) {
        mockGetServerSession.mockResolvedValue(session);

        const { PATCH } = await import("@/app/api/horoscope/[id]/privacy/route");

        const req = {
            json: jest.fn().mockResolvedValue(body),
            headers: {
                get: (key: string) => {
                    if (key === "x-forwarded-for") return "127.0.0.1";
                    if (key === "user-agent") return "test-agent";
                    return null;
                },
            },
        };

        return PATCH(req as any, {
            params: Promise.resolve({ id: horoscopeId }),
        });
    }

    test("returns 401 for unauthenticated", async () => {
        const response = await patchPrivacy("horo-1", { isPublic: true }, null);
        expect(response.status).toBe(401);
    });

    test("returns 403 for super admin", async () => {
        const response = await patchPrivacy(
            "horo-1",
            { isPublic: true },
            { user: { id: "admin-1", role: "super-admin" } },
        );
        expect(response.status).toBe(403);
    });

    test("returns 404 for non-existent horoscope", async () => {
        (Horoscope.findById as jest.Mock).mockResolvedValue(null);

        const response = await patchPrivacy(
            "horo-missing",
            { isPublic: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(404);
    });

    test("returns 403 for non-owner", async () => {
        (Horoscope.findById as jest.Mock).mockResolvedValue({
            _id: "horo-1",
            owner: { id: "other-user" },
            isPublic: false,
            displayName: true,
            name: "Test Horoscope",
            save: jest.fn().mockResolvedValue(true),
        });

        const response = await patchPrivacy("horo-1", { isPublic: true }, { user: { id: "user-1", role: "student" } });
        expect(response.status).toBe(403);
    });

    test("updates isPublic successfully", async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        (Horoscope.findById as jest.Mock).mockResolvedValue({
            _id: "horo-1",
            owner: { id: "user-1" },
            isPublic: false,
            displayName: true,
            name: "Test Horoscope",
            save: saveMock,
        });
        (AuditLog.create as jest.Mock).mockResolvedValue({});

        const response = await patchPrivacy("horo-1", { isPublic: true }, { user: { id: "user-1", role: "student" } });

        expect(response.status).toBe(200);
        expect(saveMock).toHaveBeenCalled();
        expect(AuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "privacy_change",
                actor: { id: "user-1" },
                target: { id: "horo-1", type: "horoscope" },
            }),
        );
    });

    test("updates displayName successfully", async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        (Horoscope.findById as jest.Mock).mockResolvedValue({
            _id: "horo-1",
            owner: { id: "user-1" },
            isPublic: true,
            displayName: true,
            name: "Test Horoscope",
            save: saveMock,
        });
        (AuditLog.create as jest.Mock).mockResolvedValue({});

        const response = await patchPrivacy(
            "horo-1",
            { displayName: false },
            { user: { id: "user-1", role: "student" } },
        );

        expect(response.status).toBe(200);
        expect(saveMock).toHaveBeenCalled();
    });

    test("partial update of isPublic only changes isPublic", async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        (Horoscope.findById as jest.Mock).mockResolvedValue({
            _id: "horo-1",
            owner: { id: "user-1" },
            isPublic: false,
            displayName: true,
            name: "Test Horoscope",
            save: saveMock,
        });
        (AuditLog.create as jest.Mock).mockResolvedValue({});

        const response = await patchPrivacy("horo-1", { isPublic: true }, { user: { id: "user-1", role: "student" } });

        expect(response.status).toBe(200);
        expect(saveMock).toHaveBeenCalled();
        expect(AuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                details: expect.arrayContaining([expect.objectContaining({ field: "isPublic" })]),
            }),
        );
    });
});

describe("GET /api/horoscope/[id]", () => {
    async function getHoroscope(horoscopeId: string, session: { user: { id: string; role: string } } | null) {
        mockGetServerSession.mockResolvedValue(session);

        const { GET } = await import("@/app/api/horoscope/[id]/route");

        const req = { headers: { get: () => null } };

        return GET(req as any, {
            params: Promise.resolve({ id: horoscopeId }),
        });
    }

    const baseHoroscope = {
        _id: "horo-1",
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        birthDate: new Date("1990-01-01"),
        birthTime: "12:00",
        locationName: "Colombo",
        latitude: 6.9271,
        longitude: 79.8612,
        gender: "male",
        ayanamsha: "lahiri",
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
        (Metadata.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
    });

    test("returns 401 for unauthenticated", async () => {
        const response = await getHoroscope("horo-1", null);
        expect(response.status).toBe(401);
    });

    test("returns 404 for non-existent horoscope", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        const response = await getHoroscope("horo-missing", { user: { id: "user-1", role: "student" } });
        expect(response.status).toBe(404);
    });

    test("owner sees all horoscope data including name", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ ...baseHoroscope }),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        const response = await getHoroscope("horo-1", {
            user: { id: "owner-1", role: "student" },
        });
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.horoscope.name).toBe("John Doe");
    });

    test("non-owner gets 404 for private horoscope", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ...baseHoroscope,
                isPublic: false,
            }),
        });

        const response = await getHoroscope("horo-1", {
            user: { id: "other-user", role: "student" },
        });
        expect(response.status).toBe(404);
    });

    test("non-owner sees anonymized name when displayName is false and horoscope is public", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ...baseHoroscope,
                isPublic: true,
                displayName: false,
            }),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        const response = await getHoroscope("horo-1", {
            user: { id: "other-user", role: "student" },
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.horoscope.name).toMatch(/^Anonymous Horoscope #/);
    });

    test("non-owner sees actual name when displayName is true", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ...baseHoroscope,
                isPublic: true,
                displayName: true,
            }),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        const response = await getHoroscope("horo-1", {
            user: { id: "other-user", role: "student" },
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.horoscope.name).toBe("John Doe");
    });

    test("super admin sees private horoscope with actual name", async () => {
        (Horoscope.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                ...baseHoroscope,
                isPublic: false,
            }),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        const response = await getHoroscope("horo-1", {
            user: { id: "admin-1", role: "super-admin" },
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.horoscope.name).toBe("John Doe");
    });
});

describe("Search anonymization", () => {
    async function search(query: string, session: { user: { id: string; role: string } } | null) {
        mockGetServerSession.mockResolvedValue(session);

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
        birthDate: new Date("1990-01-01"),
        birthTime: "12:00",
        locationName: "Colombo",
        latitude: 6.9271,
        longitude: 79.8612,
        gender: "male" as const,
        ayanamsha: "lahiri" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    test("returns 401 for unauthenticated", async () => {
        const response = await search("test", null);
        expect(response.status).toBe(401);
    });

    test("returns 400 for empty query", async () => {
        const response = await search("", { user: { id: "user-1", role: "student" } });
        expect(response.status).toBe(400);
    });

    test("anonymizes name for non-owner when displayName is false", async () => {
        const horoscopes = [
            makeHoroscope({
                _id: "horo-1",
                name: "John Doe",
                owner: { id: "owner-1" },
                displayName: false,
                isPublic: true,
            }),
        ];
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(horoscopes),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [{ name: 7, strength: "Uchcha" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("exaltation", { user: { id: "other-user", role: "student" } });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.results[0].horoscope.name).toMatch(/^Anonymous Horoscope #/);
    });

    test("shows actual name for owner even when displayName is false", async () => {
        const horoscopes = [
            makeHoroscope({
                _id: "horo-1",
                name: "John Doe",
                owner: { id: "owner-1" },
                displayName: false,
                isPublic: true,
            }),
        ];
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(horoscopes),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [{ name: 7, strength: "Uchcha" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("exaltation", { user: { id: "owner-1", role: "student" } });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.results[0].horoscope.name).toBe("John Doe");
    });

    test("shows actual name for non-owner when displayName is true", async () => {
        const horoscopes = [
            makeHoroscope({
                _id: "horo-1",
                name: "John Doe",
                owner: { id: "owner-1" },
                displayName: true,
                isPublic: true,
            }),
        ];
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(horoscopes),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                planets: [{ name: 7, strength: "Uchcha" }],
            }),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        const response = await search("exaltation", { user: { id: "other-user", role: "student" } });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.results[0].horoscope.name).toBe("John Doe");
    });
});
