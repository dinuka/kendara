import HoroscopeView, { type HoroscopeViewData } from "@/components/horoscopeView/HoroscopeView";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { ChartType } from "@/lib/chartTypes";
import { computeNavamsaLagnaSign } from "@/lib/bhavaSuchika";
import { formatDate } from "@/lib/date";
import { type PublicHoroscopeView, findHoroscopeIdByAlias, getPublicHoroscopeView } from "@/lib/horoscopeView";
import { CHART_IMAGE_SIZE, isObjectId, siteUrl } from "@/lib/seo";

interface PageProps {
    params: Promise<{ id: string }>;
}

/** One cached lookup per request, shared by generateMetadata and the page. */
const loadView = cache((id: string) => getPublicHoroscopeView(id));

const birthChartImageUrl = (id: string, version: string | null): string =>
    `${siteUrl()}/api/horoscope/${id}/chart/${ChartType.BIRTH}/image${version ? `?v=${version}` : ""}`;

const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };

/** Search snippet text: the admin's description, else one generated from the birth details. */
const describe = async (view: PublicHoroscopeView): Promise<{ title: string; description: string }> => {
    const t = await getTranslations();
    const { horoscope } = view.payload;
    const details = view.payload.calculatedDetails as {
        ascendant?: { sign?: number; degree?: number };
        nakshatra?: { moonNakshatra?: { id?: number; pada?: number } };
        manualHousePlacements?: { navamsaLagna?: number };
    } | null;
    const name = horoscope.name;

    const title = view.seo?.title || t("horoscope.seo.titleDefault", { name });

    if (view.seo?.description) return { title, description: view.seo.description };

    const ascendant = details?.ascendant;
    const navamsaLagna =
        details?.manualHousePlacements?.navamsaLagna ??
        (ascendant?.sign && typeof ascendant.degree === "number"
            ? computeNavamsaLagnaSign(ascendant.sign, ascendant.degree)
            : undefined);
    const moon = details?.nakshatra?.moonNakshatra;

    // e.g. "1974-04-08 08:57 Kandy. වෘෂභ ලග්නය මීන නවාංශකය සා නැකත 2 පාදය"
    const birth = [
        horoscope.birthDate && formatDate(horoscope.birthDate),
        horoscope.birthTime,
        horoscope.locationName,
    ].filter(Boolean);
    const chart = [
        ascendant?.sign && t("horoscope.seo.descLagna", { lagna: t(`astrology.signNames.${ascendant.sign}`) }),
        navamsaLagna && t("horoscope.seo.descNavamsa", { sign: t(`astrology.signNames.${navamsaLagna}`) }),
        moon?.id &&
            moon.pada &&
            t("horoscope.seo.descNakshatra", {
                nakshatra: t(`astrology.nakshatraNames.${moon.id}`),
                pada: moon.pada,
            }),
    ].filter(Boolean);
    const description =
        [birth.join(" "), chart.join(" ")].filter(Boolean).join(". ") ||
        t("horoscope.seo.descFallback", { name });
    return { title, description };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    if (!isObjectId(id)) return PRIVATE_METADATA;

    const view = await loadView(id);
    if (!view) return PRIVATE_METADATA;

    const t = await getTranslations();
    const { title, description } = await describe(view);
    const name = view.payload.horoscope.name;
    const canonical = `${siteUrl()}/horoscopes/${id}`;
    // Only the birth chart: link-preview scrapers (Facebook, X, WhatsApp) show just the first og:image
    const images = view.birthChartImage
        ? [
              {
                  url: birthChartImageUrl(id, view.birthChartImage.version),
                  width: CHART_IMAGE_SIZE,
                  height: CHART_IMAGE_SIZE,
                  type: "image/png",
                  alt: t("horoscope.seo.imageAltBirth", { name }),
              },
          ]
        : [];
    const indexed = view.seo?.indexed !== false;

    return {
        title,
        description,
        alternates: { canonical },
        robots: { index: indexed, follow: true },
        openGraph: {
            type: "profile",
            url: canonical,
            siteName: t("app.title"),
            locale: "si_LK",
            alternateLocale: ["en_US"],
            title,
            description,
            images,
        },
        twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
        ...(process.env.FACEBOOK_CLIENT_ID ? { facebook: { appId: process.env.FACEBOOK_CLIENT_ID } } : {}),
    };
}

/** schema.org data for rich results: the person's birth facts and the page's breadcrumb trail. */
const structuredData = async (id: string, view: PublicHoroscopeView, description: string) => {
    const t = await getTranslations();
    const { horoscope } = view.payload;
    const url = `${siteUrl()}/horoscopes/${id}`;
    const person = horoscope.birthDate && {
        "@type": "Person",
        name: horoscope.name,
        birthDate: formatDate(horoscope.birthDate),
        ...(horoscope.locationName ? { birthPlace: { "@type": "Place", name: horoscope.locationName } } : {}),
    };
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": url,
                url,
                name: view.seo?.title || t("horoscope.seo.titleDefault", { name: horoscope.name }),
                description,
                inLanguage: "si",
                dateModified: horoscope.updatedAt,
                ...(person ? { about: person } : {}),
                primaryImageOfPage: view.birthChartImage
                    ? birthChartImageUrl(id, view.birthChartImage.version)
                    : undefined,
            },
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: t("app.title"), item: siteUrl() },
                    { "@type": "ListItem", position: 2, name: t("nav.horoscopes"), item: `${siteUrl()}/horoscopes` },
                    { "@type": "ListItem", position: 3, name: horoscope.name, item: url },
                ],
            },
        ],
    };
};

export default async function HoroscopePage({ params }: PageProps) {
    const { id } = await params;

    // /horoscopes/<alias> (e.g. /horoscopes/mahinda-rajapaksha) → the canonical id URL
    if (!isObjectId(id)) {
        const target = await findHoroscopeIdByAlias(id);
        if (!target) notFound();
        permanentRedirect(`/horoscopes/${target}`);
    }

    const view = await loadView(id);
    // Private (or missing) horoscopes keep the client-only flow: fetch with the viewer's session,
    // sign-in redirect for guests.
    if (!view) return <HoroscopeView key={id} initialData={null} />;

    const { description } = await describe(view);
    const jsonLd = await structuredData(id, view, description);

    return (
        <>
            <script
                type="application/ld+json"
                // JSON.stringify output with "<" escaped cannot break out of the script element
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
            />
            <HoroscopeView
                key={id}
                initialData={view.payload as unknown as HoroscopeViewData}
                seoDescription={view.seo?.description}
            />
        </>
    );
}
