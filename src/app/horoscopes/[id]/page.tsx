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
    const { t } = useI18n();
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
    const [orbMap, setOrbMap] = useState<Record<number, number>>({
        1: 15, 2: 12, 3: 8, 4: 7, 5: 9, 6: 7, 7: 9, 8: 0, 9: 0,
    });

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

        fetch("/api/settings")
            .then((r) => r.json())
            .then((data) => {
                if (data.planetaryOrbs) {
                    const parsed: Record<number, number> = {};
                    for (const [k, v] of Object.entries(data.planetaryOrbs)) {
                        parsed[Number(k)] = v as number;
                    }
                    setOrbMap(parsed);
                }
            })
            .catch(() => {});
    }, [status, params.id, router]);

    if (loading || status === "loading") {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    if (!data) return <div className="text-center py-20 text-gray-400">{t("common.error")}</div>;

    const { horoscope, calculatedDetails, charts } = data;

    const getPlanetName = (id: number): string => t(`astrology.planetNames.${id}`);
    const getSignName = (id: number): string => t(`astrology.signNames.${id}`);
    const getNakshatraName = (id: number): string => t(`astrology.nakshatraNames.${id}`);
    const getPadaFormat = (pada: number): string => t("astrology.padaFormat", { pada: String(pada) });

    const SIGN_LORD_MAP: Record<number, number> = {
        1: 3, 2: 6, 3: 4, 4: 2, 5: 1, 6: 4,
        7: 6, 8: 3, 9: 5, 10: 7, 11: 7, 12: 5,
    };

    const formatSignLordDegree = (sign: number | undefined, lord: number | undefined, deg: number, fallbackSign?: number, fallbackLord?: number): string => {
        const s = sign ?? fallbackSign ?? 1;
        const l = lord ?? fallbackLord ?? SIGN_LORD_MAP[s] ?? 1;
        return `${getSignName(s)}(${getPlanetName(l)}) ${formatDegree(deg)}`;
    };

    const getPlanetsInHouse = (houseNumber: number): Planet[] => {
        if (!calculatedDetails?.planets) return [];
        return calculatedDetails.planets.filter((p) => p.house === houseNumber);
    };

    const getAspectsToHouse = (houseNumber: number): { planet: Planet; aspectType: number }[] => {
        if (!calculatedDetails?.planets) return [];
        const aspects: { planet: Planet; aspectType: number }[] = [];
        calculatedDetails.planets.forEach((p) => {
            const planetHouse = p.house;
            const diff = ((houseNumber - planetHouse + 12) % 12);
            const specialAspects: Record<number, number[]> = {
                1: [2, 9], 2: [2, 9], 7: [2, 9],
                3: [3, 7], 4: [3, 7],
                5: [4, 8], 6: [4, 8],
            };
            if (diff === 6) {
                aspects.push({ planet: p, aspectType: 180 });
            } else if (specialAspects[p.name]?.includes(diff)) {
                aspects.push({ planet: p, aspectType: diff === 4 ? 120 : diff === 8 ? 240 : diff === 3 ? 90 : diff === 7 ? 210 : diff === 2 ? 60 : diff === 9 ? 270 : 0 });
            }
        });
        return aspects;
    };

    const getHouseMidAbs = (h: House): number => {
        const sign = h.middleSign ?? h.sign ?? 1;
        return (sign - 1) * 30 + (h.middleDegree ?? 0);
    };

    const getAspectDiff = (planetAbsDeg: number, aspectType: number, houseMidAbsDeg: number): number => {
        const exactAspectPoint = (planetAbsDeg + aspectType) % 360;
        let diff = exactAspectPoint - houseMidAbsDeg;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    };

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
                                    {getSignName(calculatedDetails.ascendant.sign)} (
                                    {getPlanetName(calculatedDetails.ascendant.lord)}){" "}
                                    {formatDegree(calculatedDetails.ascendant.degree)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {getNakshatraName(calculatedDetails.nakshatra.ascendantNakshatra?.id ?? 0)} (
                                    {getPlanetName(calculatedDetails.nakshatra.ascendantNakshatra?.lord ?? 0)}){" "}
                                    {getPadaFormat(calculatedDetails.nakshatra.ascendantNakshatra?.pada ?? 1)}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded p-3">
                                <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide mb-2">
                                    {t("astrology.nakshatra")}
                                </h4>
                                <p className="text-sm">
                                    {getNakshatraName(calculatedDetails.nakshatra.moonNakshatra?.id ?? 0)} (
                                    {getPlanetName(calculatedDetails.nakshatra.moonNakshatra?.lord ?? 0)}){" "}
                                    {getPadaFormat(calculatedDetails.nakshatra.moonNakshatra?.pada ?? 1)}
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
                                        <th className="py-1 pr-3">{t("astrology.start")}</th>
                                        <th className="py-1 pr-3">{t("astrology.mid")}</th>
                                        <th className="py-1 pr-3">{t("astrology.end")}</th>
                                        <th className="py-1 pr-3">{t("astrology.planets")}</th>
                                        <th className="py-1 pr-3">{t("astrology.aspects")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculatedDetails.houses.map((h) => {
                                        const planetsInHouse = getPlanetsInHouse(h.houseNumber);
                                        const houseMidAbs = getHouseMidAbs(h);
                                        const aspectsToHouse = getAspectsToHouse(h.houseNumber)
                                            .map((a) => ({
                                                ...a,
                                                diff: getAspectDiff(a.planet.absoluteDegree, a.aspectType, houseMidAbs),
                                            }))
                                            .filter((a) => Math.abs(a.diff) <= (orbMap[a.planet.name] ?? 0) / 2)
                                            .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
                                        return (
                                            <tr key={h.houseNumber} className="border-b border-gray-50">
                                                <td className="py-1 pr-3 font-medium">{h.houseNumber}</td>
                                                <td className="py-1 pr-3 text-gray-600">{formatSignLordDegree(h.startSign, h.startLord, h.startDegree, h.sign, h.lord)}</td>
                                                <td className="py-1 pr-3 text-gray-600">{formatSignLordDegree(h.middleSign, h.middleLord, h.middleDegree, h.sign, h.lord)}</td>
                                                <td className="py-1 pr-3 text-gray-600">{formatSignLordDegree(h.endSign, h.endLord, h.endDegree, h.sign, h.lord)}</td>
                                                <td className="py-1 pr-3">
                                                    {planetsInHouse.length > 0
                                                        ? planetsInHouse.map((p) => `${getPlanetName(p.name)} (${formatDegree(p.degree)})`).join(", ")
                                                        : "—"}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {aspectsToHouse.length > 0
                                                        ? aspectsToHouse.map((a) => {
                                                            const sign = a.diff >= 0 ? "+" : "-";
                                                            const absDiff = Math.abs(a.diff);
                                                            const totalVikala = Math.round(absDiff * 3600);
                                                            const anshaka = Math.floor(totalVikala / 3600);
                                                            const kala = Math.floor((totalVikala % 3600) / 60);
                                                            const vikala = totalVikala % 60;
                                                            return `${getPlanetName(a.planet.name)} (${sign}${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")})`;
                                                        }).join(", ")
                                                        : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                                        <th className="py-1 pr-3">{t("astrology.sign")} ({t("astrology.degree")})</th>
                                        <th className="py-1 pr-3">{t("astrology.house")}</th>
                                        <th className="py-1 pr-3">{t("astrology.nakshatra")} ({t("astrology.pada")})</th>
                                        <th className="py-1 pr-3">{t("astrology.conjunctions")}</th>
                                        <th className="py-1 pr-3">{t("astrology.aspects")}</th>
                                        <th className="py-1 pr-3">{t("astrology.other")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calculatedDetails.planets.map((p) => {
                                        const conjunct = calculatedDetails.planets
                                            .filter((q) => q.name !== p.name)
                                            .filter((q) => {
                                                const dist = Math.abs(p.absoluteDegree - q.absoluteDegree);
                                                const angularDist = Math.min(dist, 360 - dist);
                                                return angularDist < (orbMap[p.name] ?? 0);
                                            })
                                            .map((q) => {
                                                let diff = q.absoluteDegree - p.absoluteDegree;
                                                if (diff > 180) diff -= 360;
                                                if (diff < -180) diff += 360;
                                                const sign = diff >= 0 ? "+" : "-";
                                                const absDiff = Math.abs(diff);
                                                const totalVikala = Math.round(absDiff * 3600);
                                                const anshaka = Math.floor(totalVikala / 3600);
                                                const kala = Math.floor((totalVikala % 3600) / 60);
                                                const vikala = totalVikala % 60;
                                                return `${getPlanetName(q.name)} (${sign}${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")})`;
                                            });
                                        const aspects = p.aspects
                                            .filter((a) => a.aspectType !== 0)
                                            .map((a) => {
                                                const q = calculatedDetails.planets.find((x) => x.name === a.planetName);
                                                if (!q) return "";
                                                const exactPoint = (p.absoluteDegree + a.aspectType) % 360;
                                                let diff = exactPoint - q.absoluteDegree;
                                                if (diff > 180) diff -= 360;
                                                if (diff < -180) diff += 360;
                                                if (Math.abs(diff) > (orbMap[p.name] ?? 0) / 2) return "";
                                                const sign = diff >= 0 ? "+" : "-";
                                                const absDiff = Math.abs(diff);
                                                const totalVikala = Math.round(absDiff * 3600);
                                                const anshaka = Math.floor(totalVikala / 3600);
                                                const kala = Math.floor((totalVikala % 3600) / 60);
                                                const vikala = totalVikala % 60;
                                                return `${getPlanetName(a.planetName)} (${sign}${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")})`;
                                            })
                                            .filter(Boolean);
                                        const tags: string[] = [];
                                        if (p.combustion) tags.push(t("astrology.combustLabel"));
                                        if (calculatedDetails.lord22ndDrekkana === p.name) tags.push(t("astrology.drekkanaLordLabel"));
                                        if (calculatedDetails.lord64thNavamsa === p.name) tags.push(t("astrology.navamsaLordLabel"));
                                        if (calculatedDetails.atmakaraka === p.name) tags.push(t("astrology.atmakarakaLabel"));
                                        if (calculatedDetails.marakaPlanets?.includes(p.name)) tags.push(t("astrology.marakaLabel"));
                                        if (calculatedDetails.badhakaPlanet?.includes(p.name)) tags.push(t("astrology.badhakaLabel"));
                                        return (
                                        <tr key={p.name} className="border-b border-gray-50">
                                            <td className="py-1 pr-3 font-medium">{p.retrograde && p.name !== 8 && p.name !== 9 ? `(${getPlanetName(p.name)})` : getPlanetName(p.name)}</td>
                                            <td className="py-1 pr-3">{getSignName(p.sign)} ({formatDegree(p.degree)})</td>
                                            <td className="py-1 pr-3">{p.house}</td>
                                            <td className="py-1 pr-3 text-gray-600">
                                                {getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada})
                                            </td>
                                            <td className="py-1 pr-3">{conjunct.length > 0 ? conjunct.join(", ") : "—"}</td>
                                            <td className="py-1 pr-3">{aspects.length > 0 ? aspects.join(", ") : "—"}</td>
                                            <td className="py-1 pr-3">{tags.length > 0 ? tags.join(", ") : "—"}</td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
