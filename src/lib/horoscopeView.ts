import { unstable_cache } from "next/cache";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { Metadata } from "@/models/Metadata";

import { ChartType } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import { normalizeHoroscopePayload } from "@/lib/horoscopePayload";
import logger from "@/lib/logger";
import { deriveAgeRanges, navamsaIndexForSign } from "@/lib/manualChart";
import { getCurrentShani } from "@/lib/manualChartDetails";
import { anonymizeIfNeeded, visibleHoroscopeFilter } from "@/lib/privacy";
import { HOROSCOPES_TAG, horoscopeTag } from "@/lib/revalidate";
import { type HoroscopeSeo, chartImageVersion, isObjectId } from "@/lib/seo";

/** Calculated details, charts and metadata of a horoscope, with the manual-chart age ranges
 *  re-derived against the current Shani position. Shared by the API route and the server page. */
export const loadHoroscopeDetails = async (
    horoscope: { _id: unknown; source?: string },
    { publicMetadataOnly }: { publicMetadataOnly: boolean },
) => {
    const id = String(horoscope._id);
    const [calculatedDetails, charts, metadata] = await Promise.all([
        CalculatedDetails.findOne({ "horoscope.id": id }).lean(),
        Chart.find({ "horoscope.id": id }).lean(),
        Metadata.find({ "horoscope.id": id, ...(publicMetadataOnly ? { isPublic: true } : {}) }).lean(),
    ]);

    if (horoscope.source === "manual" && calculatedDetails?.planets) {
        const planets = calculatedDetails.planets as Array<{ name: number; sign: number; navamsaSign?: number }>;
        const shani = planets.find((p) => p.name === 7);
        const lagna = calculatedDetails.manualHousePlacements?.lagna ?? 1;
        const currentShani = getCurrentShani(lagna);

        if (shani && currentShani && calculatedDetails.derivedRanges) {
            const navamsaIndex = shani.navamsaSign ? navamsaIndexForSign(shani.sign, shani.navamsaSign) : 1;
            calculatedDetails.derivedRanges.ageRanges = deriveAgeRanges(
                navamsaIndex,
                currentShani.degree,
                currentShani.sign,
                shani.sign,
            );
        }
    }

    return { calculatedDetails, charts, metadata };
};

export interface PublicHoroscopeView {
    /** The `/api/horoscope/[id]` payload as a guest sees it, normalised for the client view. */
    payload: Record<string, unknown> & {
        horoscope: {
            _id: string;
            name: string;
            birthDate?: string;
            birthTime?: string;
            locationName?: string;
            gender?: string;
            source?: string;
            updatedAt?: string;
        };
    };
    seo: HoroscopeSeo | null;
    /** The stored birth chart PNG (the og:image), or null when it has not been rendered yet. */
    birthChartImage: { version: string | null } | null;
    yogaCount: number;
}

/** Navigation for a guest: the public horoscopes in the default (name) order. */
const guestNavigation = async (id: string) => {
    const ordered = await Horoscope.find(visibleHoroscopeFilter(undefined))
        .select({ _id: 1, name: 1, isPublic: 1, displayName: 1, "owner.id": 1 })
        .sort({ name: 1, createdAt: -1 })
        .collation({ locale: "si", strength: 2 })
        .lean();
    const toItem = (h: (typeof ordered)[number] | undefined) =>
        h ? { id: h._id.toString(), name: anonymizeIfNeeded(h).name } : null;
    const index = ordered.findIndex((h) => h._id.toString() === id);
    return {
        prev: toItem(ordered[index - 1]),
        next: toItem(ordered[index + 1]),
        position: index === -1 ? 1 : index + 1,
        total: ordered.length,
    };
};

const loadPublicHoroscopeView = async (id: string): Promise<PublicHoroscopeView | null> => {
    await connectDB();
    const horoscope = await Horoscope.findById(id).lean();
    if (!horoscope?.isPublic) return null;

    logger.debug("building public horoscope view: id=%s", id);
    const { seo, ...rest } = horoscope;
    const guestHoroscope = anonymizeIfNeeded(rest);
    const [details, navigation] = await Promise.all([
        loadHoroscopeDetails(horoscope, { publicMetadataOnly: true }),
        guestNavigation(id),
    ]);

    // JSON round-trip: ObjectIds and Dates become strings, as in the API response
    const payload = normalizeHoroscopePayload(
        JSON.parse(JSON.stringify({ horoscope: guestHoroscope, ...details, navigation })),
    );

    const birthChart = details.charts.find((c) => c.type === ChartType.BIRTH);
    const birthChartImage = birthChart?.imageKey?.endsWith(".png")
        ? { version: chartImageVersion(birthChart.imageKey) }
        : null;
    const yogas = (details.calculatedDetails as { yogas?: unknown[] } | null)?.yogas;

    return {
        payload,
        seo: seo ? JSON.parse(JSON.stringify(seo)) : null,
        birthChartImage,
        yogaCount: Array.isArray(yogas) ? yogas.length : 0,
    };
};

/** Cached guest view of a public horoscope; null when it is missing or private. Invalidated by
 *  `revalidateHoroscope` on every save, and daily so time-dependent ranges stay current. */
/** Bump when the shape of `PublicHoroscopeView` changes, so entries cached in the old shape are not read. */
const VIEW_CACHE_VERSION = "v2";

export const getPublicHoroscopeView = (id: string): Promise<PublicHoroscopeView | null> => {
    if (!isObjectId(id)) return Promise.resolve(null);
    return unstable_cache(() => loadPublicHoroscopeView(id), ["public-horoscope-view", VIEW_CACHE_VERSION, id], {
        tags: [horoscopeTag(id), HOROSCOPES_TAG],
        revalidate: 60 * 60 * 24,
    })();
};

/** Resolves a `/horoscopes/<alias>` segment to the horoscope id it redirects to. */
export const findHoroscopeIdByAlias = async (alias: string): Promise<string | null> => {
    await connectDB();
    const horoscope = await Horoscope.findOne({ "seo.aliases": alias.toLowerCase() }).select({ _id: 1 }).lean();
    return horoscope ? horoscope._id.toString() : null;
};

/** Public, indexable horoscopes for the sitemap. */
export const getSitemapHoroscopes = unstable_cache(
    async (): Promise<Array<{ id: string; updatedAt: string }>> => {
        await connectDB();
        const docs = await Horoscope.find({ isPublic: true, "seo.indexed": { $ne: false } })
            .select({ _id: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .lean();
        return docs.map((d) => ({ id: d._id.toString(), updatedAt: new Date(d.updatedAt).toISOString() }));
    },
    ["sitemap-horoscopes"],
    { tags: [HOROSCOPES_TAG, `${HOROSCOPES_TAG}:list`], revalidate: 60 * 60 },
);
