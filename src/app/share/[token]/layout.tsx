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
 *  carry Open Graph tags so a pasted link previews with the birth chart and Navamsa images. */
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
    const charts = await Chart.find(
        { "horoscope.id": link.horoscope.id, type: { $in: [ChartType.BIRTH, ChartType.NAVAMSA_D9] } },
        { imageKey: 1, type: 1 },
    ).lean();

    const images = [ChartType.BIRTH, ChartType.NAVAMSA_D9].flatMap((type) => {
        const chart = charts.find((c) => c.type === type);
        if (!chart?.imageKey?.endsWith(".png")) return [];
        const version = chartImageVersion(chart.imageKey);
        return [
            {
                url: `${siteUrl()}/api/share/${token}/chart/${type}/image${version ? `?v=${version}` : ""}`,
                width: CHART_IMAGE_SIZE,
                height: CHART_IMAGE_SIZE,
                type: "image/png",
                alt: t(type === ChartType.BIRTH ? "horoscope.seo.imageAltBirth" : "horoscope.seo.imageAltNavamsa", {
                    name,
                }),
            },
        ];
    });

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
