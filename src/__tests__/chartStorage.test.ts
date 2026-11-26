import { Chart } from "@/models/Chart";

import { deleteChartImages, replaceCharts, storeChartImage } from "@/lib/chartStorage";
import { loadChartRenderer } from "@/lib/chartRendererRuntime";
import { ChartType } from "@/lib/chartTypes";
import { deleteObjects, putObject } from "@/lib/storage";

jest.mock("@/models/Chart", () => ({
    Chart: {
        find: jest.fn(),
        insertMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
    },
}));
jest.mock("@/lib/storage", () => ({
    putObject: jest.fn().mockResolvedValue(undefined),
    getObject: jest.fn(),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/chartImage", () => ({ svgToPng: jest.fn(() => Buffer.from("png")) }));
jest.mock("@/lib/chartRendererRuntime", () => {
    const renderChartSvg = jest.fn(() => "<svg/>");
    return { loadChartRenderer: () => ({ renderChartSvg }) };
});
jest.mock("@/lib/chartDataTransform", () => ({
    getChartData: jest.fn(() => ({})),
    isLeanChartType: jest.fn(() => false),
    toBirthChartData: jest.fn((d) => d),
}));

const mockedPut = putObject as jest.Mock;
const mockedDelete = deleteObjects as jest.Mock;
const mockedFind = Chart.find as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("storeChartImage", () => {
    it("uploads only the PNG and returns its key", async () => {
        const key = await storeChartImage("h1", ChartType.BIRTH, "<svg/>");

        expect(key).toMatch(/^charts\/h1\/birth-\d+\.png$/);
        expect(mockedPut).toHaveBeenCalledTimes(1);
        expect(mockedPut).toHaveBeenCalledWith(key, Buffer.from("png"), "image/png");
    });

    it("returns an empty key instead of throwing when storage fails", async () => {
        mockedPut.mockRejectedValueOnce(new Error("down"));

        await expect(storeChartImage("h1", ChartType.BIRTH, "<svg/>")).resolves.toBe("");
    });
});

describe("replaceCharts", () => {
    it("stores no image for chart types the page has no figure for", async () => {
        mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
        (loadChartRenderer().renderChartSvg as jest.Mock).mockReturnValueOnce(null);

        await replaceCharts("h1", [ChartType.DASAMSA_D10], () => ({}) as never, { isManual: false });

        const [docs] = (Chart.insertMany as jest.Mock).mock.calls[0];
        expect(docs[0].imageKey).toBe("");
        expect(mockedPut).not.toHaveBeenCalled();
    });

    it("saves new docs with image keys, then deletes the previous images", async () => {
        mockedFind.mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ imageKey: "charts/h1/old.png" }, { imageKey: "" }]),
        });

        await replaceCharts("h1", [ChartType.BIRTH], () => ({}) as never, { isManual: false });

        const [docs] = (Chart.insertMany as jest.Mock).mock.calls[0];
        expect(docs[0].imageKey).toMatch(/^charts\/h1\/birth-\d+\.png$/);
        expect(docs[0]).not.toHaveProperty("svgData");
        expect(mockedDelete).toHaveBeenCalledWith(["charts/h1/old.png"]);
        expect((Chart.insertMany as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
            mockedDelete.mock.invocationCallOrder[0],
        );
    });
});

describe("deleteChartImages", () => {
    it("also removes the svg + png of legacy extension-less keys", async () => {
        await deleteChartImages(["charts/h1/new.png", "charts/h1/legacy", ""]);

        expect(mockedDelete).toHaveBeenCalledWith([
            "charts/h1/new.png",
            "charts/h1/legacy.svg",
            "charts/h1/legacy.png",
        ]);
    });
});
