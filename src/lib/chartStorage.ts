import { Chart } from "@/models/Chart";

import type { CalculationResult } from "@/lib/astrology";
import { getChartData, isLeanChartType, toBirthChartData } from "@/lib/chartDataTransform";
import { svgToPng } from "@/lib/chartImage";
import { loadChartRenderer } from "@/lib/chartRendererRuntime";
import type { ChartRenderContext } from "@/lib/chartSvg";
import { ChartType } from "@/lib/chartTypes";
import logger from "@/lib/logger";
import { deleteObjects, getObject, putObject } from "@/lib/storage";

/** A Chart's `imageKey` is the object key of its PNG, e.g. `charts/<horoscopeId>/birth-1764160000000.png`.
 *  The SVG is only an in-memory step towards the PNG and is never stored. */
const PNG_CONTENT_TYPE = "image/png";

/** Object keys to delete for a stored `imageKey`. Legacy keys (no extension) had an `.svg` and a `.png`. */
const objectKeysOf = (imageKey: string): string[] =>
    imageKey.endsWith(".png") ? [imageKey] : [`${imageKey}.svg`, `${imageKey}.png`];

/** Converts the chart SVG to PNG, uploads it and returns its key, or "" if that failed — a storage
 *  outage must not block saving the horoscope itself. */
export const storeChartImage = async (horoscopeId: string, type: ChartType, svg: string): Promise<string> => {
    const imageKey = `charts/${horoscopeId}/${type}-${Date.now()}.png`;
    try {
        await putObject(imageKey, svgToPng(svg), PNG_CONTENT_TYPE);
        return imageKey;
    } catch (err) {
        logger.error({ err }, "chart image upload failed: horoscope=%s type=%s", horoscopeId, type);
        return "";
    }
};

/** Renders the chart SVG from the D1 calculation; null when the type has no figure or rendering
 *  failed — a broken image must never block saving the horoscope. */
const renderSvgSafely = (
    horoscopeId: string,
    type: ChartType,
    d1: CalculationResult,
    ctx: ChartRenderContext,
): string | null => {
    try {
        return loadChartRenderer().renderChartSvg(type, d1, ctx);
    } catch (err) {
        logger.error({ err }, "chart svg render failed: horoscope=%s type=%s", horoscopeId, type);
        return null;
    }
};

/** Renders a chart (as the page draws it, from the D1 calculation) and stores it as PNG. Returns the
 *  image key, or "" when the type has no figure or rendering/upload failed. */
export const renderAndStoreChartImage = async (
    horoscopeId: string,
    type: ChartType,
    d1: CalculationResult,
    ctx: ChartRenderContext,
): Promise<string> => {
    const svg = renderSvgSafely(horoscopeId, type, d1, ctx);
    return svg ? storeChartImage(horoscopeId, type, svg) : "";
};

/** Builds Chart documents for the given types, uploading each chart's PNG to object storage. */
export const buildChartDocs = (
    horoscopeId: string,
    types: ChartType[],
    sourceOf: (type: ChartType) => CalculationResult,
    ctx: ChartRenderContext,
) =>
    Promise.all(
        types.map(async (type) => {
            const chartData = getChartData(sourceOf(type), type);
            return {
                horoscope: { id: horoscopeId },
                type,
                data: isLeanChartType(type) ? toBirthChartData(chartData) : chartData,
                // images mirror the page, which draws every figure from the D1 calculation
                imageKey: await renderAndStoreChartImage(horoscopeId, type, sourceOf(ChartType.BIRTH), ctx),
            };
        }),
    );

/** Deletes stored images by key. Failures are logged, never thrown — orphaned objects are harmless. */
export const deleteChartImages = async (imageKeys: string[]): Promise<void> => {
    try {
        await deleteObjects(imageKeys.filter(Boolean).flatMap(objectKeysOf));
    } catch (err) {
        logger.warn({ err }, "chart image cleanup failed for %d keys", imageKeys.length);
    }
};

const existingImageKeys = async (horoscopeId: string): Promise<string[]> => {
    const charts = await Chart.find({ "horoscope.id": horoscopeId }, { imageKey: 1 }).lean();
    return charts.map((c) => c.imageKey);
};

/** Creates the Chart docs of a new horoscope. */
export const createCharts = async (
    horoscopeId: string,
    types: ChartType[],
    sourceOf: (type: ChartType) => CalculationResult,
    ctx: ChartRenderContext,
): Promise<void> => {
    await Chart.insertMany(await buildChartDocs(horoscopeId, types, sourceOf, ctx));
};

/** Replaces every stored Chart doc of a horoscope with freshly generated ones. New images are uploaded
 *  first (under new keys), old images are removed only after the new docs are saved. */
export const replaceCharts = async (
    horoscopeId: string,
    types: ChartType[],
    sourceOf: (type: ChartType) => CalculationResult,
    ctx: ChartRenderContext,
): Promise<void> => {
    const oldKeys = await existingImageKeys(horoscopeId);
    const chartDocs = await buildChartDocs(horoscopeId, types, sourceOf, ctx);
    await Chart.deleteMany({ "horoscope.id": horoscopeId });
    await Chart.insertMany(chartDocs);
    await deleteChartImages(oldKeys);
};

/** Deletes every Chart doc of a horoscope and its stored images. */
export const deleteCharts = async (horoscopeId: string): Promise<void> => {
    const oldKeys = await existingImageKeys(horoscopeId);
    await Chart.deleteMany({ "horoscope.id": horoscopeId });
    await deleteChartImages(oldKeys);
};

/** Streams a stored chart PNG back to the client, or a JSON error when it isn't available. */
export const chartImageResponse = async (
    chart: { imageKey?: string; type: string } | null,
    { cacheControl, download }: { cacheControl: string; download: boolean },
): Promise<Response> => {
    if (!chart) return Response.json({ error: "Not found" }, { status: 404 });
    // legacy extension-less keys predate PNG-only storage — run `pnpm regenerate-chart-images`
    if (!chart.imageKey?.endsWith(".png")) return Response.json({ error: "Chart image not generated" }, { status: 404 });

    const body = await getObject(chart.imageKey);
    if (!body) {
        logger.warn("chart image missing in storage: key=%s", chart.imageKey);
        return Response.json({ error: "Chart image not found" }, { status: 404 });
    }

    const headers: Record<string, string> = {
        "Content-Type": PNG_CONTENT_TYPE,
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
    };
    if (download) headers["Content-Disposition"] = `attachment; filename="${chart.type}-chart.png"`;
    return new Response(new Uint8Array(body), { headers });
};
