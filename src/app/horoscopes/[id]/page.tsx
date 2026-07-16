"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Ascendant, House, Planet } from "@/lib/astrology";
import { formatDegree } from "@/lib/astrology";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";

interface HoroscopeData {
    _id: string;
    name: string;
    isPublic: boolean;
    displayName?: boolean;
    birthDate: string;
    birthTime: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    gender?: string;
    ayanamsha?: string;
    owner?: { id: string };
}

interface ChartData {
    type: ChartType;
    svgData: string;
    _id: string;
}

export default function HoroscopeDetailPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const { t, locale } = useI18n();
    const [data, setData] = useState<{
        horoscope: HoroscopeData;
        calculatedDetails: {
            ascendant: Ascendant;
            houses: House[];
            planets: Planet[];
            nakshatra: {
                moonNakshatra?: { id: number; pada: number; lord: number };
                ascendantNakshatra?: { id: number; pada: number; lord: number };
            };
            dashas: unknown;
            lord22ndDrekkana: number;
            lord64thNavamsa: number;
            badhakaPlanet: number[];
            marakaPlanets: number[];
            atmakaraka: number;
            yogas: unknown[];
            doshas: { doshas: unknown[] };
        } | null;
        charts: ChartData[];
        metadata: unknown[];
    } | null>(null);
    const [activeTab, setActiveTab] = useState("charts");
    const [selectedChart, setSelectedChart] = useState<ChartType>(ChartType.BIRTH);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;

        fetch(`/api/horoscope/${params.id}`)
            .then((r) => r.json())
            .then((d) => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [status, params.id, router]);

    if (loading || status === "loading") {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    if (!data) return <div className="text-center py-20 text-gray-400">{t("common.error")}</div>;

    const { horoscope, calculatedDetails, charts } = data;

    const planetNames: Record<number, string> = {
        1: locale === "si" ? "රවි" : "Sun",
        2: locale === "si" ? "සඳ" : "Moon",
        3: locale === "si" ? "කුජ" : "Mars",
        4: locale === "si" ? "බුධ" : "Mercury",
        5: locale === "si" ? "ගුරු" : "Jupiter",
        6: locale === "si" ? "සිකුරු" : "Venus",
        7: locale === "si" ? "ශනි" : "Saturn",
        8: locale === "si" ? "රාහු" : "Rahu",
        9: locale === "si" ? "කේතු" : "Ketu",
    };

    const signNames: Record<number, string> = {
        1: locale === "si" ? "මේෂ" : "Aries",
        2: locale === "si" ? "වෘෂභ" : "Taurus",
        3: locale === "si" ? "මිථුන" : "Gemini",
        4: locale === "si" ? "කටක" : "Cancer",
        5: locale === "si" ? "සිංහ" : "Leo",
        6: locale === "si" ? "කන්යා" : "Virgo",
        7: locale === "si" ? "තුලා" : "Libra",
        8: locale === "si" ? "වෘශ්චික" : "Scorpio",
        9: locale === "si" ? "ධනු" : "Sagittarius",
        10: locale === "si" ? "මකර" : "Capricorn",
        11: locale === "si" ? "කුම්භ" : "Aquarius",
        12: locale === "si" ? "මීන" : "Pisces",
    };

    const nakshatraNames: Record<number, string> = {
        1: locale === "si" ? "අස්විද" : "Ashwini",
        2: locale === "si" ? "බෙරණ" : "Bharani",
        3: locale === "si" ? "කැති" : "Krittika",
        4: locale === "si" ? "රෙහෙණ" : "Rohini",
        5: locale === "si" ? "මුවසිරිස" : "Mrigashira",
        6: locale === "si" ? "අද" : "Ardra",
        7: locale === "si" ? "පුනාවස" : "Punarvasu",
        8: locale === "si" ? "පුස" : "Pushya",
        9: locale === "si" ? "අස්ලිය" : "Ashlesha",
        10: locale === "si" ? "මා" : "Magha",
        11: locale === "si" ? "පුවපල්" : "Purva Phalguni",
        12: locale === "si" ? "උත්‍රපල්" : "Uttara Phalguni",
        13: locale === "si" ? "හත" : "Hasta",
        14: locale === "si" ? "සිත" : "Chitra",
        15: locale === "si" ? "සා" : "Swati",
        16: locale === "si" ? "විසා" : "Vishakha",
        17: locale === "si" ? "අනුර" : "Anuradha",
        18: locale === "si" ? "දෙට" : "Jyestha",
        19: locale === "si" ? "මූල" : "Mula",
        20: locale === "si" ? "පුවසල" : "Purva Aashada",
        21: locale === "si" ? "උත්‍රසල" : "Uttara Aashada",
        22: locale === "si" ? "සුවන" : "Shravana",
        23: locale === "si" ? "දෙනට" : "Dhanishta",
        24: locale === "si" ? "සියාවස" : "Shatabhisha",
        25: locale === "si" ? "පුවපුටුප" : "Purva Bhadrapada",
        26: locale === "si" ? "උත්‍රපුටුප" : "Uttara Bhadrapada",
        27: locale === "si" ? "රේවතී" : "Revati",
    };

    function ordinalSuffix(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    const tabs = [
        { id: "charts", label: t("horoscope.charts") },
        { id: "calculations", label: t("horoscope.calculations") },
        { id: "dashas", label: t("horoscope.dashas") },
        { id: "metadata", label: t("horoscope.metadata") },
    ];

    const chartTypes = ALL_CHART_TYPES;

    return (
        <div>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{horoscope.name}</h1>
                    <p className="text-sm text-gray-500">
                        {new Date(horoscope.birthDate).toLocaleDateString()} {horoscope.birthTime} |{" "}
                        {horoscope.location || `${horoscope.latitude}, ${horoscope.longitude}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    {horoscope.owner?.id === session?.user?.id && (
                        <>
                            <button
                                onClick={() => router.push(`/horoscopes/${params.id}/edit`)}
                                className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                            >
                                {t("horoscope.edit")}
                            </button>
                            <span
                                className={`text-xs px-2 py-1 rounded ${horoscope.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                                {horoscope.isPublic ? t("horoscope.public") : t("horoscope.private")}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-1 mb-6 border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? "border-indigo-600 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "charts" && (
                <div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                        {chartTypes.map((type) => (
                            <button
                                key={type}
                                onClick={() => setSelectedChart(type)}
                                className={`text-xs px-3 py-1.5 border rounded capitalize transition-colors ${
                                    selectedChart === type
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "hover:bg-gray-50"
                                }`}
                            >
                                {type.replace(/-/g, " ")}
                            </button>
                        ))}
                    </div>
                    {(() => {
                        const chart = charts.find((c) => c.type === selectedChart);
                        if (!chart || !chart.svgData) {
                            return (
                                <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                    <p className="text-sm">{t("astrology.noChartData")}</p>
                                </div>
                            );
                        }
                        return (
                            <div
                                className="flex justify-center bg-white rounded-lg border p-4 overflow-auto"
                                dangerouslySetInnerHTML={{ __html: chart.svgData }}
                            />
                        );
                    })()}
                </div>
            )}

            {activeTab === "calculations" && calculatedDetails && (
                <div className="space-y-6">
                    <section className="bg-white rounded-lg border p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded p-3">
                                <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide mb-2">
                                    {t("astrology.ascendant")}
                                </h4>
                                <p className="text-sm mb-1">
                                    {signNames[calculatedDetails.ascendant.sign]} (
                                    {planetNames[calculatedDetails.ascendant.lord]}){" "}
                                    {formatDegree(calculatedDetails.ascendant.degree)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {nakshatraNames[calculatedDetails.nakshatra.ascendantNakshatra?.id ?? 0]} (
                                    {planetNames[calculatedDetails.nakshatra.ascendantNakshatra?.lord ?? 0]}){" "}
                                    {locale === "si"
                                        ? `${calculatedDetails.nakshatra.ascendantNakshatra?.pada} වෙනි පාදය`
                                        : `${ordinalSuffix(calculatedDetails.nakshatra.ascendantNakshatra?.pada ?? 1)} Pada`}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded p-3">
                                <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide mb-2">
                                    {t("astrology.nakshatra")}
                                </h4>
                                <p className="text-sm">
                                    {nakshatraNames[calculatedDetails.nakshatra.moonNakshatra?.id ?? 0]} (
                                    {planetNames[calculatedDetails.nakshatra.moonNakshatra?.lord ?? 0]}){" "}
                                    {locale === "si"
                                        ? `${calculatedDetails.nakshatra.moonNakshatra?.pada} වෙනි පාදය`
                                        : `${ordinalSuffix(calculatedDetails.nakshatra.moonNakshatra?.pada ?? 1)} Pada`}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.houses")}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                        <th className="py-1 pr-3">#</th>
                                        <th className="py-1 pr-3">{t("astrology.sign")}</th>
                                        <th className="py-1 pr-3">{t("astrology.lord")}</th>
                                        <th className="py-1 pr-3">{t("astrology.start")}</th>
                                        <th className="py-1 pr-3">{t("astrology.mid")}</th>
                                        <th className="py-1 pr-3">{t("astrology.end")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculatedDetails.houses.map((h) => (
                                        <tr key={h.houseNumber} className="border-b border-gray-50">
                                            <td className="py-1 pr-3 font-medium">{h.houseNumber}</td>
                                            <td className="py-1 pr-3">{signNames[h.sign] || h.sign}</td>
                                            <td className="py-1 pr-3">{planetNames[h.lord] || h.lord}</td>
                                            <td className="py-1 pr-3 text-gray-500">{formatDegree(h.startDegree)}</td>
                                            <td className="py-1 pr-3 text-gray-500">{formatDegree(h.middleDegree)}</td>
                                            <td className="py-1 pr-3 text-gray-500">{formatDegree(h.endDegree)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.planets")}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                        <th className="py-1 pr-3">{t("astrology.planet")}</th>
                                        <th className="py-1 pr-3">{t("astrology.sign")}</th>
                                        <th className="py-1 pr-3">{t("astrology.degree")}</th>
                                        <th className="py-1 pr-3">{t("astrology.house")}</th>
                                        <th className="py-1 pr-3">{t("astrology.nakshatra")}</th>
                                        <th className="py-1 pr-3">{t("astrology.pada")}</th>
                                        <th className="py-1 pr-3">{t("astrology.retrograde")}</th>
                                        <th className="py-1 pr-3">{t("astrology.combustion")}</th>
                                        <th className="py-1 pr-3">{t("astrology.strength")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculatedDetails.planets.map((p) => (
                                        <tr key={p.name} className="border-b border-gray-50">
                                            <td className="py-1 pr-3 font-medium">{planetNames[p.name]}</td>
                                            <td className="py-1 pr-3">{signNames[p.sign]}</td>
                                            <td className="py-1 pr-3 text-gray-600">{formatDegree(p.degree)}</td>
                                            <td className="py-1 pr-3">{p.house}</td>
                                            <td className="py-1 pr-3 text-gray-600">
                                                {nakshatraNames[p.nakshatra] || p.nakshatra}
                                            </td>
                                            <td className="py-1 pr-3">{p.pada}</td>
                                            <td className="py-1 pr-3">{p.retrograde ? "🔄" : "—"}</td>
                                            <td className="py-1 pr-3">{p.combustion ? "🔥" : "—"}</td>
                                            <td className="py-1 pr-3">
                                                {p.strengthLabel ? t("astrology." + p.strengthLabel) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.aspects")}
                        </h3>
                        {calculatedDetails.planets.map((p) => (
                            <div key={p.name} className="mb-2 text-sm">
                                <span className="font-medium">{planetNames[p.name]}</span>
                                {p.aspects.length === 0 ? (
                                    <span className="text-gray-400 ml-2">{t("astrology.noAspects")}</span>
                                ) : (
                                    <div className="ml-4 mt-1 space-y-0.5">
                                        {p.aspects.map((a, i) => (
                                            <div key={i} className="text-gray-600">
                                                <span className={a.isBeneficial ? "text-green-600" : "text-red-600"}>
                                                    {a.aspectType}°
                                                </span>{" "}
                                                → {planetNames[a.planetName]}
                                                <span className="text-gray-400 text-xs ml-1">
                                                    ({t("astrology.orb")}: {a.degreeGap}°)
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.strengthsSpecialLords")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="bg-gray-50 rounded p-3">
                                <span className="text-gray-500">{t("astrology.drekkanaLord")}</span>
                                <p className="font-medium">{planetNames[calculatedDetails.lord22ndDrekkana] || "-"}</p>
                            </div>
                            <div className="bg-gray-50 rounded p-3">
                                <span className="text-gray-500">{t("astrology.navamsaLord")}</span>
                                <p className="font-medium">{planetNames[calculatedDetails.lord64thNavamsa] || "-"}</p>
                            </div>
                            <div className="bg-gray-50 rounded p-3">
                                <span className="text-gray-500">{t("astrology.atmakaraka")}</span>
                                <p className="font-medium">{planetNames[calculatedDetails.atmakaraka] || "-"}</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.marakaBadhaka")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 rounded p-3">
                                <span className="text-gray-500">{t("astrology.marakaPlanets")}</span>
                                <p className="font-medium">
                                    {calculatedDetails.marakaPlanets?.map((p: number) => planetNames[p]).join(", ") ||
                                        "-"}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded p-3">
                                <span className="text-gray-500">{t("astrology.badhakaPlanets")}</span>
                                <p className="font-medium">
                                    {calculatedDetails.badhakaPlanet?.map((p: number) => planetNames[p]).join(", ") ||
                                        "-"}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "dashas" && calculatedDetails && (
                <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-2">{t("astrology.dashas")}</h3>
                    <pre className="text-xs text-gray-600 overflow-auto">
                        {JSON.stringify(calculatedDetails.dashas, null, 2)}
                    </pre>
                </div>
            )}

            {activeTab === "metadata" && (
                <div className="bg-white rounded-lg border p-6 text-center text-gray-400">
                    <p>{t("horoscope.metadata")}</p>
                </div>
            )}
        </div>
    );
}
