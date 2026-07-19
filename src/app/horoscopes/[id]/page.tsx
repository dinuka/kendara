"use client";

import { BirthChart } from "@/components/BirthChart";
import { HouseChart } from "@/components/HouseChart";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Ascendant, House, Planet } from "@/lib/astrology";
import { formatDegree, navamsaSign } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";

const STRENGTH_TRANSLATION_KEYS: Record<PlanetaryStrength, string> = {
    [PlanetaryStrength.ATHI_UCHCHA]: "athiUchcha",
    [PlanetaryStrength.UCHCHA]: "exalted",
    [PlanetaryStrength.NEECHA]: "debilitated",
    [PlanetaryStrength.ATHI_NEECHA]: "athiNeecha",
    [PlanetaryStrength.MOOLATRIKONA]: "moolatrikona",
    [PlanetaryStrength.OWN_SIGN]: "ownSign",
    [PlanetaryStrength.MITRA]: "friendly",
    [PlanetaryStrength.SHATRU]: "enemy",
    [PlanetaryStrength.SAMA]: "neutral",
};

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
        1: 15,
        2: 12,
        3: 8,
        4: 7,
        5: 9,
        6: 7,
        7: 9,
        8: 0,
        9: 0,
    });

    const [expandedHouses, setExpandedHouses] = useState<Set<number>>(new Set());
    const [expandedPlanets, setExpandedPlanets] = useState<Set<number>>(new Set());

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

    const getNavamsaSign = (sign: number, degree: number): number => {
        const navamsaNum = Math.floor(degree / (30 / 9)) + 1;
        return navamsaSign(sign, navamsaNum);
    };

    const getNavamsaChartData = (): { planets: Planet[]; houses: House[]; ascendant: Ascendant } | null => {
        if (!calculatedDetails) return null;
        const ascNavSign = getNavamsaSign(calculatedDetails.ascendant.sign, calculatedDetails.ascendant.degree);

        const houses: House[] = Array.from({ length: 12 }, (_, i) => {
            const houseNumber = i + 1;
            const sign = ((ascNavSign - 1 + i) % 12) + 1;
            const lord = SIGN_LORD_MAP[sign] ?? 1;
            return {
                houseNumber,
                startDegree: 0,
                startSign: sign,
                startLord: lord,
                middleDegree: 0,
                middleSign: sign,
                middleLord: lord,
                endDegree: 0,
                endSign: sign,
                endLord: lord,
                sign,
                lord,
            };
        });

        const planets: Planet[] = calculatedDetails.planets.map((p) => {
            const navSign = p.navamsaSign ?? getNavamsaSign(p.sign, p.degree);
            const house = ((navSign - ascNavSign + 12) % 12) + 1;
            return { ...p, sign: navSign, house };
        });

        const ascendant: Ascendant = {
            sign: ascNavSign,
            degree: 0,
            lord: SIGN_LORD_MAP[ascNavSign] ?? 1,
        };

        return { planets, houses, ascendant };
    };

    const getStrength = (s: number | PlanetaryStrength): PlanetaryStrength => {
        if (typeof s !== "number") return s;
        const NUM_TO_STRENGTH: Record<number, PlanetaryStrength> = {
            1.25: PlanetaryStrength.ATHI_UCHCHA,
            1: PlanetaryStrength.UCHCHA,
            [-1]: PlanetaryStrength.NEECHA,
            [-1.25]: PlanetaryStrength.ATHI_NEECHA,
            0.75: PlanetaryStrength.MOOLATRIKONA,
            0.5: PlanetaryStrength.OWN_SIGN,
            0.1: PlanetaryStrength.MITRA,
            [-0.1]: PlanetaryStrength.SHATRU,
            0: PlanetaryStrength.SAMA,
        };
        return NUM_TO_STRENGTH[s] ?? PlanetaryStrength.SAMA;
    };

    const PLANET_SYMBOLS: Record<number, string> = {
        1: "☉",
        2: "☽",
        3: "♂",
        4: "☿",
        5: "♃",
        6: "♀",
        7: "♄",
        8: "☊",
        9: "☋",
    };

    const TAG_COLORS: Record<string, string> = {
        combust: "bg-orange-100 text-orange-700",
        atmakaraka: "bg-indigo-100 text-indigo-700",
    };

    const SIGN_LORD_MAP: Record<number, number> = {
        1: 3,
        2: 6,
        3: 4,
        4: 2,
        5: 1,
        6: 4,
        7: 6,
        8: 3,
        9: 5,
        10: 7,
        11: 7,
        12: 5,
    };

    const formatSignLordDegree = (
        sign: number | undefined,
        lord: number | undefined,
        deg: number,
        fallbackSign?: number,
        fallbackLord?: number,
    ): string => {
        const s = sign ?? fallbackSign ?? 1;
        const l = lord ?? fallbackLord ?? SIGN_LORD_MAP[s] ?? 1;
        return `${getSignName(s)}(${getPlanetName(l)}) ${formatDegree(deg)}`;
    };

    const getPlanetsInHouse = (houseNumber: number): Planet[] => {
        if (!calculatedDetails?.planets) return [];
        return calculatedDetails.planets
            .filter((p) => p.house === houseNumber)
            .sort((a, b) => a.absoluteDegree - b.absoluteDegree);
    };

    const getAspectsToHouse = (houseNumber: number): { planet: Planet; aspectType: number }[] => {
        if (!calculatedDetails?.planets) return [];
        const aspects: { planet: Planet; aspectType: number }[] = [];
        calculatedDetails.planets.forEach((p) => {
            const planetHouse = p.house;
            const diff = (houseNumber - planetHouse + 12) % 12;
            const specialAspects: Record<number, number[]> = {
                1: [2, 9],
                2: [2, 9],
                7: [2, 9],
                3: [3, 7],
                4: [3, 7],
                5: [4, 8],
                6: [4, 8],
            };
            if (diff === 6) {
                aspects.push({ planet: p, aspectType: 180 });
            } else if (specialAspects[p.name]?.includes(diff)) {
                aspects.push({
                    planet: p,
                    aspectType:
                        diff === 4
                            ? 120
                            : diff === 8
                              ? 240
                              : diff === 3
                                ? 90
                                : diff === 7
                                  ? 210
                                  : diff === 2
                                    ? 60
                                    : diff === 9
                                      ? 270
                                      : 0,
                });
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
            <div className="flex justify-between items-start mb-6 gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold">{horoscope.name}</h1>
                    <p className="text-sm text-gray-500 truncate" title={horoscope.location || undefined}>
                        {new Date(horoscope.birthDate).toLocaleDateString()} {horoscope.birthTime} |{" "}
                        {horoscope.location
                            ? horoscope.location.split(",")[0].trim()
                            : `${horoscope.latitude}, ${horoscope.longitude}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {horoscope.owner?.id === session?.user?.id && (
                        <>
                            <button
                                onClick={() => router.push(`/horoscopes/${params.id}/edit`)}
                                aria-label={t("horoscope.edit")}
                                title={t("horoscope.edit")}
                                className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-4 h-4"
                                >
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                </svg>
                            </button>
                            <span
                                aria-label={horoscope.isPublic ? t("horoscope.public") : t("horoscope.private")}
                                title={horoscope.isPublic ? t("horoscope.public") : t("horoscope.private")}
                                className={`w-8 h-8 flex items-center justify-center rounded ${horoscope.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                                {horoscope.isPublic ? (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-4 h-4"
                                    >
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                                        <path d="M2 12h20" />
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-4 h-4"
                                    >
                                        <rect x="3" y="11" width="18" height="10" rx="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                )}
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
                        if (selectedChart === ChartType.BIRTH && calculatedDetails) {
                            return (
                                <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                    <BirthChart
                                        planets={calculatedDetails.planets}
                                        houses={calculatedDetails.houses}
                                        ascendant={calculatedDetails.ascendant}
                                    />
                                </div>
                            );
                        }
                        if (selectedChart === ChartType.NAVAMSA_D9 && calculatedDetails) {
                            const navamsaData = getNavamsaChartData();
                            if (!navamsaData) return null;
                            return (
                                <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                    <BirthChart
                                        planets={navamsaData.planets}
                                        houses={navamsaData.houses}
                                        ascendant={navamsaData.ascendant}
                                        showAscendantDegree={false}
                                    />
                                </div>
                            );
                        }
                        if (selectedChart === ChartType.HOUSE && calculatedDetails) {
                            return (
                                <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                    <HouseChart
                                        planets={calculatedDetails.planets}
                                        houses={calculatedDetails.houses}
                                        ascendant={calculatedDetails.ascendant}
                                    />
                                </div>
                            );
                        }
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    {t("astrology.navamsaka")}
                                </h4>
                                <p className="text-sm">
                                    {(() => {
                                        const nvSign = getNavamsaSign(
                                            calculatedDetails.ascendant.sign,
                                            calculatedDetails.ascendant.degree,
                                        );
                                        const nvLord = SIGN_LORD_MAP[nvSign] ?? 1;
                                        return `${getSignName(nvSign)} (${getPlanetName(nvLord)})`;
                                    })()}
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
                        <div className="hidden sm:block overflow-x-auto">
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
                                                <td className="py-1 pr-3 text-gray-600">
                                                    {formatSignLordDegree(
                                                        h.startSign,
                                                        h.startLord,
                                                        h.startDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-gray-600">
                                                    {formatSignLordDegree(
                                                        h.middleSign,
                                                        h.middleLord,
                                                        h.middleDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-gray-600">
                                                    {formatSignLordDegree(
                                                        h.endSign,
                                                        h.endLord,
                                                        h.endDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {planetsInHouse.length > 0
                                                        ? planetsInHouse
                                                              .map(
                                                                  (p) =>
                                                                      `${getPlanetName(p.name)} (${formatDegree(p.degree)})`,
                                                              )
                                                              .join(", ")
                                                        : "—"}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {aspectsToHouse.length > 0
                                                        ? aspectsToHouse
                                                              .map((a) => {
                                                                  const sign = a.diff >= 0 ? "+" : "-";
                                                                  const absDiff = Math.abs(a.diff);
                                                                  const totalVikala = Math.round(absDiff * 3600);
                                                                  const anshaka = Math.floor(totalVikala / 3600);
                                                                  const kala = Math.floor((totalVikala % 3600) / 60);
                                                                  const vikala = totalVikala % 60;
                                                                  return `${getPlanetName(a.planet.name)} (${sign}${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")})`;
                                                              })
                                                              .join(", ")
                                                        : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="block sm:hidden space-y-3">
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
                                const isExpanded = expandedHouses.has(h.houseNumber);
                                return (
                                    <div key={h.houseNumber} className="bg-white rounded-lg border p-3">
                                        <div
                                            className="flex items-center justify-between cursor-pointer select-none"
                                            onClick={() => {
                                                const next = new Set(expandedHouses);
                                                isExpanded ? next.delete(h.houseNumber) : next.add(h.houseNumber);
                                                setExpandedHouses(next);
                                            }}
                                        >
                                            <span className="font-medium text-sm">H{h.houseNumber}</span>
                                            <span
                                                className={`transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""}`}
                                            >
                                                ▸
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {planetsInHouse.length > 0 ? (
                                                planetsInHouse.map((p) => (
                                                    <span
                                                        key={p.name}
                                                        className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs"
                                                    >
                                                        {getPlanetName(p.name)} {formatDegree(p.degree)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </div>
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.start")}:{" "}
                                                    </span>
                                                    {formatSignLordDegree(
                                                        h.startSign,
                                                        h.startLord,
                                                        h.startDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.mid")}:{" "}
                                                    </span>
                                                    {formatSignLordDegree(
                                                        h.middleSign,
                                                        h.middleLord,
                                                        h.middleDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.end")}:{" "}
                                                    </span>
                                                    {formatSignLordDegree(
                                                        h.endSign,
                                                        h.endLord,
                                                        h.endDegree,
                                                        h.sign,
                                                        h.lord,
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.aspects")}:{" "}
                                                    </span>
                                                    {aspectsToHouse.length > 0
                                                        ? aspectsToHouse.map((a, i) => {
                                                              const sign = a.diff >= 0 ? "+" : "-";
                                                              const absDiff = Math.abs(a.diff);
                                                              const totalVikala = Math.round(absDiff * 3600);
                                                              const anshaka = Math.floor(totalVikala / 3600);
                                                              const kala = Math.floor((totalVikala % 3600) / 60);
                                                              const vikala = totalVikala % 60;
                                                              return (
                                                                  <div key={i} className="text-xs">
                                                                      {getPlanetName(a.planet.name)} ({sign}
                                                                      {String(anshaka).padStart(2, "0")}:
                                                                      {String(kala).padStart(2, "0")}:
                                                                      {String(vikala).padStart(2, "0")})
                                                                  </div>
                                                              );
                                                          })
                                                        : "—"}
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className="text-indigo-600 text-xs font-medium cursor-pointer select-none mt-2"
                                            onClick={() => {
                                                const next = new Set(expandedHouses);
                                                isExpanded ? next.delete(h.houseNumber) : next.add(h.houseNumber);
                                                setExpandedHouses(next);
                                            }}
                                            aria-expanded={isExpanded}
                                        >
                                            {isExpanded ? t("astrology.less") : t("astrology.viewDetails")}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="bg-white rounded-lg border p-4">
                        <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                            {t("astrology.planets")}
                        </h3>
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                        <th className="py-1 pr-3">{t("astrology.planet")}</th>
                                        <th className="py-1 pr-3">
                                            {t("astrology.sign")} ({t("astrology.degree")})
                                        </th>
                                        <th className="py-1 pr-3">{t("astrology.strength")}</th>
                                        <th className="py-1 pr-3">{t("astrology.navamsa")}</th>
                                        <th className="py-1 pr-3">{t("astrology.house")}</th>
                                        <th className="py-1 pr-3">
                                            {t("astrology.nakshatra")} ({t("astrology.pada")})
                                        </th>
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
                                                const q = calculatedDetails.planets.find(
                                                    (x) => x.name === a.planetName,
                                                );
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
                                        const tags: { label: string; key: string }[] = [];
                                        if (p.combustion)
                                            tags.push({ label: t("astrology.combustLabel"), key: "combust" });
                                        if (calculatedDetails.lord22ndDrekkana === p.name)
                                            tags.push({ label: t("astrology.drekkanaLordLabel"), key: "drekkana" });
                                        if (calculatedDetails.lord64thNavamsa === p.name)
                                            tags.push({ label: t("astrology.navamsaLordLabel"), key: "navamsaLord" });
                                        if (calculatedDetails.atmakaraka === p.name)
                                            tags.push({ label: t("astrology.atmakarakaLabel"), key: "atmakaraka" });
                                        if (calculatedDetails.marakaPlanets?.includes(p.name))
                                            tags.push({ label: t("astrology.marakaLabel"), key: "maraka" });
                                        if (calculatedDetails.badhakaPlanet?.includes(p.name))
                                            tags.push({ label: t("astrology.badhakaLabel"), key: "badhaka" });
                                        return (
                                            <tr key={p.name} className="border-b border-gray-50">
                                                <td className="py-1 pr-3 font-medium">
                                                    {p.retrograde && p.name !== 8 && p.name !== 9
                                                        ? `(${getPlanetName(p.name)})`
                                                        : getPlanetName(p.name)}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {getSignName(p.sign)} ({formatDegree(p.degree)})
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {t(
                                                        `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.strength)]}`,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-gray-600">
                                                    {getSignName(p.navamsaSign ?? getNavamsaSign(p.sign, p.degree))} (
                                                    {t(
                                                        `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.navamsaStrength ?? p.strength)]}`,
                                                    )}
                                                    )
                                                </td>
                                                <td className="py-1 pr-3">{p.house}</td>
                                                <td className="py-1 pr-3 text-gray-600">
                                                    {getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada})
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {conjunct.length > 0 ? conjunct.join(", ") : "—"}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {aspects.length > 0 ? aspects.join(", ") : "—"}
                                                </td>
                                                <td className="py-1 pr-3">
                                                    {tags.length > 0 ? tags.map((t) => t.label).join(", ") : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="block sm:hidden space-y-3">
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
                                const tags: { label: string; key: string }[] = [];
                                if (p.combustion) tags.push({ label: t("astrology.combustLabel"), key: "combust" });
                                if (calculatedDetails.lord22ndDrekkana === p.name)
                                    tags.push({ label: t("astrology.drekkanaLordLabel"), key: "drekkana" });
                                if (calculatedDetails.lord64thNavamsa === p.name)
                                    tags.push({ label: t("astrology.navamsaLordLabel"), key: "navamsaLord" });
                                if (calculatedDetails.atmakaraka === p.name)
                                    tags.push({ label: t("astrology.atmakarakaLabel"), key: "atmakaraka" });
                                if (calculatedDetails.marakaPlanets?.includes(p.name))
                                    tags.push({ label: t("astrology.marakaLabel"), key: "maraka" });
                                if (calculatedDetails.badhakaPlanet?.includes(p.name))
                                    tags.push({ label: t("astrology.badhakaLabel"), key: "badhaka" });
                                const isExpanded = expandedPlanets.has(p.name);
                                return (
                                    <div key={p.name} className="bg-white rounded-lg border p-3">
                                        <div
                                            className="flex items-center justify-between cursor-pointer select-none"
                                            onClick={() => {
                                                const next = new Set(expandedPlanets);
                                                isExpanded ? next.delete(p.name) : next.add(p.name);
                                                setExpandedPlanets(next);
                                            }}
                                        >
                                            <span className="font-medium text-sm">
                                                <span className="text-sm w-5 text-center inline-block">
                                                    {PLANET_SYMBOLS[p.name] ?? ""}
                                                </span>{" "}
                                                {getPlanetName(p.name)}
                                                {p.retrograde && p.name !== 8 && p.name !== 9 && (
                                                    <span className="text-xs text-gray-500 ml-1">(R)</span>
                                                )}
                                            </span>
                                            <span
                                                className={`transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""}`}
                                            >
                                                ▸
                                            </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                                            <div>
                                                {getSignName(p.sign)} ({formatDegree(p.degree)})
                                            </div>
                                            <div className="text-right">
                                                {t("astrology.house")} {p.house}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                                            <div>
                                                {t(`astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.strength)]}`)}
                                            </div>
                                            <div className="text-right">
                                                {getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada})
                                            </div>
                                        </div>
                                        {tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {tags.map((tag) => {
                                                    const colorClass =
                                                        TAG_COLORS[tag.key] ?? "bg-gray-100 text-gray-700";
                                                    return (
                                                        <span
                                                            key={tag.key}
                                                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${colorClass}`}
                                                        >
                                                            {tag.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.navamsa")}:{" "}
                                                    </span>
                                                    {getSignName(p.navamsaSign ?? getNavamsaSign(p.sign, p.degree))} (
                                                    {t(
                                                        `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.navamsaStrength ?? p.strength)]}`,
                                                    )}
                                                    )
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.conjunctions")}:{" "}
                                                    </span>
                                                    {conjunct.length > 0
                                                        ? conjunct.map((c, i) => (
                                                              <div key={i} className="text-xs">
                                                                  {c}
                                                              </div>
                                                          ))
                                                        : "—"}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">
                                                        {t("astrology.aspects")}:{" "}
                                                    </span>
                                                    {aspects.length > 0
                                                        ? aspects.map((a, i) => (
                                                              <div key={i} className="text-xs">
                                                                  {a}
                                                              </div>
                                                          ))
                                                        : "—"}
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className="text-indigo-600 text-xs font-medium cursor-pointer select-none mt-2"
                                            onClick={() => {
                                                const next = new Set(expandedPlanets);
                                                isExpanded ? next.delete(p.name) : next.add(p.name);
                                                setExpandedPlanets(next);
                                            }}
                                            aria-expanded={isExpanded}
                                        >
                                            {isExpanded ? t("astrology.less") : t("astrology.viewDetails")}
                                        </div>
                                    </div>
                                );
                            })}
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
