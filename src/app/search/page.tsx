"use client";

import { BirthChart } from "@/components/BirthChart";
import { HouseChart } from "@/components/HouseChart";
import SearchSuggestions from "@/components/SearchSuggestions";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Ascendant, House, Planet } from "@/lib/astrology";
import {
    PLANET_COLORS,
    PLANET_SYMBOLS,
    computeAscendantSpecialFlags,
    findHouse,
    formatDegree,
    formatYearDuration,
    navamsaSign,
} from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { toBirthChartData } from "@/lib/chartDataTransform";
import { getSuggestions, insertSuggestion, splitLastToken } from "@/lib/search/suggestions";
import { detectLanguage } from "@/lib/search/utils";
import Link from "next/link";

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

const DEFAULT_CONFIG: Record<string, boolean> = {
    birthChart: true,
    navamsaD9: true,
    houseChart: true,
    drekkanaD3: true,
    dasamsaD10: true,
    shodashaVargas: true,
    chandraLagna: true,
    suryaLagna: true,
    ascendant: true,
    houseDetails: true,
    planetPositions: true,
    nakshatra: true,
    dashas: true,
    planetaryStrengths: false,
    aspects: true,
    yogas: false,
    doshas: false,
    currentPlanetPositions: false,
    metadata: false,
};

const CONFIG_CATEGORIES: Array<{
    key: string;
    label: string;
    sections: Array<{ key: string; label: string }>;
}> = [
    {
        key: "charts",
        label: "Charts",
        sections: [
            { key: "birthChart", label: "Birth Chart (Rasi)" },
            { key: "navamsaD9", label: "Navamsa (D9)" },
            { key: "houseChart", label: "House Chart (Bhava)" },
            { key: "drekkanaD3", label: "Drekkana (D3)" },
            { key: "dasamsaD10", label: "Dasamsa (D10)" },
            { key: "shodashaVargas", label: "Shodasha Vargas (16)" },
            { key: "chandraLagna", label: "Chandra Lagna" },
            { key: "suryaLagna", label: "Surya Lagna" },
        ],
    },
    {
        key: "calculations",
        label: "Calculations",
        sections: [
            { key: "ascendant", label: "Ascendant / Lagna" },
            { key: "houseDetails", label: "House Details" },
            { key: "planetPositions", label: "Planet Positions" },
            { key: "nakshatra", label: "Nakshatra / Pada" },
            { key: "dashas", label: "Dashas" },
        ],
    },
    {
        key: "strengths",
        label: "Strengths & Aspects",
        sections: [
            { key: "planetaryStrengths", label: "Planetary Strengths" },
            { key: "aspects", label: "Aspects" },
        ],
    },
    {
        key: "yogasDoshas",
        label: "Yogas & Doshas",
        sections: [
            { key: "yogas", label: "Yogas" },
            { key: "doshas", label: "Doshas" },
        ],
    },
    {
        key: "other",
        label: "Other",
        sections: [
            { key: "currentPlanetPositions", label: "Current Planetary Positions" },
            { key: "metadata", label: "Metadata / Tags" },
        ],
    },
];

interface HistoryEntry {
    id: string;
    query: string;
    resultCount: number;
    language: string;
    source: string;
    createdAt: string;
}

interface SavedFilterEntry {
    id: string;
    name: string;
    query: string;
    filterConfig: Record<string, boolean>;
    lastRunAt: string | null;
    resultCount: number;
}

interface BookmarkEntry {
    id: string;
    user: { id: string };
    horoscope: { id: string };
    notes?: string;
    queryContext?: string;
    createdAt: string;
    horoscopeDetail?: {
        _id: string;
        name: string;
        displayName: boolean;
        birthDate: string;
    } | null;
    isAvailable: boolean;
}

interface SearchResult {
    horoscope: Record<string, unknown>;
    score: number;
    matchedConditions: string[];
}

const ScoreBadge = ({ score }: { score: number }) => {
    const { t } = useI18n();
    const pct = Math.round(score * 100);
    let colorClass = "bg-gray-100 text-gray-600";
    let label = t("search.score.weak");

    if (score >= 0.8) {
        colorClass = "bg-green-100 text-green-800";
        label = t("search.score.excellent");
    } else if (score >= 0.6) {
        colorClass = "bg-indigo-100 text-indigo-800";
        label = t("search.score.strong");
    } else if (score >= 0.4) {
        colorClass = "bg-amber-100 text-amber-800";
        label = t("search.score.moderate");
    }

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
            aria-label={t("search.score.ariaLabel", { pct })}
            title={label}
        >
            {pct}%
        </span>
    );
};

const SIGN_SYMBOLS: Record<number, string> = {
    1: "\u2648",
    2: "\u2649",
    3: "\u264A",
    4: "\u264B",
    5: "\u264C",
    6: "\u264D",
    7: "\u264E",
    8: "\u264F",
    9: "\u2650",
    10: "\u2651",
    11: "\u2652",
    12: "\u2653",
};

const STRENGTH_RECORDS: Array<{ value: number; label: string; color: string }> = [
    { value: 1.25, label: "Athi Uchcha", color: "text-green-700 bg-green-50" },
    { value: 1, label: "Exalted", color: "text-green-600 bg-green-50" },
    { value: 0.75, label: "Moolatrikona", color: "text-teal-600 bg-teal-50" },
    { value: 0.5, label: "Own Sign", color: "text-blue-600 bg-blue-50" },
    { value: 0.1, label: "Friend", color: "text-indigo-600 bg-indigo-50" },
    { value: 0, label: "Neutral", color: "text-gray-500 bg-gray-50" },
    { value: -0.1, label: "Enemy", color: "text-orange-600 bg-orange-50" },
    { value: -1, label: "Debilitated", color: "text-red-600 bg-red-50" },
    { value: -1.25, label: "Athi Neecha", color: "text-red-700 bg-red-50" },
];

const parseStrength = (val: unknown): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
        const map: Record<string, number> = {
            AthiUchcha: 1.25,
            Uchcha: 1,
            Neecha: -1,
            AthiNeecha: -1.25,
            Moolatrikona: 0.75,
            OwnSign: 0.5,
            Mitra: 0.1,
            Shatru: -0.1,
            Sama: 0,
        };
        return map[val] ?? 0;
    }
    return 0;
};

const getStrengthInfo = (val: number) =>
    STRENGTH_RECORDS.find((r) => r.value === val) || { label: "", color: "text-gray-500" };

const PlanetPositionsTable = ({ planets }: { planets: Array<Record<string, unknown>> }) => {
    const { t } = useI18n();
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b text-gray-500">
                        <th className="text-left py-1 pr-2 font-medium">{t("astrology.planet")}</th>
                        <th className="text-left py-1 pr-2 font-medium">{t("astrology.sign")}</th>
                        <th className="text-center py-1 pr-2 font-medium">{t("astrology.house")}</th>
                        <th className="text-center py-1 pr-2 font-medium">{t("astrology.degree")}</th>
                        <th className="text-right py-1 font-medium">{t("astrology.strength")}</th>
                    </tr>
                </thead>
                <tbody>
                    {planets.map((p, i) => {
                        const pName = p.name as number;
                        const pSign = p.sign as number;
                        const strengthVal = parseStrength(p.strength);
                        const strengthInfo = getStrengthInfo(strengthVal);
                        return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="py-1.5 pr-2">
                                    <span className="font-medium">
                                        {PLANET_SYMBOLS[pName] || ""} {t("search.table.planetName", { id: pName })}
                                    </span>
                                    {(p.retrograde as boolean) && (
                                        <span
                                            className="text-red-400 text-[10px] ml-1"
                                            title={t("astrology.retrograde")}
                                        >
                                            R
                                        </span>
                                    )}
                                </td>
                                <td className="py-1.5 pr-2 text-gray-600">
                                    {SIGN_SYMBOLS[pSign] || ""} {t("search.table.signName", { id: pSign })}
                                </td>
                                <td className="py-1.5 pr-2 text-center font-mono">{p.house as string}</td>
                                <td className="py-1.5 pr-2 text-center font-mono">
                                    {(p.degree as number)?.toFixed(1)}°
                                </td>
                                <td className="py-1.5 text-right">
                                    {strengthInfo.label && (
                                        <span
                                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight ${strengthInfo.color}`}
                                        >
                                            {strengthInfo.label}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const ORB_MAP: Record<number, number> = {
    1: 15,
    2: 12,
    3: 8,
    4: 7,
    5: 9,
    6: 7,
    7: 9,
    8: 0,
    9: 0,
};

const formatDegDiff = (diff: number): string => {
    const sign = diff >= 0 ? "+" : "-";
    const absDiff = Math.abs(diff);
    const totalVikala = Math.round(absDiff * 3600);
    const anshaka = Math.floor(totalVikala / 3600);
    const kala = Math.floor((totalVikala % 3600) / 60);
    const vikala = totalVikala % 60;
    return `${sign}${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}:${String(vikala).padStart(2, "0")}`;
};
const DashaTimeline = ({ dashas }: { dashas: Record<string, unknown> }) => {
    const { t } = useI18n();
    const mahadasha = dashas.mahadasha as Array<Record<string, unknown>> | undefined;
    const currentPeriod = dashas.currentPeriod as Record<string, unknown> | undefined;
    const [expandedMds, setExpandedMds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (currentPeriod && mahadasha) {
            const activeMdPlanet = currentPeriod.mahadashaLord;
            const idx = mahadasha.findIndex((md) => md.planet === activeMdPlanet);
            if (idx >= 0) {
                setExpandedMds((prev) => new Set(prev).add(idx));
            }
        }
    }, [currentPeriod, mahadasha]);

    if (!mahadasha || mahadasha.length === 0)
        return <span className="text-sm text-gray-400">{t("search.dashas.noData")}</span>;

    const getPlanetName = (id: number) => t("astrology.planetNames." + id);

    const toggleMd = (idx: number) => {
        setExpandedMds((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    return (
        <div className="space-y-1">
            {currentPeriod && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg mb-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-medium text-indigo-800">
                        {getPlanetName(currentPeriod.mahadashaLord as number)} Mahadasha
                        {(currentPeriod.antardashaLord as boolean) ? (
                            <> &mdash; {getPlanetName(currentPeriod.antardashaLord as number)} Antardasha</>
                        ) : null}
                    </span>
                </div>
            )}
            {mahadasha.map((md, mdIdx) => {
                const isActive = currentPeriod?.mahadashaLord === md.planet;
                const isExpanded = expandedMds.has(mdIdx);
                const antardasha = md.antardasha as Array<Record<string, unknown>> | undefined;
                const planetId = md.planet as number;
                return (
                    <div
                        key={mdIdx}
                        className={`border rounded-lg overflow-hidden transition-colors ${isActive ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200"}`}
                    >
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleMd(mdIdx)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleMd(mdIdx);
                                }
                            }}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${isActive ? "bg-indigo-100" : "hover:bg-gray-50"}`}
                        >
                            <span
                                className={`inline-block transition-transform duration-200 text-gray-400 text-sm ${isExpanded ? "rotate-90" : ""}`}
                            >
                                {"\u25B8"}
                            </span>
                            <span
                                className="inline-flex items-center justify-center w-5 h-5 text-sm"
                                style={{ color: PLANET_COLORS[planetId] ?? "#374151" }}
                            >
                                {PLANET_SYMBOLS[planetId] ?? ""}
                            </span>
                            <span className="font-semibold text-gray-800 text-sm">{getPlanetName(planetId)}</span>
                            <span className="text-xs text-gray-400">Mahadasha</span>
                            <span className="text-xs text-gray-400 ml-auto">
                                {md.startDate as string} &mdash; {md.endDate as string}
                            </span>
                            {isActive && (
                                <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                                    Active
                                </span>
                            )}
                        </div>
                        {antardasha && antardasha.length > 0 && (
                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[30000px]" : "max-h-0"}`}
                            >
                                <div className="border-t border-gray-100">
                                    {antardasha.map((ad, adIdx) => {
                                        const isAdActive = isActive && currentPeriod?.antardashaLord === ad.planet;
                                        const adPlanetId = ad.planet as number;
                                        return (
                                            <div
                                                key={adIdx}
                                                className={`flex items-center gap-2 py-2 px-2 ml-4 text-sm ${isAdActive ? "bg-indigo-100 rounded" : ""}`}
                                            >
                                                <span
                                                    className="inline-flex items-center justify-center w-4 h-4 text-xs"
                                                    style={{ color: PLANET_COLORS[adPlanetId] ?? "#374151" }}
                                                >
                                                    {PLANET_SYMBOLS[adPlanetId] ?? ""}
                                                </span>
                                                <span className="text-gray-700 font-medium">
                                                    {getPlanetName(adPlanetId)}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1">Antardasha</span>
                                                <span className="text-gray-400 ml-auto text-xs">
                                                    {ad.startDate as string} &mdash; {ad.endDate as string}
                                                </span>
                                                {isAdActive && (
                                                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
const CHART_TABS = [
    { key: "birth", label: "Birth", configKey: "birthChart" },
    { key: "navamsa-d9", label: "Navamsa", configKey: "navamsaD9" },
    { key: "house", label: "House", configKey: "houseChart" },
    { key: "chandra-lagna", label: "Chandra", configKey: "chandraLagna" },
    { key: "surya-lagna", label: "Surya", configKey: "suryaLagna" },
    { key: "drekkana-d3", label: "D3", configKey: "drekkanaD3" },
    { key: "dasamsa-d10", label: "D10", configKey: "dasamsaD10" },
    { key: "shodasha-vargas", label: "Vargas", configKey: "shodashaVargas" },
];

const formatCondition = (
    t: (key: string, params?: Record<string, string | number | Date>) => string,
    mc: string,
): string => {
    if (mc.startsWith("ascendant=")) {
        return t("search.conditions.ascendant", { sign: mc.slice("ascendant=".length) });
    }
    if (mc.startsWith("planet_in_sign=")) {
        const rest = mc.slice("planet_in_sign=".length);
        const parts = rest.split("_");
        return t("search.conditions.planetInSign", { planet: parts[0], sign: parts.slice(1).join("_") });
    }
    if (mc.endsWith("=Exaltation")) {
        return t("search.conditions.exaltation", { planet: mc.slice(0, -"=Exaltation".length) });
    }
    if (mc.endsWith("=Debilitation")) {
        return t("search.conditions.debilitation", { planet: mc.slice(0, -"=Debilitation".length) });
    }
    if (mc.startsWith("yoga_present=")) {
        return t("search.conditions.yogaPresent", { count: mc.slice("yoga_present=".length).split("_")[0] });
    }
    if (mc.startsWith("dosha=")) {
        return t("search.conditions.dosha", { name: mc.slice("dosha=".length) });
    }
    const ROLE_KEYS = [
        "ashtamansha",
        "nidhanamsha",
        "maraka",
        "badhaka",
        "drekkana",
        "navamsa",
        "atmakaraka",
        "wargoththama",
        "gandanta",
        "gandamula",
        "pushkara",
    ];
    const roleKey = ROLE_KEYS.find((role) => mc.startsWith(`${role}=`));
    if (roleKey) {
        return t(`search.conditions.${roleKey}`, { planet: mc.slice(`${roleKey}=`.length) });
    }
    if (ROLE_KEYS.some((role) => mc === `${role}_present`)) {
        return t(`search.conditions.${mc.replace("_present", "Present")}`);
    }
    if (mc.includes("_in_sign=")) {
        const [planet, rest] = mc.split("_in_sign=");
        const [sign, housePart] = rest.split("_house=");
        return t("search.conditions.planetInSignHouse", { planet, sign, house: housePart });
    }
    return mc;
};

const SearchResultCard = ({
    result,
    config,
    activeChart,
    onChartTabChange,
    isExpanded,
    onToggleExpand,
    onBookmark,
    isBookmarked,
}: {
    result: SearchResult;
    config: Record<string, boolean>;
    activeChart: string;
    onChartTabChange: (tab: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onBookmark: () => void;
    isBookmarked: boolean;
}) => {
    const { t } = useI18n();
    const [expandedPlanets, setExpandedPlanets] = useState<Set<number>>(new Set());
    const h = result.horoscope;
    const cd = h.calculatedDetails as Record<string, unknown> | undefined;
    const charts = h.charts as Record<string, unknown> | undefined;
    const ascData = cd?.ascendant as Record<string, unknown> | undefined;
    const ascSign = ascData?.sign as number | undefined;
    const ascDegree = ascData?.degree as number | undefined;
    const navamsaChartData = useMemo(() => {
        if (!cd?.planets || !cd?.ascendant) return null;
        const planets = cd.planets as Planet[];
        const asc = cd.ascendant as Ascendant;
        const navamsaPlanets: Planet[] = planets.map((p) => {
            const navSign = p.navamsaSign ?? navamsaSign(p.sign, Math.floor(p.degree / (30 / 9)) + 1);
            const ascNavSign = asc.sign; // computed below
            return { ...p, sign: navSign };
        });
        const ascNavSign =
            navamsaPlanets.length > 0 ? navamsaSign(asc.sign, Math.floor(asc.degree / (30 / 9)) + 1) : asc.sign;
        const navHouses: House[] = Array.from({ length: 12 }, (_, i) => {
            const hn = i + 1;
            const s = ((ascNavSign - 1 + i) % 12) + 1;
            return {
                houseNumber: hn,
                startDegree: 0,
                startSign: s,
                startLord: SIGN_LORD_MAP[s] ?? 1,
                middleDegree: 0,
                middleSign: s,
                middleLord: SIGN_LORD_MAP[s] ?? 1,
                endDegree: 0,
                endSign: s,
                endLord: SIGN_LORD_MAP[s] ?? 1,
                sign: s,
                lord: SIGN_LORD_MAP[s] ?? 1,
            };
        });
        const navPlanets: Planet[] = navamsaPlanets.map((p) => ({
            ...p,
            house: ((p.sign - ascNavSign + 12) % 12) + 1,
        }));
        return {
            planets: navPlanets,
            houses: navHouses,
            ascendant: { sign: ascNavSign, degree: 0, lord: SIGN_LORD_MAP[ascNavSign] ?? 1 },
        };
    }, [cd]);

    const availableChartTabs = CHART_TABS.filter((tab) => {
        if (tab.key === "navamsa-d9") return config[tab.configKey] && navamsaChartData !== null;
        return config[tab.configKey] && charts?.[tab.key];
    });

    const resolvedChart = availableChartTabs.some((t) => t.key === activeChart)
        ? activeChart
        : availableChartTabs.length > 0
          ? availableChartTabs[0].key
          : CHART_TABS[0].key;

    return (
        <div className="bg-white rounded-lg border hover:shadow-md transition-shadow flex flex-col">
            {/* Header — always visible */}
            <div
                className="p-3 cursor-pointer flex items-start justify-between"
                onClick={onToggleExpand}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleExpand();
                    }
                }}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/horoscopes/${(h._id as string) || (h.id as string)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-sm truncate text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                            {h.name as string}
                        </Link>
                        <ScoreBadge score={result.score} />
                    </div>
                    {ascSign !== undefined ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                            {SIGN_SYMBOLS[ascSign] || ""} {t(`astrology.signNames.${ascSign}`)}{" "}
                            {ascDegree !== undefined && `(${ascDegree.toFixed(1)}°)`}
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400 mt-0.5">{t("search.card.noAscendant")}</p>
                    )}
                    {result.matchedConditions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {result.matchedConditions.slice(0, 3).map((mc, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 leading-tight"
                                >
                                    {formatCondition(t, mc)}
                                </span>
                            ))}
                            {result.matchedConditions.length > 3 && (
                                <span className="text-[10px] text-gray-400">
                                    +{result.matchedConditions.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onBookmark();
                        }}
                        className={`text-base ${isBookmarked ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500"}`}
                        aria-label={isBookmarked ? t("search.card.bookmarkRemove") : t("search.card.bookmarkAdd")}
                    >
                        {isBookmarked ? "\u2605" : "\u2606"}
                    </button>
                    <span
                        className={`text-gray-400 text-xs transition-transform duration-200 ${
                            isExpanded ? "rotate-0" : "-rotate-90"
                        }`}
                    >
                        {"\u25BC"}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <div className="border-t flex-1 flex flex-col">
                    {/* Chart tabs */}
                    {availableChartTabs.length > 0 && (
                        <div className="border-b">
                            <div className="flex" role="tablist">
                                {availableChartTabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        role="tab"
                                        aria-selected={resolvedChart === tab.key}
                                        onClick={() => onChartTabChange(tab.key)}
                                        className={`flex-1 text-xs py-2 px-2 font-medium transition-colors ${
                                            resolvedChart === tab.key
                                                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                        }`}
                                    >
                                        {t(`search.tabs.${tab.key}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active chart */}
                    {availableChartTabs.length > 0 && (
                        <div className="bg-gray-50 border-b flex items-center justify-center p-2">
                            {(() => {
                                if (resolvedChart === "navamsa-d9") {
                                    if (!navamsaChartData) {
                                        return (
                                            <div className="text-sm text-gray-400 p-8">
                                                {t("search.card.noChartData")}
                                            </div>
                                        );
                                    }
                                    return (
                                        <BirthChart
                                            {...toBirthChartData(navamsaChartData)}
                                            showAscendantDegree={false}
                                        />
                                    );
                                }
                                const chartData = charts?.[resolvedChart] as Record<string, unknown> | undefined;
                                const data = chartData?.data as Record<string, unknown> | undefined;
                                const planets = data?.planets as Planet[] | undefined;
                                const houses = data?.houses as House[] | undefined;
                                const ascendant = data?.ascendant as Ascendant | undefined;
                                if (!planets || !houses || !ascendant) {
                                    return (
                                        <div className="text-sm text-gray-400 p-8">{t("search.card.noChartData")}</div>
                                    );
                                }
                                if (resolvedChart === "house") {
                                    return (
                                        <HouseChart
                                            planets={planets}
                                            houses={houses}
                                            ascendant={ascendant}
                                            horoscopeId={(h._id as string) || (h.id as string)}
                                        />
                                    );
                                }
                                return (
                                    <BirthChart
                                        planets={planets}
                                        houses={houses}
                                        ascendant={ascendant}
                                        showAscendantDegree={false}
                                    />
                                );
                            })()}
                        </div>
                    )}

                    {/* Calculations */}
                    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                        {config.ascendant && ascData && ascSign && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("astrology.ascendant")}
                                </h5>
                                <div className="text-xs text-gray-700 mb-1">
                                    {t(`astrology.signNames.${ascSign}`)} (
                                    {t(`astrology.planetNames.${(ascData.lord as number) || 1}`)}){" "}
                                    {ascDegree ? formatDegree(ascDegree) : ""}
                                </div>
                                {(() => {
                                    const nk = cd?.nakshatra as Record<string, unknown> | undefined;
                                    const an = nk?.ascendantNakshatra as Record<string, unknown> | undefined;
                                    const recomputed = computeAscendantSpecialFlags(
                                        ascSign ?? 0,
                                        ascDegree ?? 0,
                                        (an?.id as number) ?? 0,
                                        (an?.pada as number) ?? 1,
                                    );
                                    const flags = {
                                        isAscendantGandantha:
                                            Boolean(cd?.isAscendantGandantha) || recomputed.isAscendantGandantha,
                                        isAscendantGandamula:
                                            Boolean(cd?.isAscendantGandamula) || recomputed.isAscendantGandamula,
                                        isAscendantPushkara:
                                            Boolean(cd?.isAscendantPushkara) || recomputed.isAscendantPushkara,
                                    };
                                    const tags: { key: string; text: string; strikethrough?: boolean }[] = [];
                                    if (Boolean(cd?.isAscendantWargoththama)) {
                                        const crossed = flags.isAscendantGandantha || flags.isAscendantGandamula;
                                        tags.push({
                                            key: "wargoththama",
                                            text: t("astrology.wargoththamaLabel"),
                                            strikethrough: crossed,
                                        });
                                    }
                                    if (flags.isAscendantGandantha)
                                        tags.push({ key: "gandanta", text: t("astrology.gandantaLabel") });
                                    if (flags.isAscendantGandamula)
                                        tags.push({ key: "gandamula", text: t("astrology.gandamulaLabel") });
                                    if (flags.isAscendantPushkara)
                                        tags.push({ key: "pushkara", text: t("astrology.pushkaraLabel") });
                                    if (tags.length === 0) return null;
                                    return (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {tags.map((tag) => (
                                                <span
                                                    key={tag.key}
                                                    className={`inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border ${
                                                        tag.key === "wargoththama"
                                                            ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                                                            : "text-gray-600 bg-gray-100 border-gray-200"
                                                    } ${tag.strikethrough ? "line-through" : ""}`}
                                                >
                                                    {tag.text}
                                                </span>
                                            ))}
                                        </div>
                                    );
                                })()}
                                {config.nakshatra && (cd?.nakshatra as boolean) && (
                                    <div className="text-xs text-gray-600">
                                        {(() => {
                                            const nk = cd!.nakshatra as Record<string, unknown>;
                                            const an = nk.ascendantNakshatra as Record<string, unknown> | undefined;
                                            if (!an) return null;
                                            return (
                                                <p>
                                                    {t(`astrology.nakshatraNames.${an.id as number}`)} (
                                                    {t(`astrology.planetNames.${(an.lord as number) || 1}`)}){" "}
                                                    {an.pada as number} {t("astrology.pada")}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {config.nakshatra && (cd?.nakshatra as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                                    {t("astrology.nakshatra")}
                                </h5>
                                <div className="text-xs text-gray-600 space-y-0.5">
                                    {(() => {
                                        const nk = cd!.nakshatra as Record<string, unknown>;
                                        const mn = nk.moonNakshatra as Record<string, unknown> | undefined;
                                        if (!mn) return null;
                                        return (
                                            <p>
                                                {t(`astrology.nakshatraNames.${mn.id as number}`)} (
                                                {t(`astrology.planetNames.${(mn.lord as number) || 1}`)}){" "}
                                                {mn.pada as number} {t("astrology.pada")}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {config.houseDetails && (cd?.houses as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("astrology.houses")}
                                </h5>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b text-gray-500">
                                                <th className="text-left py-1 pr-2 font-medium">#</th>
                                                <th className="text-left py-1 pr-2 font-medium">
                                                    {t("astrology.start")}
                                                </th>
                                                <th className="text-left py-1 pr-2 font-medium">
                                                    {t("astrology.mid")}
                                                </th>
                                                <th className="text-left py-1 pr-2 font-medium">
                                                    {t("astrology.end")}
                                                </th>
                                                <th className="text-left py-1 pr-2 font-medium">
                                                    {t("astrology.planets")}
                                                </th>
                                                <th className="text-left py-1 pr-2 font-medium">
                                                    {t("astrology.aspects")}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const allPlanets =
                                                    (cd!.planets as Array<Record<string, unknown>>) || [];
                                                const houseAspects: Record<number, string[]> = {};
                                                for (const p of allPlanets) {
                                                    const pHouse = p.house as number;
                                                    const pName = t(`astrology.planetNames.${(p.name as number) || 1}`);
                                                    const aspectedHouses = [((pHouse + 6 - 1) % 12) + 1];
                                                    if ((p.name as number) === 3) {
                                                        aspectedHouses.push(
                                                            ((pHouse + 3 - 1) % 12) + 1,
                                                            ((pHouse + 7 - 1) % 12) + 1,
                                                        );
                                                    } else if ((p.name as number) === 5) {
                                                        aspectedHouses.push(
                                                            ((pHouse + 4 - 1) % 12) + 1,
                                                            ((pHouse + 8 - 1) % 12) + 1,
                                                        );
                                                    } else if ((p.name as number) === 7) {
                                                        aspectedHouses.push(
                                                            ((pHouse + 2 - 1) % 12) + 1,
                                                            ((pHouse + 9 - 1) % 12) + 1,
                                                        );
                                                    }
                                                    for (const h of aspectedHouses) {
                                                        (houseAspects[h] ??= []).push(pName);
                                                    }
                                                }
                                                return (cd!.houses as Array<Record<string, unknown>>).map((h, i) => {
                                                    const hNum = h.houseNumber as number;
                                                    const planetsInHouse = allPlanets.filter(
                                                        (p) => (p.house as number) === hNum,
                                                    );
                                                    const aspectsForHouse = houseAspects[hNum] || [];
                                                    return (
                                                        <tr
                                                            key={i}
                                                            className="border-b border-gray-50 hover:bg-gray-100/50 even:bg-gray-100"
                                                        >
                                                            <td className="py-1.5 pr-2 font-mono">{hNum}</td>
                                                            <td className="py-1.5 pr-2 text-gray-600">
                                                                {SIGN_SYMBOLS[(h.startSign as number) || 0] || ""}{" "}
                                                                {formatDegree(h.startDegree as number)}
                                                            </td>
                                                            <td className="py-1.5 pr-2 text-gray-600">
                                                                {SIGN_SYMBOLS[(h.middleSign as number) || 0] || ""}{" "}
                                                                {t(`astrology.signNames.${h.middleSign as number}`)}{" "}
                                                                {formatDegree(h.middleDegree as number)}
                                                            </td>
                                                            <td className="py-1.5 pr-2 text-gray-600">
                                                                {SIGN_SYMBOLS[(h.endSign as number) || 0] || ""}{" "}
                                                                {formatDegree(h.endDegree as number)}
                                                            </td>
                                                            <td className="py-1.5 text-gray-600">
                                                                {planetsInHouse.length > 0
                                                                    ? planetsInHouse
                                                                          .map((p) =>
                                                                              t(
                                                                                  `astrology.planetNames.${(p.name as number) || 1}`,
                                                                              ),
                                                                          )
                                                                          .join(", ")
                                                                    : "\u2014"}
                                                            </td>
                                                            <td className="py-1.5 text-gray-600">
                                                                {aspectsForHouse.length > 0
                                                                    ? aspectsForHouse.join(", ")
                                                                    : "\u2014"}
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {config.planetPositions && (cd?.planets as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("astrology.planets")}
                                </h5>
                                <div className="space-y-1.5">
                                    {(cd!.planets as Array<Record<string, unknown>>).map((p, i) => {
                                        const pName = p.name as number;
                                        const pSign = p.sign as number;
                                        const pStrength = parseStrength(p.strength) as PlanetaryStrength;
                                        const displayHouse =
                                            findHouse(p.absoluteDegree as number, cd!.houses as House[]) ??
                                            (p.house as number);
                                        const isPlanetExpanded = expandedPlanets.has(i);

                                        const aspects = ((p.aspects as Array<Record<string, unknown>>) || [])
                                            .filter((a) => (a.aspectType as number) !== 0)
                                            .map((a) => {
                                                const q = (cd!.planets as Array<Record<string, unknown>>).find(
                                                    (x) => (x.name as number) === (a.planetName as number),
                                                );
                                                if (!q) return "";
                                                const exactPoint =
                                                    ((p.absoluteDegree as number) + (a.aspectType as number)) % 360;
                                                let diff = exactPoint - (q.absoluteDegree as number);
                                                if (diff > 180) diff -= 360;
                                                if (diff < -180) diff += 360;
                                                if (Math.abs(diff) > (ORB_MAP[pName] ?? 0)) return "";
                                                return `${t(`astrology.planetNames.${a.planetName as number}`)} (${formatDegDiff(diff)})`;
                                            })
                                            .filter(Boolean) as string[];

                                        const conjunctions = (cd!.planets as Array<Record<string, unknown>>)
                                            .filter((q) => (q.name as number) !== pName)
                                            .filter((q) => {
                                                const dist = Math.abs(
                                                    (p.absoluteDegree as number) - (q.absoluteDegree as number),
                                                );
                                                return Math.min(dist, 360 - dist) < (ORB_MAP[pName] ?? 0);
                                            })
                                            .map((q) => {
                                                let diff = (q.absoluteDegree as number) - (p.absoluteDegree as number);
                                                if (diff > 180) diff -= 360;
                                                if (diff < -180) diff += 360;
                                                return `${t(`astrology.planetNames.${q.name as number}`)} (${formatDegDiff(diff)})`;
                                            });

                                        const tags: { key: string; text: string; strikethrough?: boolean }[] = [];
                                        if (p.combustion as boolean)
                                            tags.push({ key: "combustion", text: t("astrology.combustLabel") });
                                        if ((cd!.lord22ndDrekkana as number) === pName)
                                            tags.push({ key: "drekkana", text: t("astrology.drekkanaLordLabel") });
                                        if ((cd!.lord64thNavamsa as number) === pName)
                                            tags.push({ key: "navamsa", text: t("astrology.navamsaLordLabel") });
                                        if ((cd!.atmakaraka as number) === pName)
                                            tags.push({ key: "atmakaraka", text: t("astrology.atmakarakaLabel") });
                                        if ((cd!.maranakaraka as number) === pName)
                                            tags.push({ key: "maranakaraka", text: t("astrology.maranakarakaLabel") });
                                        if (((cd!.marakaPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "maraka", text: t("astrology.marakaLabel") });
                                        if (((cd!.badhakaPlanet as number[]) || []).includes(pName))
                                            tags.push({ key: "badhaka", text: t("astrology.badhakaLabel") });
                                        if (((cd!.nidhanamshaPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "nidhanamsha", text: t("astrology.nidhanamshaLabel") });
                                        if (((cd!.ashtamanshaPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "ashtamansha", text: t("astrology.ashtamanshaLabel") });
                                        if (((cd!.wargoththamaPlanets as number[]) || []).includes(pName)) {
                                            const crossed =
                                                ((cd!.gandanthaPlanets as number[]) || []).includes(pName) ||
                                                ((cd!.gandamulaPlanets as number[]) || []).includes(pName);
                                            tags.push({
                                                key: "wargoththama",
                                                text: t("astrology.wargoththamaLabel"),
                                                strikethrough: crossed,
                                            });
                                        }
                                        if (((cd!.gandanthaPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "gandanta", text: t("astrology.gandantaLabel") });
                                        if (((cd!.gandamulaPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "gandamula", text: t("astrology.gandamulaLabel") });
                                        if (((cd!.pushkaraPlanets as number[]) || []).includes(pName))
                                            tags.push({ key: "pushkara", text: t("astrology.pushkaraLabel") });

                                        const strengthKey = STRENGTH_TRANSLATION_KEYS[pStrength];
                                        const STRENGTH_COLORS: Record<string, string> = {
                                            athiUchcha: "text-green-700 font-semibold",
                                            exalted: "text-green-700 font-semibold",
                                            athiNeecha: "text-red-600",
                                            debilitated: "text-red-600",
                                            moolatrikona: "text-indigo-600 font-semibold",
                                            ownSign: "text-indigo-600 font-semibold",
                                        };
                                        const strengthClass = STRENGTH_COLORS[strengthKey] || "text-gray-600";

                                        return (
                                            <div key={i} className="border rounded overflow-hidden">
                                                <button
                                                    onClick={() => {
                                                        setExpandedPlanets((prev) => {
                                                            const next = new Set(prev);
                                                            if (next.has(i)) {
                                                                next.delete(i);
                                                            } else {
                                                                next.add(i);
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
                                                >
                                                    <span className="font-medium whitespace-nowrap">
                                                        {PLANET_SYMBOLS[pName] || ""}{" "}
                                                        {t(`astrology.planetNames.${pName}`)}
                                                    </span>
                                                    {(p.retrograde as boolean) && (
                                                        <span className="text-amber-600 bg-amber-50 text-[10px] rounded px-1 leading-tight">
                                                            {t("astrology.retrograde")}
                                                        </span>
                                                    )}
                                                    <span className="text-gray-600 whitespace-nowrap">
                                                        {t(`astrology.signNames.${pSign}`)}
                                                    </span>
                                                    <span className={`whitespace-nowrap ${strengthClass}`}>
                                                        {t(`astrology.${strengthKey}`)}
                                                    </span>
                                                    <span className="text-gray-600 whitespace-nowrap">
                                                        {t("astrology.house")} {displayHouse}
                                                    </span>
                                                    <span className="text-gray-500 whitespace-nowrap">
                                                        {t(`astrology.nakshatraNames.${(p.nakshatra as number) || 1}`)}{" "}
                                                        ({(p.pada as number) || 1})
                                                    </span>
                                                    {tags.length > 0 && (
                                                        <div className="flex gap-1 shrink-0 flex-wrap">
                                                            {tags.map((tag) => (
                                                                <span
                                                                    key={tag.key}
                                                                    className={`text-[10px] leading-tight px-1 rounded bg-gray-100 text-gray-600 ${
                                                                        tag.strikethrough ? "line-through" : ""
                                                                    }`}
                                                                >
                                                                    {tag.text}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <span className="ml-auto text-gray-400 shrink-0">
                                                        {isPlanetExpanded ? "▼" : "▶"}
                                                    </span>
                                                </button>
                                                {isPlanetExpanded && (
                                                    <div className="border-t px-3 py-1.5 space-y-1 text-[11px] text-gray-600 bg-gray-50">
                                                        <p>
                                                            <span className="font-medium text-gray-700">
                                                                {t("astrology.degree")}:
                                                            </span>{" "}
                                                            {formatDegree(p.degree as number)}
                                                        </p>
                                                        {conjunctions.length > 0 && (
                                                            <p>
                                                                <span className="font-medium text-gray-700">
                                                                    {t("astrology.conjunctions")}:
                                                                </span>{" "}
                                                                {conjunctions.join(", ")}
                                                            </p>
                                                        )}
                                                        {aspects.length > 0 && (
                                                            <p>
                                                                <span className="font-medium text-gray-700">
                                                                    {t("astrology.aspects")}:
                                                                </span>{" "}
                                                                {aspects.join(", ")}
                                                            </p>
                                                        )}
                                                        {tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                                {tags.map((tag) => (
                                                                    <span
                                                                        key={tag.key}
                                                                        className={`bg-white border rounded px-1.5 py-0.5 text-gray-600 ${
                                                                            tag.strikethrough ? "line-through" : ""
                                                                        }`}
                                                                    >
                                                                        {tag.text}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {config.dashas && (cd?.dashas as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("astrology.dashas")}
                                </h5>
                                <DashaTimeline dashas={cd!.dashas as Record<string, unknown>} />
                            </div>
                        )}

                        {config.yogas && (cd?.yogas as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("search.card.yogas")}
                                </h5>
                                {(cd!.yogas as Array<Record<string, unknown>>).length > 0 ? (
                                    <div className="space-y-1">
                                        {(cd!.yogas as Array<Record<string, unknown>>).map((y, i) => (
                                            <div key={i} className="flex items-center gap-1.5 text-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                                <span className="font-medium text-gray-700">{y.name as string}</span>
                                                {y.isBeneficial === false && (
                                                    <span className="text-[10px] px-1 rounded bg-red-50 text-red-600">
                                                        {t("search.card.malefic")}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400">{t("search.card.noYogas")}</span>
                                )}
                            </div>
                        )}

                        {config.doshas && (cd?.doshas as boolean) && (
                            <div>
                                <h5 className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                                    {t("search.card.doshas")}
                                </h5>
                                {(
                                    (cd!.doshas as Record<string, unknown>).doshas as
                                        Array<Record<string, unknown>> | undefined
                                )?.filter((d) => d.isPresent).length ? (
                                    <div className="space-y-1">
                                        {(
                                            (cd!.doshas as Record<string, unknown>).doshas as Array<
                                                Record<string, unknown>
                                            >
                                        )
                                            .filter((d) => d.isPresent)
                                            .map((d, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${((d.severity as string) || "").toLowerCase() === "high" ? "bg-red-400" : "bg-amber-400"}`}
                                                    />
                                                    <span className="font-medium text-gray-700">
                                                        {d.name as string}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        {(d.severity as string) || ""}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400">{t("search.card.noDoshas")}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PaginationControls = ({
    page,
    totalPages,
    total,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (p: number) => void;
}) => {
    const { t } = useI18n();
    if (total === 0) return null;

    const pages: number[] = [];
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-6">
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {t("search.pagination.previous")}
            </button>

            {startPage > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                    >
                        1
                    </button>
                    {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                </>
            )}

            {pages.map((p) => (
                <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`px-3 py-1.5 text-sm border rounded ${
                        p === page ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"
                    }`}
                >
                    {p}
                </button>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {t("search.pagination.next")}
            </button>

            <span className="text-sm text-gray-500 ml-2">
                {t("search.pagination.pageOf", { page, totalPages, total })}
            </span>
        </div>
    );
};

const ConfigPanel = ({
    config,
    onToggle,
    onReset,
    isOpen,
    onClose,
}: {
    config: Record<string, boolean>;
    onToggle: (key: string) => void;
    onReset: () => void;
    isOpen: boolean;
    onClose: () => void;
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Result configuration"
        >
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Result Configuration</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onReset} className="text-xs text-indigo-600 hover:underline">
                            Reset
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-lg"
                            aria-label="Close config panel"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {CONFIG_CATEGORIES.map((cat) => (
                        <div key={cat.key}>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                {cat.label}
                            </h4>
                            <div className="space-y-1">
                                {cat.sections.map((sec) => (
                                    <label
                                        key={sec.key}
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={config[sec.key] ?? false}
                                            onChange={() => onToggle(sec.key)}
                                            className="rounded border-gray-300"
                                        />
                                        {sec.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="pt-3 border-t flex gap-2">
                        <button
                            onClick={() => {
                                Object.keys(config).forEach((k) => {
                                    if (!config[k]) onToggle(k);
                                });
                            }}
                            className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => {
                                Object.keys(config).forEach((k) => {
                                    if (config[k]) onToggle(k);
                                });
                            }}
                            className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
                        >
                            Deselect All
                        </button>
                        <button
                            onClick={onReset}
                            className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 text-indigo-600"
                        >
                            Reset to Defaults
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SearchHistoryPanel = ({
    entries,
    onReRun,
    onClearAll,
    onDeleteEntry,
    onClose,
    isOpen,
}: {
    entries: HistoryEntry[];
    onReRun: (query: string) => void;
    onClearAll: () => void;
    onDeleteEntry: (id: string) => void;
    onClose: () => void;
    isOpen: boolean;
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Search history"
        >
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Recent Searches</h3>
                    <div className="flex items-center gap-2">
                        {entries.length > 0 && (
                            <button onClick={onClearAll} className="text-xs text-red-600 hover:underline">
                                Clear All
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    {entries.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No search history yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="p-3 rounded border hover:bg-gray-50 cursor-pointer"
                                    onClick={() => onReRun(entry.query)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="flex items-start justify-between">
                                        <p className="text-sm font-medium truncate flex-1">{entry.query}</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteEntry(entry.id);
                                            }}
                                            className="text-gray-400 hover:text-red-500 text-xs shrink-0 ml-2"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <span>{entry.resultCount} results</span>
                                        <span>{entry.language === "si" ? "🇱🇰 Sinhala" : "🇬🇧 English"}</span>
                                        <span className="px-1 rounded bg-gray-100">{entry.source}</span>
                                        <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SavedSearchesPanel = ({
    filters,
    onRun,
    onEditName,
    onDelete,
    onClose,
    isOpen,
}: {
    filters: SavedFilterEntry[];
    onRun: (f: SavedFilterEntry) => void;
    onEditName: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
    isOpen: boolean;
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Saved searches"
        >
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Saved Searches</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                        ✕
                    </button>
                </div>

                <div className="p-4">
                    {filters.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No saved searches yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {filters.map((f) => (
                                <div key={f.id} className="p-3 rounded border">
                                    {editingId === f.id ? (
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 border rounded px-2 py-1 text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && editName.trim()) {
                                                        onEditName(f.id, editName);
                                                        setEditingId(null);
                                                    }
                                                    if (e.key === "Escape") {
                                                        setEditingId(null);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => {
                                                    if (editName.trim()) {
                                                        onEditName(f.id, editName);
                                                        setEditingId(null);
                                                    }
                                                }}
                                                className="text-xs text-indigo-600"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <h4
                                            className="font-medium text-sm cursor-pointer hover:text-indigo-600"
                                            onClick={() => {
                                                setEditingId(f.id);
                                                setEditName(f.name);
                                            }}
                                        >
                                            {f.name}
                                        </h4>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1 truncate">{f.query}</p>
                                    {f.lastRunAt && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            Last run: {new Date(f.lastRunAt).toLocaleDateString()} ({f.resultCount}{" "}
                                            results)
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => onRun(f)}
                                            className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                                        >
                                            Run
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingId(f.id);
                                                setEditName(f.name);
                                            }}
                                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                                        >
                                            Edit Name
                                        </button>
                                        <button
                                            onClick={() => onDelete(f.id)}
                                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-gray-400 text-center mt-4">Maximum 50 saved searches.</p>
                </div>
            </div>
        </div>
    );
};

const BookmarksPanel = ({
    bookmarks,
    onRemove,
    onOpen,
    onClose,
    isOpen,
}: {
    bookmarks: BookmarkEntry[];
    onRemove: (horoscopeId: string) => void;
    onOpen: (horoscopeId: string) => void;
    onClose: () => void;
    isOpen: boolean;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Bookmarks">
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Bookmarks</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                        ✕
                    </button>
                </div>

                <div className="p-4">
                    {bookmarks.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">
                            No bookmarks yet. Bookmark horoscopes from search results to save them here.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {bookmarks.map((b) => (
                                <div key={b.id} className="p-3 rounded border">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium text-sm">
                                                {b.isAvailable
                                                    ? b.horoscopeDetail?.name || "Unknown"
                                                    : "Horoscope no longer available"}
                                            </h4>
                                            {b.queryContext && (
                                                <p className="text-xs text-gray-500 mt-1">Query: {b.queryContext}</p>
                                            )}
                                            {b.notes && <p className="text-xs text-gray-500 mt-1">Note: {b.notes}</p>}
                                            <p className="text-xs text-gray-400 mt-1">
                                                Saved: {new Date(b.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => onRemove(b.horoscope.id)}
                                            className="text-gray-400 hover:text-red-500 text-xs shrink-0 ml-2"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    {b.isAvailable && (
                                        <button
                                            onClick={() => onOpen(b.horoscope.id)}
                                            className="text-xs text-indigo-600 hover:underline mt-2"
                                        >
                                            Open
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-gray-400 text-center mt-4">Maximum 100 bookmarks.</p>
                </div>
            </div>
        </div>
    );
};

export default function SearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

    const [config, setConfig] = useState<Record<string, boolean>>(DEFAULT_CONFIG);
    const [activeChart, setActiveChart] = useState(CHART_TABS[0].key);
    const [configOpen, setConfigOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [savedFilterOpen, setSavedFilterOpen] = useState(false);
    const [bookmarksOpen, setBookmarksOpen] = useState(false);

    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [savedFilters, setSavedFilters] = useState<SavedFilterEntry[]>([]);
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
    const queryInputRef = useRef<HTMLInputElement>(null);

    const detectedLanguage = detectLanguage(query);

    const { lastToken } = splitLastToken(query);
    const suggestions = useMemo(() => (suggestionsOpen ? getSuggestions(lastToken) : []), [suggestionsOpen, lastToken]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch("/api/search/history");
            const data = await res.json();
            setHistoryEntries(data.entries || []);
        } catch {
            // ignore
        }
    }, []);

    const fetchSavedFilters = useCallback(async () => {
        try {
            const res = await fetch("/api/search/filter");
            const data = await res.json();
            setSavedFilters(data.filters || []);

            if (data.defaultFilter?.filterConfig) {
                setConfig((prev) => ({
                    ...prev,
                    ...data.defaultFilter.filterConfig,
                }));
            }
        } catch {
            // ignore
        }
    }, []);

    const fetchBookmarks = useCallback(async () => {
        try {
            const res = await fetch("/api/search/bookmark");
            const data = await res.json();
            setBookmarks(data.bookmarks || []);

            const ids = new Set<string>();
            (data.bookmarks || []).forEach((b: BookmarkEntry) => ids.add(b.horoscope.id));
            setBookmarkedIds(ids);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }

        if (status === "authenticated") {
            fetchSavedFilters();
            fetchBookmarks();
        }
    }, [status, router, fetchSavedFilters, fetchBookmarks]);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [query]);

    const handleSearch = useCallback(
        async (searchQuery?: string, searchPage?: number) => {
            const q = searchQuery ?? query;
            const p = searchPage ?? 1;

            if (!q.trim()) return;

            setLoading(true);
            setSearched(true);
            setPage(p);

            try {
                const res = await fetch("/api/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: q,
                        page: p,
                        pageSize: 6,
                    }),
                });

                const data = await res.json();
                setResults(data.results || []);
                setTotalResults(data.total || 0);
                setTotalPages(data.totalPages || 0);

                setExpandedCards(new Set((data.results || []).map((_: unknown, i: number) => i)));

                fetchHistory();
            } catch {
                setResults([]);
                setTotalResults(0);
                setTotalPages(0);
            } finally {
                setLoading(false);
            }
        },
        [query, fetchHistory],
    );

    const handlePageChange = (newPage: number) => {
        handleSearch(undefined, newPage);
    };

    const handleSelectSuggestion = (suggestion: string) => {
        setQuery((prev) => insertSuggestion(prev, suggestion));
        setSuggestionsOpen(false);
        setHighlightedSuggestion(0);
        queryInputRef.current?.focus();
    };

    const toggleExpanded = (index: number) => {
        setExpandedCards((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedCards(new Set(results.map((_, i) => i)));
    };

    const collapseAll = () => {
        setExpandedCards(new Set());
    };

    const isAllExpanded = results.length > 0 && expandedCards.size === results.length;

    const handleBookmark = async (horoscopeId: string) => {
        if (bookmarkedIds.has(horoscopeId)) {
            try {
                await fetch(`/api/search/bookmark/${horoscopeId}`, {
                    method: "DELETE",
                });
                setBookmarkedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(horoscopeId);
                    return next;
                });
                fetchBookmarks();
            } catch {
                // ignore
            }
        } else {
            try {
                await fetch("/api/search/bookmark", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        horoscopeId,
                        queryContext: query,
                    }),
                });
                setBookmarkedIds((prev) => new Set(prev).add(horoscopeId));
                fetchBookmarks();
            } catch {
                // ignore
            }
        }
    };

    const handleConfigToggle = (key: string) => {
        setConfig((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            const timeoutId = setTimeout(async () => {
                try {
                    await fetch("/api/search/filter", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: "__default__",
                            filterConfig: next,
                        }),
                    });
                } catch {
                    // ignore
                }
            }, 500);
            return next;
        });
    };

    const handleConfigReset = () => {
        setConfig(DEFAULT_CONFIG);
        fetch("/api/search/filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "__default__",
                filterConfig: DEFAULT_CONFIG,
            }),
        }).catch(() => {});
    };

    const handleReRunHistory = (q: string) => {
        setQuery(q);
        setHistoryOpen(false);
        handleSearch(q, 1);
    };

    const handleClearHistory = async () => {
        if (!confirm("Clear all search history? This cannot be undone.")) return;

        try {
            await fetch("/api/search/history", { method: "DELETE" });
            setHistoryEntries([]);
        } catch {
            // ignore
        }
    };

    const handleDeleteHistoryEntry = async (id: string) => {
        try {
            await fetch(`/api/search/history/${id}`, { method: "DELETE" });
            fetchHistory();
        } catch {
            // ignore
        }
    };

    const handleRunSavedFilter = (f: SavedFilterEntry) => {
        setQuery(f.query);
        if (f.filterConfig) {
            setConfig((prev) => ({ ...prev, ...f.filterConfig }));
        }
        setSavedFilterOpen(false);
        handleSearch(f.query, 1);
    };

    const handleEditSavedFilterName = async (id: string, name: string) => {
        try {
            await fetch(`/api/search/filter/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            fetchSavedFilters();
        } catch {
            // ignore
        }
    };

    const handleDeleteSavedFilter = async (id: string) => {
        try {
            await fetch(`/api/search/filter/${id}`, { method: "DELETE" });
            fetchSavedFilters();
        } catch {
            // ignore
        }
    };

    const handleSaveSearch = async () => {
        const name = prompt("Name this search:");
        if (!name?.trim()) return;

        try {
            const res = await fetch("/api/search/filter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    query,
                    filterConfig: config,
                }),
            });

            if (res.ok) {
                fetchSavedFilters();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save search");
            }
        } catch {
            // ignore
        }
    };

    const handleRemoveBookmark = async (horoscopeId: string) => {
        try {
            await fetch(`/api/search/bookmark/${horoscopeId}`, {
                method: "DELETE",
            });
            setBookmarkedIds((prev) => {
                const next = new Set(prev);
                next.delete(horoscopeId);
                return next;
            });
            fetchBookmarks();
        } catch {
            // ignore
        }
    };

    const handleOpenBookmark = (horoscopeId: string) => {
        router.push(`/horoscopes/${horoscopeId}`);
    };

    const handleExport = async (format: string) => {
        const params = new URLSearchParams({
            format,
            query,
            page: String(page),
        });

        try {
            const res = await fetch(`/api/search/export?${params.toString()}`);

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Export failed");
                return;
            }

            if (format === "csv") {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "search-results.csv";
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "search-results.json";
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch {
            // ignore
        }
    };

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className="relative">
            <h1 className="text-2xl font-bold mb-6">{t("search.title")}</h1>

            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6" suppressHydrationWarning>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            ref={queryInputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setSuggestionsOpen(true);
                                setHighlightedSuggestion(0);
                            }}
                            onFocus={() => setSuggestionsOpen(true)}
                            onBlur={() => setSuggestionsOpen(false)}
                            onKeyDown={(e) => {
                                if (suggestionsOpen && suggestions.length > 0) {
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setHighlightedSuggestion((i) => (i + 1) % suggestions.length);
                                        return;
                                    }
                                    if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setHighlightedSuggestion(
                                            (i) => (i - 1 + suggestions.length) % suggestions.length,
                                        );
                                        return;
                                    }
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSelectSuggestion(suggestions[highlightedSuggestion]);
                                        return;
                                    }
                                    if (e.key === "Escape") {
                                        setSuggestionsOpen(false);
                                        return;
                                    }
                                }

                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    setSuggestionsOpen(false);
                                    handleSearch();
                                }
                            }}
                            placeholder={t("search.placeholder")}
                            className="w-full border rounded px-3 py-2 text-sm pr-12"
                            role="searchbox"
                            aria-label="Search horoscopes"
                            aria-autocomplete="list"
                            aria-expanded={suggestionsOpen && suggestions.length > 0}
                            maxLength={500}
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                            >
                                ✕
                            </button>
                        )}
                        {suggestionsOpen && (
                            <SearchSuggestions
                                suggestions={suggestions}
                                highlightedIndex={highlightedSuggestion}
                                onSelect={handleSelectSuggestion}
                                onHover={setHighlightedSuggestion}
                            />
                        )}
                    </div>
                    <button
                        onClick={() => handleSearch()}
                        disabled={loading || !query.trim()}
                        suppressHydrationWarning
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
                    >
                        {loading ? "Searching..." : t("search.search")}
                    </button>
                    <button
                        onClick={() => setConfigOpen(true)}
                        className="border px-3 py-2 rounded hover:bg-gray-50 text-sm relative"
                        title="Configure display"
                    >
                        ⚙️
                    </button>
                    <button
                        onClick={handleSaveSearch}
                        disabled={!query.trim() || !searched}
                        suppressHydrationWarning
                        className="border px-3 py-2 rounded hover:bg-gray-50 text-sm disabled:opacity-50"
                        title="Save search"
                    >
                        💾
                    </button>
                    <button
                        onClick={() => {
                            fetchHistory();
                            setHistoryOpen(true);
                        }}
                        className="border px-3 py-2 rounded hover:bg-gray-50 text-sm"
                        title="Search history"
                    >
                        📋
                    </button>
                    <button
                        onClick={() => handleExport("csv")}
                        className="border px-3 py-2 rounded hover:bg-gray-50 text-sm"
                        title="Export"
                    >
                        📊
                    </button>
                </div>

                <div className="flex gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                        {detectedLanguage === "si" ? "🇱🇰 Sinhala detected" : query ? "🇬🇧 English detected" : ""}
                    </span>
                </div>

                <p className="text-xs text-gray-400 mt-2">{t("search.basicSearch")}</p>
                <p className="text-xs text-gray-400">{t("search.complexSearch")}</p>
            </div>

            <div className="flex items-center justify-between mb-4">
                {searched && (
                    <>
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500">Found {totalResults} horoscopes</p>
                            <div className="flex gap-1">
                                {isAllExpanded ? (
                                    <button onClick={collapseAll} className="text-xs text-indigo-600 hover:underline">
                                        Collapse All
                                    </button>
                                ) : (
                                    <button onClick={expandAll} className="text-xs text-indigo-600 hover:underline">
                                        Expand All
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleExport("csv")}
                                disabled={results.length === 0}
                                className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Export CSV
                            </button>
                            <button
                                onClick={() => handleExport("json")}
                                disabled={results.length === 0}
                                className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Export JSON
                            </button>
                        </div>
                    </>
                )}
            </div>

            {searched && (
                <div>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-lg border animate-pulse">
                                    <div className="p-3">
                                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                                        <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
                                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    </div>
                                    <div className="border-t">
                                        <div className="flex">
                                            {[1, 2, 3].map((j) => (
                                                <div
                                                    key={j}
                                                    className="flex-1 h-8 bg-gray-100 border-r last:border-r-0"
                                                />
                                            ))}
                                        </div>
                                        <div className="aspect-square bg-gray-50" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
                            {t("search.noResults")}
                        </div>
                    ) : (
                        <>
                            <div
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                role="region"
                                aria-label="Search results"
                            >
                                {results.map((r, i) => (
                                    <SearchResultCard
                                        key={i}
                                        result={r}
                                        config={config}
                                        activeChart={activeChart}
                                        onChartTabChange={setActiveChart}
                                        isExpanded={expandedCards.has(i)}
                                        onToggleExpand={() => toggleExpanded(i)}
                                        onBookmark={() =>
                                            handleBookmark((r.horoscope._id as string) || (r.horoscope.id as string))
                                        }
                                        isBookmarked={bookmarkedIds.has(
                                            (r.horoscope._id as string) || (r.horoscope.id as string),
                                        )}
                                    />
                                ))}
                            </div>

                            <div className="mt-6">
                                <PaginationControls
                                    page={page}
                                    totalPages={totalPages}
                                    total={totalResults}
                                    onPageChange={handlePageChange}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {!searched && (
                <div className="text-center py-20 text-gray-400">
                    <svg
                        className="w-12 h-12 mx-auto mb-3 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    <p className="text-sm">{t("search.placeholder")}</p>
                </div>
            )}

            <ConfigPanel
                config={config}
                onToggle={handleConfigToggle}
                onReset={handleConfigReset}
                isOpen={configOpen}
                onClose={() => setConfigOpen(false)}
            />

            <SearchHistoryPanel
                entries={historyEntries}
                onReRun={handleReRunHistory}
                onClearAll={handleClearHistory}
                onDeleteEntry={handleDeleteHistoryEntry}
                onClose={() => setHistoryOpen(false)}
                isOpen={historyOpen}
            />

            <SavedSearchesPanel
                filters={savedFilters.filter((f) => f.name !== "__default__")}
                onRun={handleRunSavedFilter}
                onEditName={handleEditSavedFilterName}
                onDelete={handleDeleteSavedFilter}
                onClose={() => setSavedFilterOpen(false)}
                isOpen={savedFilterOpen}
            />

            <BookmarksPanel
                bookmarks={bookmarks}
                onRemove={handleRemoveBookmark}
                onOpen={handleOpenBookmark}
                onClose={() => setBookmarksOpen(false)}
                isOpen={bookmarksOpen}
            />
        </div>
    );
}
