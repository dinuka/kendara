/**
 * Student Notepad — API route tests (GET/PUT /api/horoscope/[id]/note + cascade + static checks).
 * QA plan: specs/qa/20260816-1823-student-notes-test-plan.md (IT-SN-200..230, SR-SN-1000).
 */
import * as fs from "fs";
import { getServerSession } from "next-auth";
import * as path from "path";

import { Horoscope } from "@/models/Horoscope";
import { HoroscopeNote } from "@/models/HoroscopeNote";

import { PLANET_STRENGTH_FACTORS } from "@/lib/notepadCatalogs";

jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn(), deleteOne: jest.fn(), findOneAndDelete: jest.fn() },
}));

jest.mock("@/models/HoroscopeNote", () => ({
    HoroscopeNote: {
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        deleteMany: jest.fn(),
    },
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

jest.mock("@/lib/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetServerSession = getServerSession as jest.Mock;

const userA = { id: "user-a", role: "student" };
const admin = { id: "admin-1", role: "super-admin" };

const validState = {
    notepadState: {
        position: { x: 120, y: 80 },
        size: { width: 480, height: 640 },
        isOpen: true,
        selectedParentTag: 7,
        selectedSubTag: "marriage",
    },
};

const validTag = {
    id: "tag-1",
    parentTag: 7,
    subTag: "marriage",
    text: "Venus in the 7th",
    color: 3,
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
};

const validNote = {
    id: "note-1",
    text: "A useful note",
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
};

const noteDoc = {
    _id: "note-doc-1",
    id: "note-doc-1",
    user: { id: userA.id },
    horoscope: { id: "horo-1" },
    notepadState: validState.notepadState,
    observationTags: [validTag],
    resultNotes: [validNote],
    observationTagOverrides: { "houseLord:lord:2": "yellow" },
    irrelevantTagIds: ["houseLord:lord:2"],
    createdAt: new Date(),
    updatedAt: new Date(),
};

/** The route calls `Horoscope.findById(id).lean()` — the mock must expose lean(). */
const mockHoroscope = (h: object): { lean: () => object } => ({
    lean: () => h,
});

beforeEach(() => {
    jest.clearAllMocks();
    (Horoscope.findById as jest.Mock).mockImplementation(() =>
        mockHoroscope({ _id: "horo-1", owner: { id: userA.id }, isPublic: false }),
    );
    (HoroscopeNote.findOne as jest.Mock).mockImplementation(() => ({ lean: () => Promise.resolve(null) }));
    (HoroscopeNote.findOneAndUpdate as jest.Mock).mockImplementation(() => ({
        lean: () => Promise.resolve({ ...noteDoc }),
    }));
    (HoroscopeNote.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });
});

describe("GET /api/horoscope/[id]/note (IT-SN-200..207)", () => {
    async function getNote(horoscopeId: string, session: { user: { id: string; role: string } } | null) {
        mockGetServerSession.mockResolvedValue(session);
        const { GET } = await import("@/app/api/horoscope/[id]/note/route");
        const req = new Request(`http://localhost/api/horoscope/${horoscopeId}/note`);
        return GET(req as never, { params: Promise.resolve({ id: horoscopeId }) });
    }

    test("IT-SN-200: unauthenticated → 401", async () => {
        const response = await getNote("horo-1", null);
        expect(response.status).toBe(401);
    });

    test("IT-SN-202: horoscope not found → 404", async () => {
        (Horoscope.findById as jest.Mock).mockImplementation(() => ({ lean: () => Promise.resolve(null) }));
        const response = await getNote("horo-nope", { user: userA });
        expect(response.status).toBe(404);
    });

    test("IT-SN-203: non-owner, non-public horoscope → 404, never 403", async () => {
        (Horoscope.findById as jest.Mock).mockImplementation(() =>
            mockHoroscope({ _id: "horo-1", owner: { id: "user-b" }, isPublic: false }),
        );
        const response = await getNote("horo-1", { user: userA });
        expect(response.status).toBe(404);
    });

    test("IT-SN-204b: non-owner on a PUBLIC horoscope → viewer gets their own note (200, own-doc semantics)", async () => {
        // The viewer's own document is keyed on their session id — cross-student content can never
        // leak because the query is scoped to session.user.id (documented deviation: the QA's
        // share-token-only scenario is unreachable — the share page is a stub; see dev spec).
        (Horoscope.findById as jest.Mock).mockImplementation(() =>
            mockHoroscope({ _id: "horo-1", owner: { id: "user-b" }, isPublic: true }),
        );
        (HoroscopeNote.findOne as jest.Mock).mockImplementation(() => ({ lean: () => Promise.resolve(null) }));
        const response = await getNote("horo-1", { user: userA });
        expect(response.status).toBe(200);
        const body = (await response.json()) as { observationTags: unknown[] };
        expect(body.observationTags).toEqual([]);
        expect(HoroscopeNote.findOne).toHaveBeenCalledWith({ "user.id": "user-a", "horoscope.id": "horo-1" });
    });

    test("IT-SN-205: super-admin → 200 on any horoscope", async () => {
        (Horoscope.findById as jest.Mock).mockImplementation(() =>
            mockHoroscope({ _id: "horo-1", owner: { id: "user-b" }, isPublic: false }),
        );
        const response = await getNote("horo-1", { user: admin });
        expect(response.status).toBe(200);
    });

    test("IT-SN-206: no existing note → exact empty defaults, GET never writes", async () => {
        (HoroscopeNote.findOne as jest.Mock).mockImplementation(() => ({ lean: () => Promise.resolve(null) }));
        const response = await getNote("horo-1", { user: userA });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            notepadState: null,
            observationTags: [],
            resultNotes: [],
            observationTagOverrides: {},
            irrelevantTagIds: [],
            planetFactorOverrides: {},
        });
        expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("IT-SN-207: existing note round-trips exactly", async () => {
        (HoroscopeNote.findOne as jest.Mock).mockImplementation(() => ({
            lean: () => Promise.resolve({ ...noteDoc }),
        }));
        const response = await getNote("horo-1", { user: userA });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.notepadState).toEqual(validState.notepadState);
        expect(body.observationTags).toEqual([validTag]);
        expect(body.resultNotes).toEqual([validNote]);
        expect(body.observationTagOverrides).toEqual({ "houseLord:lord:2": "yellow" });
        expect(body.irrelevantTagIds).toEqual(["houseLord:lord:2"]);
    });

    test("IT-SN-207b: GET returns stored planetFactorOverrides", async () => {
        (HoroscopeNote.findOne as jest.Mock).mockImplementation(() => ({
            lean: () => Promise.resolve({ ...noteDoc, planetFactorOverrides: { "2": { sign: "green" } } }),
        }));
        const response = await getNote("horo-1", { user: userA });
        const body = (await response.json()) as { planetFactorOverrides: unknown };
        expect(body.planetFactorOverrides).toEqual({ "2": { sign: "green" } });
    });
});

describe("PUT /api/horoscope/[id]/note (IT-SN-201, IT-SN-208..230)", () => {
    async function putNote(horoscopeId: string, body: unknown, session: { user: { id: string; role: string } } | null) {
        mockGetServerSession.mockResolvedValue(session);
        const { PUT } = await import("@/app/api/horoscope/[id]/note/route");
        const req = {
            json: jest.fn().mockResolvedValue(body),
        };
        return PUT(req as never, { params: Promise.resolve({ id: horoscopeId }) });
    }

    test("IT-SN-201: unauthenticated → 401, no write", async () => {
        const response = await putNote("horo-1", validState, null);
        expect(response.status).toBe(401);
        expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("IT-SN-208: first PUT creates the doc via findOneAndUpdate upsert", async () => {
        (HoroscopeNote.findOneAndUpdate as jest.Mock).mockImplementation(() => ({
            lean: () => Promise.resolve({ ...noteDoc, observationTags: [] }),
        }));
        const response = await putNote("horo-1", validState, { user: userA });
        expect(response.status).toBe(200);
        expect(HoroscopeNote.findOneAndUpdate).toHaveBeenCalledWith(
            { "user.id": "user-a", "horoscope.id": "horo-1" },
            expect.any(Object),
            { upsert: true, new: true },
        );
    });

    test("IT-SN-210: notepadState persists via dotted $set paths", async () => {
        const response = await putNote("horo-1", validState, { user: userA });
        expect(response.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(set.$set["notepadState.position"]).toEqual({ x: 120, y: 80 });
        expect(set.$set["notepadState.size"]).toEqual({ width: 480, height: 640 });
        expect(set.$set["notepadState.isOpen"]).toBe(true);
        expect(set.$set["notepadState.selectedParentTag"]).toBe(7);
        expect(set.$set["notepadState.selectedSubTag"]).toBe("marriage");
    });

    test("IT-SN-222: field-group $set — untouched groups survive", async () => {
        const response = await putNote("horo-1", { notepadState: validState.notepadState }, { user: userA });
        expect(response.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(Object.keys(set.$set)).toEqual([
            "notepadState.position",
            "notepadState.size",
            "notepadState.isOpen",
            "notepadState.selectedParentTag",
            "notepadState.selectedSubTag",
        ]);
        expect(set.$set.observationTags).toBeUndefined();
        expect(set.$set.resultNotes).toBeUndefined();
    });

    test("IT-SN-211/212: geometry out of bounds → 400, no write", async () => {
        for (const bad of [
            { ...validState, notepadState: { ...validState.notepadState, size: { width: 319, height: 640 } } },
            { ...validState, notepadState: { ...validState.notepadState, size: { width: 480, height: 1201 } } },
        ]) {
            const response = await putNote("horo-1", bad, { user: userA });
            expect(response.status).toBe(400);
            expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
        }
    });

    test("IT-SN-213/214: parentTag out of range or non-integer → 400", async () => {
        for (const parentTag of [13, -1, "7", 7.5, null]) {
            const response = await putNote(
                "horo-1",
                {
                    notepadState: {
                        ...validState.notepadState,
                        selectedParentTag: parentTag,
                        selectedSubTag: undefined,
                    },
                },
                { user: userA },
            );
            expect(response.status).toBe(400);
            expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
        }
    });

    test("IT-SN-215: subTag not in catalog for that parent → 400, no write", async () => {
        const response = await putNote(
            "horo-1",
            { notepadState: { ...validState.notepadState, selectedSubTag: "not-a-key" } },
            { user: userA },
        );
        expect(response.status).toBe(400);
        expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("IT-SN-215b: subTag without an explicit parent → 400", async () => {
        const response = await putNote(
            "horo-1",
            {
                notepadState: {
                    position: { x: 120, y: 80 },
                    size: { width: 480, height: 640 },
                    selectedSubTag: "marriage",
                },
            },
            { user: userA },
        );
        expect(response.status).toBe(400);
    });

    test("IT-SN-216: parent 0 + subTag null → 200", async () => {
        const response = await putNote(
            "horo-1",
            {
                notepadState: {
                    position: { x: 120, y: 80 },
                    size: { width: 480, height: 640 },
                    selectedParentTag: 0,
                    selectedSubTag: null,
                },
            },
            { user: userA },
        );
        expect(response.status).toBe(200);
    });

    test("IT-SN-216b: parent 1 + subTag null → 200 (parent-level tag)", async () => {
        const response = await putNote(
            "horo-1",
            { notepadState: { ...validState.notepadState, selectedParentTag: 1, selectedSubTag: null } },
            { user: userA },
        );
        expect(response.status).toBe(200);
    });

    test("IT-SN-217: tag text > 500 → 400; boundary 500 → 200", async () => {
        const over = await putNote(
            "horo-1",
            { observationTags: [{ ...validTag, text: "x".repeat(501) }] },
            { user: userA },
        );
        expect(over.status).toBe(400);

        const atBoundary = await putNote(
            "horo-1",
            { observationTags: [{ ...validTag, text: "x".repeat(500) }] },
            { user: userA },
        );
        expect(atBoundary.status).toBe(200);
    });

    test("IT-SN-218: note text > 2000 → 400; boundary 2000 → 200", async () => {
        const over = await putNote(
            "horo-1",
            { resultNotes: [{ ...validNote, text: "x".repeat(2001) }] },
            { user: userA },
        );
        expect(over.status).toBe(400);

        const atBoundary = await putNote(
            "horo-1",
            { resultNotes: [{ ...validNote, text: "x".repeat(2000) }] },
            { user: userA },
        );
        expect(atBoundary.status).toBe(200);
    });

    test("IT-SN-219: tagColor out of range → 400", async () => {
        for (const color of [0, 7, "1"]) {
            const response = await putNote("horo-1", { observationTags: [{ ...validTag, color }] }, { user: userA });
            expect(response.status).toBe(400);
        }
    });

    test("IT-SN-219b: color overrides — valid map persists, invalid value rejects the whole map", async () => {
        const okResponse = await putNote(
            "horo-1",
            { observationTagOverrides: { "houseLord:lord:2": "yellow", "planetsInHouse:planet:3": "lightRed" } },
            { user: userA },
        );
        expect(okResponse.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(set.$set.observationTagOverrides).toEqual({
            "houseLord:lord:2": "yellow",
            "planetsInHouse:planet:3": "lightRed",
        });

        (HoroscopeNote.findOneAndUpdate as jest.Mock).mockClear();
        for (const bad of [
            { "houseLord:lord:2": "blue" },
            { "houseLord:lord:2": 1 },
            { "houseLord:lord:2": null },
            { "houseLord:lord:2": "" },
        ]) {
            const response = await putNote("horo-1", { observationTagOverrides: bad }, { user: userA });
            expect(response.status).toBe(400);
            expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
        }
    });

    test("IT-SN-219c: color overrides — empty map is valid; non-object or oversized map rejected", async () => {
        expect((await putNote("horo-1", { observationTagOverrides: {} }, { user: userA })).status).toBe(200);

        for (const bad of [null, [], "x", 5]) {
            expect((await putNote("horo-1", { observationTagOverrides: bad }, { user: userA })).status).toBe(400);
        }

        const huge: Record<string, string> = {};
        for (let i = 0; i <= 500; i += 1) huge[`tag-${i}`] = "yellow";
        expect((await putNote("horo-1", { observationTagOverrides: huge }, { user: userA })).status).toBe(400);
    });

    test("IT-SN-219d: irrelevantTagIds — valid list persists via $set, duplicates collapse", async () => {
        const response = await putNote(
            "horo-1",
            { irrelevantTagIds: ["houseLord:lord:2", "planetsInHouse:planet:3", "houseLord:lord:2"] },
            { user: userA },
        );
        expect(response.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(set.$set.irrelevantTagIds).toEqual(["houseLord:lord:2", "planetsInHouse:planet:3"]);
    });

    test("IT-SN-219e: irrelevantTagIds — empty list valid; bad shapes rejected", async () => {
        expect((await putNote("horo-1", { irrelevantTagIds: [] }, { user: userA })).status).toBe(200);
        (HoroscopeNote.findOneAndUpdate as jest.Mock).mockClear();

        for (const bad of [null, "x", 5, {}, [null], [""], ["  "], [123], ["a".repeat(301)]]) {
            const response = await putNote("horo-1", { irrelevantTagIds: bad }, { user: userA });
            expect(response.status).toBe(400);
            expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
        }

        const huge = Array.from({ length: 201 }, (_, i) => `tag-${i}`);
        expect((await putNote("horo-1", { irrelevantTagIds: huge }, { user: userA })).status).toBe(400);
    });

    test("IT-SN-219f: planetFactorOverrides — valid map persists via $set", async () => {
        const response = await putNote(
            "horo-1",
            { planetFactorOverrides: { "2": { sign: "green", house: "red" }, "3": { ashtamansha: "white" } } },
            { user: userA },
        );
        expect(response.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(set.$set.planetFactorOverrides).toEqual({
            "2": { sign: "green", house: "red" },
            "3": { ashtamansha: "white" },
        });
    });

    test("IT-SN-219g: planetFactorOverrides — bad planet/factor/color keys reject the whole map", async () => {
        (HoroscopeNote.findOneAndUpdate as jest.Mock).mockClear();
        for (const bad of [
            { "0": { sign: "green" } },
            { "10": { sign: "green" } },
            { abc: { sign: "green" } },
            { "2": { nonexistent: "green" } },
            { "2": { sign: "yellow" } },
            { "2": { sign: 1 } },
            { "2": { sign: null } },
            { "2": { varga: "green" } }, // removed aggregate key — no longer in the catalogue
        ]) {
            const response = await putNote("horo-1", { planetFactorOverrides: bad }, { user: userA });
            expect(response.status).toBe(400);
            expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();
        }
    });

    test("IT-SN-219h: planetFactorOverrides — empty map valid; non-object rejected; caps enforced", async () => {
        expect((await putNote("horo-1", { planetFactorOverrides: {} }, { user: userA })).status).toBe(200);
        (HoroscopeNote.findOneAndUpdate as jest.Mock).mockClear();

        for (const bad of [null, [], "x", 5]) {
            expect((await putNote("horo-1", { planetFactorOverrides: bad }, { user: userA })).status).toBe(400);
        }

        const tooManyPlanets: Record<string, Record<string, string>> = {};
        for (let i = 1; i <= 10; i += 1) tooManyPlanets[String(i)] = { sign: "green" };
        expect((await putNote("horo-1", { planetFactorOverrides: tooManyPlanets }, { user: userA })).status).toBe(400);

        // Every catalogue factor plus one unknown key exceeds the per-planet cap (20 catalogue keys).
        const tooManyFactors: Record<string, Record<string, string>> = { "2": {} };
        for (const key of [...PLANET_STRENGTH_FACTORS, "extra"]) {
            tooManyFactors["2"][key] = "green";
        }
        expect((await putNote("horo-1", { planetFactorOverrides: tooManyFactors }, { user: userA })).status).toBe(400);
    });

    test("IT-SN-220: tag count cap — 201 → 400, 200 → 200", async () => {
        const many = Array.from({ length: 201 }, () => ({ ...validTag, id: `tag-${Math.random()}` }));
        expect((await putNote("horo-1", { observationTags: many }, { user: userA })).status).toBe(400);
        expect((await putNote("horo-1", { observationTags: many.slice(0, 200) }, { user: userA })).status).toBe(200);
    });

    test("IT-SN-221: note count cap — 101 → 400, 100 → 200", async () => {
        const many = Array.from({ length: 101 }, () => ({ ...validNote, id: `note-${Math.random()}` }));
        expect((await putNote("horo-1", { resultNotes: many }, { user: userA })).status).toBe(400);
        expect((await putNote("horo-1", { resultNotes: many.slice(0, 100) }, { user: userA })).status).toBe(200);
    });

    test("IT-SN-229: unknown top-level fields ignored", async () => {
        const response = await putNote(
            "horo-1",
            { ...validState, hackerField: "x", notepadState: undefined },
            { user: userA },
        );
        expect(response.status).toBe(400); // hackerField alone → no valid group at all
        const okResponse = await putNote("horo-1", { ...validState, hackerField: "x" }, { user: userA });
        expect(okResponse.status).toBe(200);
        const [, set] = (HoroscopeNote.findOneAndUpdate as jest.Mock).mock.calls[0] as [
            unknown,
            { $set: Record<string, unknown> },
            unknown,
        ];
        expect(set.$set.hackerField).toBeUndefined();
    });

    test("IT-SN-230: empty body {} or invalid JSON → 400, no write", async () => {
        const empty = await putNote("horo-1", {}, { user: userA });
        expect(empty.status).toBe(400);
        expect(HoroscopeNote.findOneAndUpdate).not.toHaveBeenCalled();

        mockGetServerSession.mockResolvedValue({ user: userA });
        const { PUT } = await import("@/app/api/horoscope/[id]/note/route");
        const badReq = { json: jest.fn().mockRejectedValue(new SyntaxError("bad json")) };
        const malformed = await PUT(badReq as never, { params: Promise.resolve({ id: "horo-1" }) });
        expect(malformed.status).toBe(400);
    });

    test("IT-SN-223: sequential PUTs — last write wins (findOneAndUpdate per call)", async () => {
        await putNote("horo-1", validState, { user: userA });
        await putNote(
            "horo-1",
            { ...validState, notepadState: { ...validState.notepadState, position: { x: 999, y: 999 } } },
            { user: userA },
        );
        expect(HoroscopeNote.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
});

describe("Static + cascade checks (IT-SN-224/225/226, SR-SN-1000)", () => {
    const root = path.resolve(__dirname, "..", "..", "src");

    test("IT-SN-224: note route imports notepadCatalogs but never the derivation module", () => {
        const routeSource = fs.readFileSync(path.join(root, "app/api/horoscope/[id]/note/route.ts"), "utf8");
        expect(routeSource).not.toContain("notepadObservations");
        expect(routeSource).toContain("notepadCatalogs");
    });

    test("IT-SN-225: recalculation job never touches HoroscopeNote", () => {
        const jobSource = fs.readFileSync(path.join(root, "lib/recalculationJob.ts"), "utf8");
        expect(jobSource).not.toContain("HoroscopeNote");
    });

    test("IT-SN-226: both DELETE routes cascade-delete note documents", async () => {
        for (const routePath of ["app/api/horoscope/[id]/route.ts", "app/api/admin/horoscope/[id]/route.ts"]) {
            const source = fs.readFileSync(path.join(root, routePath), "utf8");
            expect(source).toContain("HoroscopeNote.deleteMany");
            expect(source).toContain('"horoscope.id"');
        }
    });

    test("SR-SN-1000: search route never reads HoroscopeNote", () => {
        const searchSource = fs.readFileSync(path.join(root, "app/api/search/route.ts"), "utf8");
        expect(searchSource).not.toContain("HoroscopeNote");
    });
});
