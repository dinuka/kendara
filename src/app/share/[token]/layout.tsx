import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";
import { ShareLink } from "@/models/ShareLink";

import { ChartType } from "@/lib/chartTypes";
import { connectDB } from "@/lib/db";
import { anonymizeIfNeeded } from "@/lib/privacy";
import { CHART_IMAGE_SIZE, chartImageVersion, siteUrl } from "@/lib/seo";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ token: string }>;
}

/** Share links expire and duplicate the horoscope page, so they are never indexed — but they still
 *  carry Open Graph tags so a pasted link previews with the birth chart image. */
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
    const { token } = await params;
    const robots = { index: false, follow: false };

    await connectDB();
    const link = await ShareLink.findOne({ token }).lean();
    if (!link || new Date() > link.expiresAt) return { robots };

    const horoscope = await Horoscope.findById(link.horoscope.id).lean();
    if (!horoscope) return { robots };

    const t = await getTranslations();
    const name = anonymizeIfNeeded(horoscope).name;
    const title = t("horoscope.seo.titleDefault", { name });
    const chart = await Chart.findOne(
        { "horoscope.id": link.horoscope.id, type: ChartType.BIRTH },
        { imageKey: 1 },
    ).lean();

    // Only the birth chart: link-preview scrapers (Facebook, X, WhatsApp) show just the first og:image
    const version = chart?.imageKey?.endsWith(".png") ? chartImageVersion(chart.imageKey) : undefined;
    const images =
        version === undefined
            ? []
            : [
                  {
                      url: `${siteUrl()}/api/share/${token}/chart/${ChartType.BIRTH}/image${version ? `?v=${version}` : ""}`,
                      width: CHART_IMAGE_SIZE,
                      height: CHART_IMAGE_SIZE,
                      type: "image/png",
                      alt: t("horoscope.seo.imageAltBirth", { name }),
                  },
              ];

    return {
        title,
        robots,
        ...(horoscope.isPublic ? { alternates: { canonical: `/horoscopes/${horoscope._id.toString()}` } } : {}),
        openGraph: { type: "profile", title, url: `${siteUrl()}/share/${token}`, images },
        twitter: { card: "summary_large_image", title, images: images.map((i) => i.url) },
    };
}

export default function ShareLayout({ children }: LayoutProps) {
    return children;
}
