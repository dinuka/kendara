import { AstrologySettings } from "@/models/AstrologySettings";

import {
    DEFAULT_PLANETARY_ORBS,
    applySettingsUpdate,
    getAstrologySettings,
    getCalculationSettings,
} from "@/lib/astrologySettings";

jest.mock("@/models/AstrologySettings", () => ({
    AstrologySettings: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

const mockedFindById = AstrologySettings.findById as jest.Mock;
const mockedFindByIdAndUpdate = AstrologySettings.findByIdAndUpdate as jest.Mock;

function makeDoc(overrides: Record<string, unknown> = {}) {
    return {
        id: "system",
        planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS },
        rashiAspects: { enabled: true },
        version: 1,
        updatedAt: new Date("2026-08-12T22:00:00.000Z"),
        createdAt: new Date("2026-08-12T22:00:00.000Z"),
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe("getAstrologySettings / getCalculationSettings", () => {
    test("seeds a fresh document via $setOnInsert upsert (US-SAS-007)", async () => {
        mockedFindById.mockResolvedValueOnce(null);
        const seeded = makeDoc();
        mockedFindByIdAndUpdate.mockResolvedValueOnce(seeded);

        const doc = await getAstrologySettings();
        expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
            "system",
            expect.objectContaining({ $setOnInsert: expect.any(Object) }),
            { upsert: true, new: true },
        );
        expect(doc.version).toBe(1);
    });

    test("existing document is returned without a write (idempotent seeding)", async () => {
        const existing = makeDoc();
        mockedFindById.mockResolvedValueOnce(existing);

        const doc = await getAstrologySettings();
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
        expect(doc.version).toBe(1);
    });

    test("getCalculationSettings synthesizes the full consumer shapes (D2)", async () => {
        mockedFindById.mockResolvedValueOnce(makeDoc({ rashiAspects: { enabled: true } }));
        const settings = await getCalculationSettings();
        expect(settings.planetaryOrbs).toEqual(DEFAULT_PLANETARY_ORBS);
        expect(settings.planetAspects).toEqual({});
        expect(settings.rashiAspects).toEqual({ enabled: true, overrides: {} });
    });
});

describe("applySettingsUpdate", () => {
    const changedBy = { id: "admin-1", name: "Dinuka" };

    test("no-op when every provided value equals the current document (US-SAS-002 AC4)", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);

        const result = await applySettingsUpdate({
            version: 1,
            planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS },
            rashiAspects: { enabled: true },
            changedBy,
        });
        expect(result).toEqual({ outcome: "no-op" });
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("no-op when an empty planetAspects is provided and nothing is stored", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);

        const result = await applySettingsUpdate({
            version: 1,
            planetAspects: {},
            changedBy,
        });
        expect(result).toEqual({ outcome: "no-op" });
    });

    test("stale version → conflict (US-SAS-010 AC1)", async () => {
        const doc = makeDoc({ version: 3 });
        mockedFindById.mockResolvedValueOnce(doc);

        const result = await applySettingsUpdate({
            version: 2,
            rashiAspects: { enabled: true },
            changedBy,
        });
        expect(result).toEqual({ outcome: "conflict", reason: "stale" });
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("running recalculation → conflict (US-SAS-010 AC2)", async () => {
        const doc = makeDoc({ recalcStatus: { status: "running", settingsVersion: 2 } });
        mockedFindById.mockResolvedValueOnce(doc);

        const result = await applySettingsUpdate({
            version: 1,
            rashiAspects: { enabled: true },
            changedBy,
        });
        expect(result).toEqual({ outcome: "conflict", reason: "running" });
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("empty subset throws (all-or-nothing, nothing persisted)", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);

        await expect(applySettingsUpdate({ version: 1, changedBy })).rejects.toThrow("no valid setting");
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("invalid planetaryOrbs value rejects the whole payload (US-SAS-002 AC2)", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);

        await expect(
            applySettingsUpdate({ version: 1, planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS, "1": 31 }, changedBy }),
        ).rejects.toThrow("0-30");
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("invalid planetAspects rejects the whole payload", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);

        await expect(
            applySettingsUpdate({ version: 1, planetAspects: { "1": { houses: [7, 7], degrees: [180] } }, changedBy }),
        ).rejects.toThrow("duplicate house");
        expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("real change bumps version, records updatedBy/updatedAt/audit, stamps recalcStatus running", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);
        mockedFindByIdAndUpdate.mockResolvedValueOnce(makeDoc({ version: 2 }));

        const result = await applySettingsUpdate({
            version: 1,
            rashiAspects: { enabled: false, overrides: {} },
            changedBy,
        });

        expect(result.outcome).toBe("updated");
        if (result.outcome !== "updated") return;

        const update = mockedFindByIdAndUpdate.mock.calls[0][1];
        expect(update.$inc).toEqual({ version: 1 });
        expect(update.$set.updatedBy).toEqual({ id: "admin-1" });
        expect(update.$set["recalcStatus.status"]).toBe("running");
        expect(update.$set["recalcStatus.settingsVersion"]).toBe(2);
        expect(update.$set["recalcStatus.processed"]).toBe(0);
        expect(update.$set["recalcStatus.succeeded"]).toBe(0);
        expect(update.$set["recalcStatus.failed"]).toBe(0);
        expect(update.$set["recalcStatus.total"]).toBe(0);
        expect(update.$set.rashiAspects).toEqual({ enabled: false }); // empty overrides omitted (D2)
        expect(update.$set.updatedAt).toBeInstanceOf(Date);
        expect(update.$push.auditLog.$slice).toBe(-100);
        const entry = update.$push.auditLog.$each[0];
        expect(entry.version).toBe(2);
        expect(entry.changedBy).toEqual({ id: "admin-1", name: "Dinuka" });
        expect(entry.changes.rashiAspects).toEqual({ from: { enabled: true }, to: { enabled: false } });
        expect(update.$unset).toEqual({
            "recalcStatus.lastProcessedHoroscopeId": "",
            "recalcStatus.failedHoroscopeIds": "",
            "recalcStatus.error": "",
        });
    });

    test("save clears a stale resume cursor from a prior run (regression)", async () => {
        const doc = makeDoc({
            version: 2,
            recalcStatus: {
                status: "completed",
                settingsVersion: 2,
                lastProcessedHoroscopeId: "h41",
                processed: 41,
                succeeded: 41,
                failed: 0,
            },
        });
        mockedFindById.mockResolvedValueOnce(doc);
        mockedFindByIdAndUpdate.mockResolvedValueOnce(makeDoc({ version: 3 }));

        const result = await applySettingsUpdate({
            version: 2,
            planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS, "1": 10 },
            changedBy,
        });

        expect(result.outcome).toBe("updated");
        const update = mockedFindByIdAndUpdate.mock.calls[0][1];
        expect(update.$unset["recalcStatus.lastProcessedHoroscopeId"]).toBe("");
        expect(update.$set["recalcStatus.settingsVersion"]).toBe(3);
        expect(update.$set["recalcStatus.processed"]).toBe(0);
    });

    test("changing one field keeps the others unchanged (subset semantics, D7)", async () => {
        const doc = makeDoc({ planetAspects: { "3": { houses: [4, 7], degrees: [90, 180] } } });
        mockedFindById.mockResolvedValueOnce(doc);
        mockedFindByIdAndUpdate.mockResolvedValueOnce(makeDoc());

        await applySettingsUpdate({ version: 1, planetaryOrbs: { ...DEFAULT_PLANETARY_ORBS, "1": 10 }, changedBy });

        const update = mockedFindByIdAndUpdate.mock.calls[0][1];
        expect(update.$set.planetaryOrbs).toEqual({ ...DEFAULT_PLANETARY_ORBS, "1": 10 });
        // planetAspects absent from the write — current value preserved
        expect(update.$set.planetAspects).toBeUndefined();
        expect(update.$set.rashiAspects).toBeUndefined();
    });

    test("empty planetAspects overrides an existing stored map ($unset semantics)", async () => {
        const doc = makeDoc({ planetAspects: { "5": { houses: [5, 7], degrees: [120, 180] } } });
        mockedFindById.mockResolvedValueOnce(doc);
        mockedFindByIdAndUpdate.mockResolvedValueOnce(makeDoc());

        const result = await applySettingsUpdate({ version: 1, planetAspects: {}, changedBy });
        expect(result.outcome).toBe("updated");
        const update = mockedFindByIdAndUpdate.mock.calls[0][1];
        expect(update.$set.planetAspects).toBeUndefined();
        expect(update.$unset).toEqual({
            planetAspects: "",
            "recalcStatus.lastProcessedHoroscopeId": "",
            "recalcStatus.failedHoroscopeIds": "",
            "recalcStatus.error": "",
        });
    });

    test("unnormalized planetAspects is sorted/normalized before compare + persist", async () => {
        const doc = makeDoc();
        mockedFindById.mockResolvedValueOnce(doc);
        mockedFindByIdAndUpdate.mockResolvedValueOnce(makeDoc());

        await applySettingsUpdate({
            version: 1,
            planetAspects: { "1": { houses: [10, 3, 7], degrees: [180, 60] } },
            changedBy,
        });

        const update = mockedFindByIdAndUpdate.mock.calls[0][1];
        expect(update.$set.planetAspects).toEqual({
            "1": { houses: [3, 7, 10], degrees: [60, 180] },
        });
    });
});
