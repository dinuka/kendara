import { AstrologySettings } from "@/models/AstrologySettings";
import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";

import { DEFAULT_PLANETARY_ORBS } from "@/lib/astrologySettings";
import { calculateHoroscope } from "@/lib/calculation";
import { compute, manualPlacementsToInput } from "@/lib/manualChart";
import { getCurrentShani, sanitizeManualHousePlacements, synthesizeCalculation } from "@/lib/manualChartDetails";
import { startRecalculation } from "@/lib/recalculationJob";

jest.mock("@/models/AstrologySettings", () => ({
    AstrologySettings: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));
jest.mock("@/models/CalculatedDetails", () => ({
    CalculatedDetails: {
        find: jest.fn(() => ({ lean: jest.fn() })),
        findOne: jest.fn(() => ({ lean: jest.fn() })),
        findOneAndUpdate: jest.fn(),
    },
}));
jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn() },
}));
jest.mock("@/lib/db", () => ({
    connectDB: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/calculation", () => ({
    calculateHoroscope: jest.fn(),
}));
jest.mock("@/lib/manualChart", () => ({
    compute: jest.fn(),
    manualPlacementsToInput: jest.fn(),
}));
jest.mock("@/lib/manualChartDetails", () => ({
    getCurrentShani: jest.fn(),
    sanitizeManualHousePlacements: jest.fn(),
    synthesizeCalculation: jest.fn(),
    synthesizeNavamsaCalculation: jest.fn(),
}));

const mockedSettingsFindById = AstrologySettings.findById as jest.Mock;
const mockedSettingsFindByIdAndUpdate = AstrologySettings.findByIdAndUpdate as jest.Mock;
const mockedCalculate = calculateHoroscope as jest.Mock;
const mockedCD = CalculatedDetails as unknown as {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
};
const mockedHoroscopeFindById = Horoscope.findById as jest.Mock;
const mockedCompute = compute as jest.Mock;
const mockedManualPlacementsToInput = manualPlacementsToInput as jest.Mock;
const mockedSanitize = sanitizeManualHousePlacements as jest.Mock;
const mockedSynthesize = synthesizeCalculation as jest.Mock;
const mockedGetCurrentShani = getCurrentShani as jest.Mock;

function makeDoc(overrides: Record<string, unknown> = {}) {
    return {
        id: "system",
        planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS },
        rashiAspects: { enabled: true },
        version: 1,
        updatedAt: new Date("2026-08-12T22:00:00.000Z"),
        ...overrides,
    };
}

function mockSnapshot(ids: string[]) {
    mockedCD.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(ids.map((id) => ({ horoscope: { id } }))) });
}

/** Each element of `docs` is returned in sequence by every `getAstrologySettings()` call. */
function mockSettingsSequence(docs: ReturnType<typeof makeDoc>[]) {
    let i = 0;
    mockedSettingsFindById.mockImplementation(async () => docs[Math.min(i++, docs.length - 1)]);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedSettingsFindByIdAndUpdate.mockResolvedValue(makeDoc());
    mockedGetCurrentShani.mockReturnValue({ sign: 7, degree: 20 });
    mockedSanitize.mockImplementation((p: unknown) => p);
    mockedCalculate.mockReturnValue({ ascendant: { sign: 1, degree: 0 }, houses: [] });
});

describe("startRecalculation", () => {
    test("completed run for the same version is a no-op (US-SAS-004 AC2)", async () => {
        const doc = makeDoc({ recalcStatus: { status: "completed", settingsVersion: 1 } });
        mockSettingsSequence([doc]);

        await startRecalculation({ settingsVersion: 1 });

        expect(mockedSettingsFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("zero horoscopes completes immediately with 0/0 and sets lastRecalculatedAt (US-SAS-003)", async () => {
        const doc = makeDoc();
        mockSettingsSequence([doc]);
        mockSnapshot([]);

        await startRecalculation({ settingsVersion: 1 });

        const calls = mockedSettingsFindByIdAndUpdate.mock.calls;
        expect(calls.length).toBe(2);
        const initial = calls[0][1].$set.recalcStatus;
        expect(initial).toMatchObject({ status: "running", settingsVersion: 1, total: 0 });
        const final = calls[1][1].$set;
        expect(final["recalcStatus.status"]).toBe("completed");
        expect(final.lastRecalculatedAt).toBeInstanceOf(Date);
        expect(calls[1][1].$unset["recalcStatus.lastProcessedHoroscopeId"]).toBe("");
        const historyEntry = calls[1][1].$push.recalcHistory.$each[0];
        expect(historyEntry).toMatchObject({ settingsVersion: 1, total: 0, succeeded: 0, failed: 0 });
        expect(calls[1][1].$push.recalcHistory.$slice).toBe(-20);
    });

    test("auto horoscope is recomputed via calculateHoroscope and persisted in place", async () => {
        const doc = makeDoc();
        mockSettingsSequence([doc, doc, doc]);
        mockSnapshot(["h1"]);
        mockedHoroscopeFindById.mockResolvedValue({
            _id: "h1",
            source: "auto",
            name: "Test",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            birthTime: "12:00",
            latitude: 7,
            longitude: 80,
            ayanamsha: "lahiri",
        });

        await startRecalculation({ settingsVersion: 1 });

        const saveCall = mockedCD.findOneAndUpdate.mock.calls[0];
        expect(saveCall[0]).toEqual({ "horoscope.id": "h1" });
        expect(saveCall[2]).toEqual({ upsert: true });
        expect(saveCall[1]).toMatchObject({ ascendant: expect.anything(), houses: expect.any(Array) });

        const final = mockedSettingsFindByIdAndUpdate.mock.calls.at(-1)[1].$set;
        expect(final["recalcStatus.status"]).toBe("completed");
        expect(final["recalcStatus.succeeded"]).toBe(1);
        expect(final["recalcStatus.failed"]).toBe(0);
    });

    test("manual horoscope recomputes from stored manualHousePlacements with system aspect options", async () => {
        const doc = makeDoc({ rashiAspects: { enabled: true } });
        mockSettingsSequence([doc, doc, doc]);
        mockSnapshot(["m1"]);
        mockedHoroscopeFindById.mockResolvedValue({
            _id: "m1",
            source: "manual",
            name: "Manual",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
        });
        mockedCD.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                manualHousePlacements: {
                    lagna: 1,
                    houses: [{ houseNumber: 1, sign: 1, planets: [1, 2] }],
                    validation: {},
                },
            }),
        });
        const input = { lagna: 1, houses: { 1: [1, 2] } };
        mockedManualPlacementsToInput.mockReturnValue(input);
        const result = { manualHousePlacements: { lagna: 1 }, derivedRanges: { ageRanges: [] } };
        mockedCompute.mockReturnValue(result);
        mockedSynthesize.mockReturnValue({ ascendant: { sign: 1, degree: 0 } });

        await startRecalculation({ settingsVersion: 1 });

        expect(mockedCompute).toHaveBeenCalledWith(
            expect.objectContaining({
                lagna: 1,
                aspectOptions: {
                    planetaryOrbs: DEFAULT_PLANETARY_ORBS,
                    planetAspects: {},
                    rashiAspects: { enabled: true, overrides: {} },
                },
            }),
            { sign: 7, degree: 20 },
        );
        expect(mockedSynthesize).toHaveBeenCalledWith(result, expect.any(Date));
        const saveCall = mockedCD.findOneAndUpdate.mock.calls[0];
        expect(saveCall[1]).toMatchObject({ ascendant: { sign: 1, degree: 0 } });
        expect(saveCall[1].manualHousePlacements).toBeDefined();
        expect(saveCall[1].derivedRanges).toEqual({ ageRanges: [] });
    });

    test("a throwing horoscope is counted as failed and does not abort the run (US-SAS-004 AC5)", async () => {
        const doc = makeDoc();
        mockSettingsSequence([doc, doc, doc]);
        mockSnapshot(["ok", "bad"]);
        mockedHoroscopeFindById.mockImplementation(async (id: string) => {
            if (id === "ok") {
                return {
                    _id: id,
                    source: "auto",
                    name: "Ok",
                    birthDate: new Date("1990-01-01T00:00:00.000Z"),
                    birthTime: "12:00",
                    latitude: 7,
                    longitude: 80,
                    ayanamsha: "lahiri",
                };
            }
            throw new Error("boom");
        });

        await startRecalculation({ settingsVersion: 1 });

        const final = mockedSettingsFindByIdAndUpdate.mock.calls.at(-1)[1].$set;
        expect(final["recalcStatus.status"]).toBe("completed");
        expect(final["recalcStatus.succeeded"]).toBe(1);
        expect(final["recalcStatus.failed"]).toBe(1);
        expect(final["recalcStatus.failedHoroscopeIds"]).toEqual(["bad"]);
    });

    test("resumes from lastProcessedHoroscopeId when status is running for the same version", async () => {
        const doc = makeDoc({
            recalcStatus: {
                status: "running",
                settingsVersion: 1,
                lastProcessedHoroscopeId: "h1",
                processed: 1,
            },
        });
        mockSettingsSequence([doc, doc]);
        mockSnapshot(["h1", "h2", "h3"]);
        mockedHoroscopeFindById.mockImplementation(async (id: string) => ({
            _id: id,
            source: "auto",
            name: id,
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            birthTime: "12:00",
            latitude: 7,
            longitude: 80,
            ayanamsha: "lahiri",
        }));

        await startRecalculation({ settingsVersion: 1 });

        expect(mockedCD.findOneAndUpdate.mock.calls.map((c) => c[0]["horoscope.id"])).toEqual(["h2", "h3"]);
    });

    test("running status without a resume cursor starts a fresh full run (regression)", async () => {
        // Mirrors the state left by applySettingsUpdate after a save: status pre-stamped
        // "running" for the new version but with no cursor and zeroed counters.
        const doc = makeDoc({
            recalcStatus: {
                status: "running",
                settingsVersion: 1,
                processed: 41,
                succeeded: 41,
                failed: 0,
            },
        });
        mockSettingsSequence([doc, doc, doc]);
        mockSnapshot(["h1", "h2"]);
        mockedHoroscopeFindById.mockImplementation(async (id: string) => ({
            _id: id,
            source: "auto",
            name: id,
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            birthTime: "12:00",
            latitude: 7,
            longitude: 80,
            ayanamsha: "lahiri",
        }));

        await startRecalculation({ settingsVersion: 1 });

        expect(mockedCD.findOneAndUpdate.mock.calls.map((c) => c[0]["horoscope.id"])).toEqual(["h1", "h2"]);
        const initial = mockedSettingsFindByIdAndUpdate.mock.calls[0][1].$set.recalcStatus;
        expect(initial).toMatchObject({ status: "running", settingsVersion: 1, total: 2, processed: 0 });
    });

    test("stale-run guard stops when the document version moved on (US-SAS-010 AC3)", async () => {
        const doc = makeDoc({ version: 1 });
        const newer = makeDoc({ version: 2 });
        mockSettingsSequence([doc, newer]);
        mockSnapshot(["h1"]);
        mockedHoroscopeFindById.mockResolvedValue({
            _id: "h1",
            source: "auto",
            name: "Stale",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            birthTime: "12:00",
            latitude: 7,
            longitude: 80,
            ayanamsha: "lahiri",
        });

        await startRecalculation({ settingsVersion: 1 });

        expect(mockedCD.findOneAndUpdate).not.toHaveBeenCalled();
        // The run persisted only its initial running status — never a completion.
        const statusSets = mockedSettingsFindByIdAndUpdate.mock.calls.map(
            (c) => c[1].$set?.["recalcStatus.status"] ?? c[1].$set?.recalcStatus?.status,
        );
        expect(statusSets).toEqual(["running"]);
    });

    test("targeted run over a failed subset (OQ11 retry)", async () => {
        const doc = makeDoc();
        mockSettingsSequence([doc, doc]);
        mockedHoroscopeFindById.mockImplementation(async (id: string) => {
            if (id === "bad") throw new Error("still failing");
            return {
                _id: id,
                source: "auto",
                name: id,
                birthDate: new Date("1990-01-01T00:00:00.000Z"),
                birthTime: "12:00",
                latitude: 7,
                longitude: 80,
                ayanamsha: "lahiri",
            };
        });

        await startRecalculation({ horoscopeIds: ["bad", "recovered"] });

        const final = mockedSettingsFindByIdAndUpdate.mock.calls.at(-1)[1].$set;
        expect(final["recalcStatus.total"]).toBe(2);
        expect(final["recalcStatus.succeeded"]).toBe(1);
        expect(final["recalcStatus.failed"]).toBe(1);
        expect(final["recalcStatus.failedHoroscopeIds"]).toEqual(["bad"]);
    });
});
