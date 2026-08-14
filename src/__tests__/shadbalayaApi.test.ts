import { getServerSession } from "next-auth";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn() },
}));

jest.mock("@/models/CalculatedDetails", () => ({
    CalculatedDetails: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
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

describe("PATCH /api/horoscope/[id]/shadbalaya", () => {
    async function patchShadBalaya(
        horoscopeId: string,
        body: unknown,
        session: { user: { id: string; role: string } } | null,
    ) {
        mockGetServerSession.mockResolvedValue(session);

        const { PATCH } = await import("@/app/api/horoscope/[id]/shadbalaya/route");

        const req = { json: jest.fn().mockResolvedValue(body) };

        return PATCH(req as any, {
            params: Promise.resolve({ id: horoscopeId }),
        });
    }

    const baseHoroscope = { _id: "horo-1", owner: { id: "user-1" } };

    beforeEach(() => {
        (Horoscope.findById as jest.Mock).mockResolvedValue({ ...baseHoroscope });
        (CalculatedDetails.findOne as jest.Mock).mockResolvedValue({ _id: "cd-1" });
        (CalculatedDetails.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    });

    test("returns 401 for unauthenticated", async () => {
        const response = await patchShadBalaya("horo-1", { planet: 1, bala: "sthanaBala", value: true }, null);
        expect(response.status).toBe(401);
    });

    test("returns 404 for non-existent horoscope", async () => {
        (Horoscope.findById as jest.Mock).mockResolvedValue(null);

        const response = await patchShadBalaya(
            "horo-missing",
            { planet: 1, bala: "sthanaBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(404);
    });

    test("returns 403 for non-owner", async () => {
        (Horoscope.findById as jest.Mock).mockResolvedValue({ _id: "horo-1", owner: { id: "other-user" } });

        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1, bala: "sthanaBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(403);
        expect(CalculatedDetails.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("returns 404 when no CalculatedDetails document exists", async () => {
        (CalculatedDetails.findOne as jest.Mock).mockResolvedValue(null);

        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1, bala: "sthanaBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(404);
        expect(CalculatedDetails.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("returns 400 for out-of-range planet", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 10, bala: "sthanaBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(400);
    });

    test("returns 400 for non-integer planet", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1.5, bala: "sthanaBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(400);
    });

    test("returns 400 for unknown bala key", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1, bala: "bogusBala", value: true },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(400);
    });

    test("returns 400 for non-boolean value", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1, bala: "sthanaBala", value: "yes" },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(400);
    });

    test("owner toggle persists sparse dotted-path $set and marks overridden", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 1, bala: "sthanaBala", value: false },
            { user: { id: "user-1", role: "student" } },
        );
        expect(response.status).toBe(200);
        expect(CalculatedDetails.findOneAndUpdate).toHaveBeenCalledWith(
            { "horoscope.id": "horo-1" },
            {
                $set: {
                    "shadbalaya.1.sthanaBala.value": false,
                    "shadbalaya.1.sthanaBala.overridden": true,
                },
            },
        );
        const body = await response.json();
        expect(body).toEqual({ planet: 1, bala: "sthanaBala", value: false, overridden: true });
    });

    test("super-admin may mutate any horoscope's Shad Bala", async () => {
        const response = await patchShadBalaya(
            "horo-1",
            { planet: 8, bala: "digBala", value: true },
            { user: { id: "admin-1", role: "super-admin" } },
        );
        expect(response.status).toBe(200);
        expect(CalculatedDetails.findOneAndUpdate).toHaveBeenCalledWith(
            { "horoscope.id": "horo-1" },
            {
                $set: {
                    "shadbalaya.8.digBala.value": true,
                    "shadbalaya.8.digBala.overridden": true,
                },
            },
        );
    });
});
