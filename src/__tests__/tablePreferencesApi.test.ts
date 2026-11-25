/**
 * GET/PUT /api/user/table-preferences — per-user Houses/Planets table column layouts.
 */
import { getServerSession } from "next-auth";

import { User } from "@/models/User";

import { DEFAULT_TABLE_PREFERENCES } from "@/lib/tableColumns";

jest.mock("@/models/User", () => ({
    User: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));
jest.mock("@/lib/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSession = getServerSession as jest.Mock;
const mockFindById = User.findById as jest.Mock;
const mockFindByIdAndUpdate = User.findByIdAndUpdate as jest.Mock;

/** Mongoose query chain stub: `.select().lean()` resolves to `value`. */
const query = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

const putRequest = (body: unknown) =>
    ({ json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)) }) as never;

async function load() {
    return import("@/app/api/user/table-preferences/route");
}

beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1", role: "student" } });
});

describe("GET /api/user/table-preferences", () => {
    it("401 without a session", async () => {
        mockSession.mockResolvedValue(null);
        const { GET } = await load();
        expect((await GET()).status).toBe(401);
    });

    it("returns the defaults when the user has none saved", async () => {
        mockFindById.mockReturnValue(query({}));
        const { GET } = await load();
        const res = await GET();
        expect(res.status).toBe(200);
        expect((await res.json()).tablePreferences).toEqual(DEFAULT_TABLE_PREFERENCES);
        expect(mockFindById).toHaveBeenCalledWith("user-1");
    });

    it("normalizes a stored layout (missing columns re-added)", async () => {
        mockFindById.mockReturnValue(query({ tablePreferences: { charts: { houses: [{ id: "sign", visible: true }] } } }));
        const { GET } = await load();
        const body = await (await GET()).json();
        expect(body.tablePreferences.charts.houses[0]).toEqual({ id: "number", visible: true });
        expect(body.tablePreferences.charts.houses).toHaveLength(9);
    });
});

describe("PUT /api/user/table-preferences", () => {
    it("401 without a session", async () => {
        mockSession.mockResolvedValue(null);
        const { PUT } = await load();
        expect((await PUT(putRequest({ tablePreferences: DEFAULT_TABLE_PREFERENCES }))).status).toBe(401);
    });

    it("400 for invalid JSON or an invalid payload, without writing", async () => {
        const { PUT } = await load();
        expect((await PUT(putRequest(new Error("bad json")))).status).toBe(400);
        expect(
            (await PUT(putRequest({ tablePreferences: { charts: { houses: [{ id: "x", visible: true }] } } }))).status,
        ).toBe(400);
        expect((await PUT(putRequest({}))).status).toBe(400);
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("saves the normalized layout on the caller's own user document", async () => {
        mockFindByIdAndUpdate.mockReturnValue(query({ _id: "user-1" }));
        const { PUT } = await load();
        const payload = {
            tablePreferences: { calculations: { houses: [{ id: "sign", visible: true }, { id: "number", visible: true }] } },
        };
        const res = await PUT(putRequest(payload));
        expect(res.status).toBe(200);
        const [id, update] = mockFindByIdAndUpdate.mock.calls[0];
        expect(id).toBe("user-1");
        const saved = update.$set.tablePreferences.calculations.houses.map((s: { id: string }) => s.id);
        // The saved order wins; columns left out are re-inserted after their default predecessor.
        expect(saved).toEqual([
            "sign",
            "start",
            "mid",
            "end",
            "planets",
            "upagraha",
            "aspects",
            "kendrasthana",
            "number",
        ]);
        expect(update.$set.tablePreferences.charts).toEqual(DEFAULT_TABLE_PREFERENCES.charts);
    });

    it("404 when the user document is gone", async () => {
        mockFindByIdAndUpdate.mockReturnValue(query(null));
        const { PUT } = await load();
        expect((await PUT(putRequest({ tablePreferences: DEFAULT_TABLE_PREFERENCES }))).status).toBe(404);
    });
});
