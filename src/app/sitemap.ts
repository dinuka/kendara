import type { MetadataRoute } from "next";

import { getSitemapHoroscopes } from "@/lib/horoscopeView";
import logger from "@/lib/logger";
import { siteUrl } from "@/lib/seo";

/** /sitemap.xml — the public entry pages plus every public, indexable horoscope. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = siteUrl();
    const entries: MetadataRoute.Sitemap = [
        { url: base, changeFrequency: "daily", priority: 1 },
        { url: `${base}/horoscopes`, changeFrequency: "daily", priority: 0.8 },
    ];
    try {
        const horoscopes = await getSitemapHoroscopes();
        for (const h of horoscopes) {
            entries.push({
                url: `${base}/horoscopes/${h.id}`,
                lastModified: h.updatedAt,
                changeFrequency: "monthly",
                priority: 0.7,
            });
        }
    } catch (err) {
        logger.error("sitemap: could not list horoscopes: %s", (err as Error).message);
    }
    return entries;
}
