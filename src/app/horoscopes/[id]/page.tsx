import HoroscopeView, { type HoroscopeViewData } from "@/components/horoscopeView/HoroscopeView";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { ChartType } from "@/lib/chartTypes";
import { formatDate } from "@/lib/date";
import { type PublicHoroscopeView, findHoroscopeIdByAlias, getPublicHoroscopeView } from "@/lib/horoscopeView";
import { CHART_IMAGE_SIZE, isObjectId, siteUrl } from "@/lib/seo";

interface PageProps {
    params: Promise<{ id: string }>;
}

/** One cached lookup per request, shared by generateMetadata and the page. */
const loadView = cache((id: string) => getPublicHoroscopeView(id));

const chartImageUrl = (id: string, type: ChartType, version: string | null): string =>
    `${siteUrl()}/api/horoscope/${id}/chart/${type}/image${version ? `?v=${version}` : ""}`;

const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };

/** Search snippet text: the admin's description, else one generated from the birth details. */
const describe = async (view: PublicHoroscopeView): Promise<{ title: string; description: string }> => {
    const t = await getTranslations();
    const { horoscope } = view.payload;
    const details = view.payload.calculatedDetails as { ascendant?: { sign?: number } } | null;
    const name = horoscope.name;

    const title = view.seo?.title || t("horoscope.seo.titleDefault", { name });

    if (view.seo?.description) return { title, description: view.seo.description };

    const facts = [
        horoscope.birthDate && t("horoscope.seo.descBirthDate", { date: formatDate(horoscope.birthDate) }),
        horoscope.birthTime && t("horoscope.seo.descBirthTime", { time: horoscope.birthTime }),
        horoscope.locationName && t("horoscope.seo.descBirthPlace", { place: horoscope.locationName }),
        details?.ascendant?.sign &&
            t("horoscope.seo.descLagna", { lagna: t(`astrology.signNames.${details.ascendant.sign}`) }),
    ].filter(Boolean);
    const intro = t("horoscope.seo.descIntro", { name });
    const description = `${intro}${facts.length ? `: ${facts.join(", ")}` : ""}. ${t("horoscope.seo.descTail")}`;
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
    // Facebook uses the first og:image as the primary preview — the birth chart, then the Navamsa
    const images = view.images.map(({ type, version }) => ({
        url: chartImageUrl(id, type, version),
        width: CHART_IMAGE_SIZE,
        height: CHART_IMAGE_SIZE,
        type: "image/png",
        alt: t(type === ChartType.BIRTH ? "horoscope.seo.imageAltBirth" : "horoscope.seo.imageAltNavamsa", { name }),
    }));
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
                primaryImageOfPage: view.images[0] && chartImageUrl(id, view.images[0].type, view.images[0].version),
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
