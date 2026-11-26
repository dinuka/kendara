import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

/** /robots.txt — API routes are off-limits except the chart PNGs used as og:image / image search. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/api/horoscope/*/chart/*/image", "/api/share/*/chart/*/image"],
            disallow: ["/api/", "/admin", "/settings", "/signin", "/locations", "/horoscopes/new"],
        },
        sitemap: `${siteUrl()}/sitemap.xml`,
    };
}
