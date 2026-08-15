/**
 * Bhava Suchika (භාව සුචික) — API/integration tests.
 * QA plan: specs/qa/20260814-2210-bhava-suchika-test-plan.md (IT-BS-100..113, RE-BS-460).
 * No new routes (D8): auto create persists via the `...calculated` spread; manual create/update
 * derive iff navamsa data is entered; the recalculation job recomputes (no merge).
 */
import * as fs from "fs";
import { getServerSession } from "next-auth";
import * as path from "path";

import { AstrologySettings } from "@/models/AstrologySettings";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { calculateHoroscope } from "@/lib/calculation";
import * as manualChart from "@/lib/manualChart";
import * as manualChartDetails from "@/lib/manualChartDetails";

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    connectDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/calculation", () => ({
    calculateHoroscope: jest.fn(),
}));

jest.mock("@/lib/astrologySettings", () => ({
    getCalculationSettings: jest.fn().mockResolvedValue({
        planetaryOrbs: {},
        planetAspects: {},
        rashiAspects: { enabled: true },
    }),
    getAstrologySettings: jest.fn().mockResolvedValue({
        version: 1,
        recalcStatus: { status: "completed", settingsVersion: 1 },
    }),
    DEFAULT_PLANETARY_ORBS: {},
}));

jest.mock("@/lib/currentPlanets", () => ({
    computeCurrentPlanets: jest.fn().mockReturnValue([]),
}));

jest.mock("@/lib/chartDataTransform", () => ({
    getChartData: jest.fn().mockReturnValue({}),
    isLeanChartType: jest.fn().mockReturnValue(true),
    toBirthChartData: jest.fn().mockReturnValue({}),
}));

jest.mock("@/lib/chartRenderer", () => ({
    generateChartSvg: jest.fn().mockReturnValue(""),
}));

jest.mock("@/lib/chartTypes", () => ({
    ChartType: { BIRTH: "birth", NAVAMSA_D9: "navamsa-d9" },
    ALL_CHART_TYPES: ["birth"],
}));

jest.mock("@/lib/search/indexer", () => ({
    indexHoroscope: jest.fn().mockResolvedValue(true),
    reindexHoroscope: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
}));

// --- model mocks -----------------------------------------------------------

jest.mock("@/models/Horoscope", () => ({
    Horoscope: {
        findById: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        updateOne: jest.fn(),
    },
}));

jest.mock("@/models/CalculatedDetails", () => ({
    CalculatedDetails: {
        create: jest.fn().mockResolvedValue({}),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn().mockResolvedValue({}),
        find: jest.fn(),
    },
}));

jest.mock("@/models/Chart", () => ({
    Chart: {
        insertMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    },
}));

jest.mock("@/models/AstrologySettings", () => ({
    AstrologySettings: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockedCalculate = calculateHoroscope as jest.Mock;

const mockHoroscope = Horoscope as unknown as {
    findById: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
};
const mockCD = CalculatedDetails as unknown as {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    find: jest.Mock;
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", role: "student" } });
    mockCD.create.mockResolvedValue({});
});

describe("IT-BS-100 / RE-BS-460: no new endpoints", () => {
    test("no bhava-suchika route file exists anywhere under src/app/api", () => {
        const apiRoot = path.join(process.cwd(), "src/app/api");
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
                const p = path.join(dir, e.name);
                return e.isDirectory() ? walk(p) : [p];
            });
        const routes = walk(apiRoot).filter((p) => p.endsWith("route.ts"));
        const bhavaRoutes = routes.filter((p) => p.toLowerCase().includes("bhava"));
        expect(bhavaRoutes).toEqual([]);
    });
});

describe("IT-BS-101/102: auto create persists via the ...calculated spread", () => {
    async function postHoroscope(calculated: Record<string, unknown>) {
        mockedCalculate.mockReturnValue(calculated);
        (mockHoroscope.create as jest.Mock).mockResolvedValue({ id: "horo-1" });

        const { POST } = await import("@/app/api/horoscope/route");
        const req = {
            json: jest.fn().mockResolvedValue({
                name: "Test",
                birthDate: "1990-06-15",
                birthTime: "08:30",
                latitude: 6.9271,
                longitude: 79.8612,
                gender: "male",
                ayanamsha: "lahiri",
            }),
        };
        return POST(req as any);
    }

    test("IT-BS-101: payload carries lagnaBhavaSuchika + bhavaSuchika via the spread", async () => {
        const calculated = {
            ascendant: { sign: 4, degree: 4.76 },
            lagnaBhavaSuchika: 7,
            bhavaSuchika: { "1": 2, "2": 8, "3": 6 },
        };
        const response = await postHoroscope(calculated);

        expect(response.status).toBe(201);
        const payload = mockCD.create.mock.calls[0][0];
        expect(payload.horoscope).toEqual({ id: "horo-1" });
        expect(payload.lagnaBhavaSuchika).toBe(7);
        expect(payload.bhavaSuchika).toEqual({ "1": 2, "2": 8, "3": 6 });
    });

    test("IT-BS-102: legacy-shaped calculation without the fields still persists (optionality)", async () => {
        const calculated = { ascendant: { sign: 1, degree: 0 }, planets: [] };
        const response = await postHoroscope(calculated);

        expect(response.status).toBe(201);
        const payload = mockCD.create.mock.calls[0][0];
        expect(payload.lagnaBhavaSuchika).toBeUndefined();
        expect(payload.bhavaSuchika).toBeUndefined();
    });
});

describe("IT-BS-103/104/105: manual create/update derive iff navamsa data", () => {
    async function postManual(body: Record<string, unknown>) {
        (mockHoroscope.create as jest.Mock).mockResolvedValue({ id: "manual-1" });
        const { POST } = await import("@/app/api/horoscope/manual/route");
        const req = { json: jest.fn().mockResolvedValue(body) };
        return POST(req as any);
    }

    async function putManualChart(id: string, body: Record<string, unknown>) {
        (mockHoroscope.findById as jest.Mock).mockResolvedValue({
            _id: id,
            owner: { id: "user-1" },
            source: "manual",
            birthDate: new Date("1990-06-15"),
        });
        const { PUT } = await import("@/app/api/horoscope/[id]/manual-chart/route");
        const req = { json: jest.fn().mockResolvedValue(body) };
        return PUT(req as any, { params: Promise.resolve({ id }) });
    }

    test("IT-BS-103: manual create with navamsaLagna + navamsaHouses persists both fields", async () => {
        const response = await postManual({
            name: "Manual",
            lagna: 1,
            houses: { "1": [1] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [1] },
        });

        expect(response.status).toBe(201);
        const payload = mockCD.create.mock.calls[0][0];
        expect(payload.lagnaBhavaSuchika).toBe(5); // ((5 - 1) mod 12) + 1
        expect(payload.bhavaSuchika).toBeDefined();
        expect(payload.bhavaSuchika["1"]).toBe(5); // Sun placed in D9 house 1 → sign 5
    });

    test("IT-BS-104: manual create without navamsa persists neither field", async () => {
        const response = await postManual({ name: "Manual", lagna: 1, houses: { "1": [1] } });

        expect(response.status).toBe(201);
        const payload = mockCD.create.mock.calls[0][0];
        expect("lagnaBhavaSuchika" in payload).toBe(false);
        expect("bhavaSuchika" in payload).toBe(false);
    });

    test("IT-BS-105: manual-chart update re-derives — values track the entered navamsa chart", async () => {
        const response = await putManualChart("manual-1", {
            lagna: 1,
            houses: { "1": [1] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [1] },
        });

        expect(response.status).toBe(200);
        const payload = mockCD.findOneAndUpdate.mock.calls[0][1];
        expect(payload.lagnaBhavaSuchika).toBe(5);
        expect(payload.bhavaSuchika["1"]).toBe(5);
    });

    test("IT-BS-105b: manual-chart update without navamsa persists neither field", async () => {
        const response = await putManualChart("manual-1", { lagna: 1, houses: { "1": [1] } });

        expect(response.status).toBe(200);
        const payload = mockCD.findOneAndUpdate.mock.calls[0][1];
        expect("lagnaBhavaSuchika" in payload).toBe(false);
        expect("bhavaSuchika" in payload).toBe(false);
    });
});

describe("IT-BS-108/109/110: recalculation recomputes, never merges", () => {
    async function runRecalc() {
        mockCD.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ horoscope: { id: "h1" } }]) });
        (AstrologySettings.findById as jest.Mock).mockResolvedValue({
            version: 1,
            recalcStatus: { status: "completed", settingsVersion: 1 },
        });
        (AstrologySettings.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
        mockCD.findOneAndUpdate.mockResolvedValue({});

        const { startRecalculation } = await import("@/lib/recalculationJob");
        await startRecalculation({ settingsVersion: 1, horoscopeIds: ["h1"] });
        return mockCD.findOneAndUpdate.mock.calls;
    }

    test("IT-BS-108: auto recompute carries the computed fields; no overridden key anywhere", async () => {
        (mockHoroscope.findById as jest.Mock).mockResolvedValue({ _id: "h1", source: "auto" });
        mockCD.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        mockedCalculate.mockReturnValue({
            ascendant: { sign: 4, degree: 4.76 },
            lagnaBhavaSuchika: 7,
            bhavaSuchika: { "1": 2 },
            shadbalaya: {},
        });

        const calls = await runRecalc();
        const payload = calls[0][1];
        expect(payload.lagnaBhavaSuchika).toBe(7);
        expect(payload.bhavaSuchika).toEqual({ "1": 2 });
        // No merge artifact: Bhava Suchika fields are plain values and there is no top-level
        // `overridden` key (student toggles only ever live inside shadbalaya cells).
        expect(payload.overridden).toBeUndefined();
        expect(typeof payload.lagnaBhavaSuchika).toBe("number");
        expect(typeof payload.bhavaSuchika["1"]).toBe("number");
    });

    test("IT-BS-109/110: manual recompute derives iff navamsa data (gating survives)", async () => {
        const spyGetCurrentShani = jest.spyOn(manualChartDetails, "getCurrentShani");
        const spyCompute = jest.spyOn(manualChart, "compute");
        const spySynthesize = jest.spyOn(manualChartDetails, "synthesizeCalculation");

        (mockHoroscope.findById as jest.Mock).mockResolvedValue({
            _id: "h1",
            source: "manual",
            birthDate: new Date("1990-06-15"),
        });
        mockCD.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                manualHousePlacements: {
                    lagna: 1,
                    houses: [{ houseNumber: 1, sign: 1, planets: [1], aspects: [] }],
                    navamsaLagna: 5,
                    navamsaHouses: [{ houseNumber: 1, sign: 5, planets: [1], aspects: [] }],
                },
            }),
        });
        spyGetCurrentShani.mockReturnValue(null);
        spyCompute.mockReturnValue({
            manualHousePlacements: {
                lagna: 1,
                houses: [],
                navamsaLagna: 5,
                navamsaHouses: [{ houseNumber: 1, sign: 5, planets: [1], aspects: [] }],
            },
            derivedRanges: {},
            planetsTable: [],
            aspectOptions: {},
        });
        spySynthesize.mockReturnValue({
            lagnaBhavaSuchika: 5,
            bhavaSuchika: { "1": 5 },
            shadbalaya: {},
        });

        const calls = await runRecalc();
        const payload = calls[0][1];
        expect(payload.lagnaBhavaSuchika).toBe(5);
        expect(payload.bhavaSuchika).toEqual({ "1": 5 });
        expect(payload.overridden).toBeUndefined();

        // Without navamsa data the synthesized result has no fields — payload stays clean.
        spySynthesize.mockReturnValue({ shadbalaya: {} });
        const calls2 = await runRecalc();
        const payload2 = calls2[calls2.length - 1][1];
        expect("lagnaBhavaSuchika" in payload2).toBe(false);
        expect("bhavaSuchika" in payload2).toBe(false);
    });
});

describe("IT-BS-112: Shad Bala PATCH never touches Bhava Suchika (regression)", () => {
    test("$set touches only shadbalaya.<planet>.<bala>.* — other fields byte-identical", async () => {
        (mockHoroscope.findById as jest.Mock).mockResolvedValue({ _id: "horo-1", owner: { id: "user-1" } });
        mockCD.findOne.mockResolvedValue({ _id: "cd-1" });
        mockCD.findOneAndUpdate.mockResolvedValue({});

        const { PATCH } = await import("@/app/api/horoscope/[id]/shadbalaya/route");
        const req = { json: jest.fn().mockResolvedValue({ planet: 1, bala: "sthanaBala", value: true }) };
        const response = await PATCH(req as any, { params: Promise.resolve({ id: "horo-1" }) });

        expect(response.status).toBe(200);
        const [, update] = mockCD.findOneAndUpdate.mock.calls[0];
        const set = update.$set as Record<string, unknown>;
        expect(Object.keys(set).every((k) => k.startsWith("shadbalaya."))).toBe(true);
        expect(Object.keys(set)).not.toContain("lagnaBhavaSuchika");
        expect(Object.keys(set)).not.toContain("bhavaSuchika");
    });
});
