"use client";

import { BirthChart } from "@/components/BirthChart";
import CalculatedChartBadge from "@/components/CalculatedChartBadge";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import DashaSection from "@/components/Dasha/DashaSection";
import { HouseChart } from "@/components/HouseChart";
import DerivedRangesSection from "@/components/ManualChart/DerivedRanges";
import ManualChartEditor from "@/components/ManualChart/ManualChartEditor";
import PrivacyBadge from "@/components/PrivacyBadge";
import PrivacyToggle from "@/components/PrivacyToggle";
import AspectChip from "@/components/aspects/AspectChip";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import ValidationBadges from "@/components/ManualChart/ValidationBadges";
import type { Ascendant, Aspect, CalculationResult, Dashas, House, Planet } from "@/lib/astrology";
import {
    computeAscendantSpecialFlags,
    computeMaranakaraka,
    computePanchaPakshi,
    computeThithiFromPlanets,
    findHouse,
    formatDegree,
    navamsaSign,
} from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { getChartData, toBirthChartData } from "@/lib/chartDataTransform";
import type { ChartInput } from "@/lib/chartDataTransform";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";
import { formatDate } from "@/lib/date";
import { readHoroscopeSort } from "@/lib/horoscopeSort";
import {
    buildBhavaHouses,
    buildWholeSignHouses,
    calculateManualDashas,
    computeAscendantNakshatra,
    computeMoonNakshatra,
    deriveBirthTimeRange,
    formatNavamsaDegreeRange,
    navamsaIndexForSign,
    synthesizeOtherDetails,
    synthesizeValidation,
} from "@/lib/manualChart";
import type { DerivedRanges, ManualHouse, ManualHousePlacements } from "@/lib/manualChart";
import { computeManualPlanetAspects } from "@/lib/planetAspects";

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
    source?: "auto" | "manual";
    birthDate: string;
    birthTime: string;
    location?: { id: string } | null;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    gender?: string;
    ayanamsha?: string;
    owner?: { id: string };
}

interface ChartData {
    type: ChartType;
    data: {
        planets: Planet[];
        houses: House[];
        ascendant: Ascendant;
    };
    svgData: string;
    _id: string;
}

function placementsRecord(manual: ManualHouse[]): Record<number, number[]> {
    const result: Record<number, number[]> = {};
    manual.forEach((h) => {
        if (h.planets.length > 0) result[h.houseNumber] = h.planets;
    });
    return result;
}

/** Effective ascendant absolute degree (0-360) for a manual horoscope: the CENTER of the ascendant's
 *  navamsa wedge (the "mid of the degree range" the calculations tab shows), derived from the entered
 *  `lagnaDegree` when given, else the stored navamsa lagna. The chart's lagna line and house-1 bhava
 *  middle are anchored to this so they stay centered on the highlighted navamsa wedge. */
function manualAscAbsDeg(mhp: { lagna: number; lagnaDegree?: number; navamsaLagna?: number }): number {
    const arc = 30 / 9;
    let index = 1;
    if (mhp.lagnaDegree !== undefined) index = Math.floor(mhp.lagnaDegree / arc) + 1;
    else if (mhp.navamsaLagna !== undefined) index = navamsaIndexForSign(mhp.lagna, mhp.navamsaLagna);
    return (mhp.lagna - 1) * 30 + (index - 0.5) * arc;
}

/** Navamsa segment (1-9) within its sign that CONTAINS an absolute degree: `{ sign, start, end }`
 *  in-sign degree range. Used to render the calc-tab Start/End boundaries as navamsa segments
 *  (matching the Mid column's DD:MM–DD:MM format), derived from the house cusps `midAbs ± 15°`. */
function navamsaSegmentForAbsDegree(abs: number): { sign: number; start: number; end: number } {
    const arc = 30 / 9;
    const norm = ((abs % 360) + 360) % 360;
    const sign = Math.floor(norm / 30) + 1;
    const inSign = norm % 30;
    const index = Math.floor(inSign / arc) + 1;
    return { sign, start: (index - 1) * arc, end: index * arc };
}

function birthDateInputValue(value?: Date | string): string {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
            thithi: number;
            panchaPakshi?: number;
            dashas: unknown;
            lord22ndDrekkana: number;
            lord64thNavamsa: number;
            badhakaPlanet: number[];
            marakaPlanets: number[];
            nidhanamshaPlanets: number[];
            ashtamanshaPlanets: number[];
            atmakaraka: number;
            maranakaraka: number;
            isAscendantWargoththama: boolean;
            isAscendantGandantha: boolean;
            isAscendantGandamula: boolean;
            isAscendantPushkara: boolean;
            wargoththamaPlanets: number[];
            gandanthaPlanets: number[];
            gandamulaPlanets: number[];
            pushkaraPlanets: number[];
            yogas: unknown[];
            doshas: { doshas: unknown[] };
            manualHousePlacements?: ManualHousePlacements;
            derivedRanges?: DerivedRanges;
        } | null;
        charts: ChartData[];
        metadata: unknown[];
        navigation: {
            prev: { id: string; name: string } | null;
            next: { id: string; name: string } | null;
            position: number;
            total: number;
        };
    } | null>(null);
    const [activeTab, setActiveTab] = useState("charts");
    const [selectedChart, setSelectedChart] = useState<ChartType>(ChartType.HOUSE);
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

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [expandedHouses, setExpandedHouses] = useState<Set<number>>(new Set());
    const [expandedPlanets, setExpandedPlanets] = useState<Set<number>>(new Set());

    const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false);
    const [editingChart, setEditingChart] = useState(false);
    const [savingPrivacy, setSavingPrivacy] = useState(false);
    const [privacyError, setPrivacyError] = useState<string | null>(null);
    const [isPublicState, setIsPublicState] = useState(false);
    const [displayNameState, setDisplayNameState] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (data) {
            setIsPublicState(data.horoscope.isPublic);
            setDisplayNameState(data.horoscope.displayName ?? true);
        }
    }, [data]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handlePrivacyChange = async (settings: { isPublic?: boolean; displayName?: boolean }) => {
        if (settings.isPublic !== undefined) setIsPublicState(settings.isPublic);
        if (settings.displayName !== undefined) setDisplayNameState(settings.displayName);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSavingPrivacy(true);
        setPrivacyError(null);

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/horoscope/${params.id}/privacy`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(settings),
                });
                if (!res.ok) throw new Error("Failed to save");
                const updated = await res.json();
                setIsPublicState(updated.isPublic);
                setDisplayNameState(updated.displayName ?? true);

                if (settings.isPublic === true) {
                    setToast({ message: t("horoscope.toast.privacy.now_public"), type: "success" });
                } else if (settings.isPublic === false) {
                    setToast({ message: t("horoscope.toast.privacy.now_private"), type: "info" });
                } else if (settings.displayName === false) {
                    setToast({ message: t("horoscope.toast.privacy.name_hidden"), type: "success" });
                } else if (settings.displayName === true) {
                    setToast({ message: t("horoscope.toast.privacy.name_shown"), type: "success" });
                }
            } catch {
                if (settings.isPublic !== undefined) {
                    setIsPublicState(data?.horoscope.isPublic ?? false);
                }
                if (settings.displayName !== undefined) {
                    setDisplayNameState(data?.horoscope.displayName ?? true);
                }
                setPrivacyError(t("horoscope.error.privacy.save_failed"));
            } finally {
                setSavingPrivacy(false);
            }
        }, 300);
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;

        setLoading(true);
        setData(null);

        const { sortBy, sortDir } = readHoroscopeSort();

        fetch(`/api/horoscope/${params.id}?sortBy=${sortBy}&sortDir=${sortDir}`)
            .then((r) => r.json())
            .then((d) => {
                if (
                    d?.horoscope?.source === "manual" &&
                    d?.calculatedDetails?.manualHousePlacements &&
                    d?.calculatedDetails?.planets
                ) {
                    // Older records persisted `null` for absent lagnaDegree/navamsaLagna, which the
                    // `!== undefined` checks below would otherwise treat as present (making the lagna
                    // line point at the sign start instead of the navamsa-wedge center). Normalize
                    // null -> undefined once so every derived value uses the same source of truth.
                    const mhp = {
                        ...d.calculatedDetails.manualHousePlacements,
                        lagnaDegree: d.calculatedDetails.manualHousePlacements.lagnaDegree ?? undefined,
                        navamsaLagna: d.calculatedDetails.manualHousePlacements.navamsaLagna ?? undefined,
                    };
                    const moon = (d.calculatedDetails.planets as Planet[]).find((p) => p.name === 2);
                    const moonNakshatra = moon ? computeMoonNakshatra(moon.sign, moon.navamsaSign) : undefined;
                    const birthDate = d.horoscope?.birthDate ? new Date(d.horoscope.birthDate) : null;
                    d = {
                        ...d,
                        calculatedDetails: {
                            ...d.calculatedDetails,
                            ...synthesizeOtherDetails(mhp, d.calculatedDetails.planets),
                            manualHousePlacements: {
                                ...mhp,
                                validation: synthesizeValidation(mhp),
                            },
                            houses: (() => {
                                const lagna = mhp.lagna;
                                return buildBhavaHouses(lagna, manualAscAbsDeg(mhp));
                            })(),
                            nakshatra: {
                                ...d.calculatedDetails.nakshatra,
                                ascendantNakshatra: computeAscendantNakshatra(mhp),
                                moonNakshatra,
                            },
                            dashas: moonNakshatra
                                ? calculateManualDashas(moonNakshatra.id, moonNakshatra.pada, birthDate)
                                : (d.calculatedDetails.dashas as Dashas),
                            thithi: computeThithiFromPlanets(d.calculatedDetails.planets as Planet[]),
                            derivedRanges: (() => {
                                const stored = d.calculatedDetails.derivedRanges as DerivedRanges | undefined;
                                const ravi = (d.calculatedDetails.planets as Planet[]).find((p) => p.name === 1);
                                const birthTimeRange = ravi ? deriveBirthTimeRange(ravi.house) : null;
                                return {
                                    ...stored,
                                    birthTimeRange,
                                };
                            })(),
                        },
                    };
                }
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

    const { horoscope, calculatedDetails } = data;

    // Maranakaraka uses the cusp-based calculated house (findHouse), the same house shown in the
    // chart. Auto horoscopes stored before this fix may carry a stale value computed from the
    // whole-sign house, so recompute it at render time from planets + houses. Manual horoscopes
    // already get the correct value (entered house) from synthesizeOtherDetails.
    const resolvedMaranakaraka =
        calculatedDetails?.planets && calculatedDetails?.houses && horoscope.source !== "manual"
            ? computeMaranakaraka(calculatedDetails.planets, calculatedDetails.houses)
            : (calculatedDetails?.maranakaraka ?? 0);

    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/horoscope/${params.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            router.push("/");
        } catch {
            setDeleteError(t("common.error"));
            setDeleting(false);
        }
    };

    const goToHoroscope = (id: string) => {
        router.push(`/horoscopes/${id}`);
        window.scrollTo({ top: 0, behavior: "auto" });
    };

    const renderNav = () => {
        const { prev, next, position, total } = data?.navigation ?? { prev: null, next: null, position: 1, total: 1 };

        const NavLink = ({ direction }: { direction: "prev" | "next" }) => {
            const target = direction === "prev" ? prev : next;
            const buttonClass =
                "group flex items-center gap-2 rounded-lg border px-3 py-2 min-w-0 max-w-[40%] transition-colors " +
                (target
                    ? "hover:bg-gray-50 hover:border-indigo-300"
                    : "opacity-40 cursor-not-allowed pointer-events-none");
            const textClass = "min-w-0 flex flex-col";
            const arrow =
                direction === "prev" ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 shrink-0"
                    >
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
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
                        className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 shrink-0"
                    >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                );

            if (!target) {
                return (
                    <div className={buttonClass}>
                        {direction === "prev" && arrow}
                        <div className={textClass}>
                            <span className="text-xs text-gray-500">{t(`horoscope.nav.${direction}`)}</span>
                        </div>
                        {direction === "next" && arrow}
                    </div>
                );
            }

            return (
                <button
                    onClick={() => goToHoroscope(target.id)}
                    className={buttonClass}
                    aria-label={t(`horoscope.nav.${direction}Aria`, { name: target.name })}
                    title={target.name}
                >
                    {direction === "prev" && arrow}
                    <div className={textClass}>
                        <span className="text-xs text-gray-500">{t(`horoscope.nav.${direction}`)}</span>
                        <span className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-700">
                            {target.name}
                        </span>
                    </div>
                    {direction === "next" && arrow}
                </button>
            );
        };

        return (
            <div className="flex items-center justify-between gap-3 mb-4">
                <NavLink direction="prev" />
                <span className="text-xs text-gray-500 whitespace-nowrap">
                    {t("horoscope.nav.position", { position: String(position), total: String(total) })}
                </span>
                <NavLink direction="next" />
            </div>
        );
    };

    const getPlanetName = (id: number): string => t(`astrology.planetNames.${id}`);
    const getSignName = (id: number): string => t(`astrology.signNames.${id}`);
    const getNakshatraName = (id: number): string => t(`astrology.nakshatraNames.${id}`);
    const getThithiName = (id: number): string => t(`astrology.thithiNames.${id}`);

    const getPanchaPakshiName = (id: number): string => t(`astrology.panchaPakshiNames.${id}`);

    /** Pancha Pakshi (පංච පක්ෂී) bird, recomputed from the Moon nakshatra + paksha at render time
     *  so older CalculatedDetails documents that predate the `panchaPakshi` field still display it. */
    const getPanchaPakshi = (): number => {
        if (typeof calculatedDetails?.panchaPakshi === "number") return calculatedDetails.panchaPakshi;
        const moonNakId = calculatedDetails?.nakshatra?.moonNakshatra?.id;
        const thithi = getThithi();
        return computePanchaPakshi(moonNakId ?? 1, thithi);
    };
    const getPadaFormat = (pada: number): string => t("astrology.padaFormat", { pada: String(pada) });
    const getDashaLevelName = (level: string): string => t(`astrology.dashaLevels.${level}`);

    /** Thithi of the Moon, with a render-time fallback for older CalculatedDetails documents that
     *  predate the `thithi` field (recomputed from the stored Sun/Moon planets). */
    const getThithi = (): number => {
        if (typeof calculatedDetails?.thithi === "number") return calculatedDetails.thithi;
        return computeThithiFromPlanets(calculatedDetails?.planets ?? []);
    };

    const getNavamsaSign = (sign: number, degree: number): number => {
        const navamsaNum = Math.floor(degree / (30 / 9)) + 1;
        return navamsaSign(sign, navamsaNum);
    };

    const getNavamsaChartData = (): { planets: Planet[]; houses: House[]; ascendant: Ascendant } | null => {
        if (!calculatedDetails) return null;

        if (horoscope.source === "manual" && calculatedDetails.manualHousePlacements) {
            const { navamsaLagna, navamsaHouses } = calculatedDetails.manualHousePlacements;
            if (navamsaLagna !== undefined) {
                const houses = buildWholeSignHouses(navamsaLagna);
                const planets: Planet[] = [];
                navamsaHouses?.forEach(({ houseNumber, sign, planets: housePlanets }) => {
                    housePlanets.forEach((name) => {
                        planets.push({
                            name,
                            sign,
                            degree: 0,
                            absoluteDegree: 0,
                            house: houseNumber,
                            nakshatra: 0,
                            pada: 0,
                            retrograde: false,
                            combustion: false,
                            strength: PlanetaryStrength.SAMA,
                            navamsaSign: sign,
                            navamsaStrength: PlanetaryStrength.SAMA,
                            aspects: [],
                        });
                    });
                });
                const ascendant: Ascendant = {
                    sign: navamsaLagna,
                    degree: 0,
                    lord: SIGN_LORD_MAP[navamsaLagna] ?? 1,
                };
                return { planets, houses, ascendant };
            }
        }

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

    /** Degree label for the birth (Rashi) chart center. Manual horoscopes show the user-entered
     *  lagna degree when given; otherwise they show the navamsa-segment degree range implied by the
     *  stored navamsa lagna. Auto (ephemeris) charts keep their real ascendant degree. */
    const getBirthChartAscendantDegreeLabel = (): string | undefined => {
        if (horoscope.source !== "manual" || !calculatedDetails?.manualHousePlacements) return undefined;
        const { lagna, lagnaDegree, navamsaLagna } = calculatedDetails.manualHousePlacements;
        if (lagnaDegree !== undefined) return formatDegree(lagnaDegree);
        if (navamsaLagna !== undefined) {
            const index = navamsaIndexForSign(lagna, navamsaLagna);
            const arc = 30 / 9;
            return formatNavamsaDegreeRange((index - 1) * arc, index * arc);
        }
        return undefined;
    };

    /** Navamsa wedge (1-9) of the ASC sign to highlight on the house chart. For manual horoscopes
     *  this must come from the entered lagna degree (else the stored navamsa lagna), not from
     *  ascendant.degree (always 0 for manual charts, which would select navamsa #1 spuriously). */
    const getAscendantNavamsaNum = (): number | undefined => {
        if (horoscope.source !== "manual" || !calculatedDetails?.manualHousePlacements) return undefined;
        const { lagna, lagnaDegree, navamsaLagna } = calculatedDetails.manualHousePlacements;
        if (lagnaDegree !== undefined) return Math.floor(lagnaDegree / (30 / 9)) + 1;
        if (navamsaLagna === undefined) return undefined;
        return navamsaIndexForSign(lagna, navamsaLagna);
    };

    /** Absolute ecliptic degree (0-360) to anchor the house chart's lagna line (12 o'clock). For
     *  manual horoscopes the lagna line must point through the CENTER of the selected navamsa wedge
     *  (see `manualAscAbsDeg`), so it lines up with the calculations-tab degree ranges. */
    const getAscendantAbsDeg = (): number | undefined => {
        if (horoscope.source !== "manual" || !calculatedDetails?.manualHousePlacements) return undefined;
        return manualAscAbsDeg(calculatedDetails.manualHousePlacements);
    };

    /** Planets with degree re-synthesized to the midpoint of each planet's navamsa segment for
     *  manual horoscopes, so planet lines point at the middle of the navamsa wedge (the stored
     *  `calculatedDetails.planets` use the segment start, written when the chart was created). */
    const getManualAdjustedPlanets = (): Planet[] => {
        if (horoscope.source !== "manual" || !calculatedDetails?.manualHousePlacements)
            return calculatedDetails?.planets ?? [];
        return calculatedDetails.planets.map((p) => {
            const index = navamsaIndexForSign(p.sign, p.navamsaSign ?? p.sign);
            const arc = 30 / 9;
            const degree = (index - 0.5) * arc;
            return { ...p, degree, absoluteDegree: (p.sign - 1) * 30 + degree };
        });
    };

    const isManualNoBirthDate = horoscope.source === "manual" && !horoscope.birthDate;

    const NAVAMSA_ARC = 30 / 9;

    /** Ascendant's navamsa segment [start,end] within the lagna sign for manual horoscopes. Derived
     *  from the effective ascendant degree (entered `lagnaDegree` when given, else the stored
     *  navamsa lagna) so the calculations-tab ranges line up with the house chart's lagna line. */
    const getAscMidRange = (): { start: number; end: number } => {
        const { lagna, lagnaDegree, navamsaLagna } = calculatedDetails?.manualHousePlacements ?? { lagna: 1 };
        let index = 1;
        if (lagnaDegree !== undefined) index = Math.floor(lagnaDegree / NAVAMSA_ARC) + 1;
        else if (navamsaLagna !== undefined) index = navamsaIndexForSign(lagna, navamsaLagna);
        return { start: (index - 1) * NAVAMSA_ARC, end: index * NAVAMSA_ARC };
    };

    /** Navamsa segment degree range label (e.g. `10:00–13:20`) for a planet's degree within its
     *  sign, derived from which navamsa wedge the sign falls into. */
    const getPlanetDegreeRange = (p: Planet): string => {
        const index = navamsaIndexForSign(p.sign, p.navamsaSign ?? p.sign);
        return formatNavamsaDegreeRange((index - 1) * NAVAMSA_ARC, index * NAVAMSA_ARC);
    };

    /** House start/mid/end labels for manual whole-sign horoscopes. Every house is a 30° span
     *  centered on its middle line (`ascAbsDeg` rotated +30° per house): Mid = the ascendant's
     *  navamsa segment in this house's sign, Start/End = the navamsa segment containing the house
     *  cusps `midAbs − 15°` / `midAbs + 15°`. The cusps therefore track the ascendant's navamsa
     *  position, matching `buildBhavaHouses` and the house chart. */
    const getManualHouseRange = (
        houseNumber: number,
        sign: number,
        midStart: number,
        midEnd: number,
        ascAbsDeg: number,
    ): { start: string; mid: string; end: string } => {
        const midAbs = (((ascAbsDeg + (houseNumber - 1) * 30) % 360) + 360) % 360;
        const startSeg = navamsaSegmentForAbsDegree(midAbs - 15);
        const endSeg = navamsaSegmentForAbsDegree(midAbs + 15);
        return {
            start: `${getSignName(startSeg.sign)} (${formatNavamsaDegreeRange(startSeg.start, startSeg.end)})`,
            mid: `${getSignName(sign)} (${formatNavamsaDegreeRange(midStart, midEnd)})`,
            end: `${getSignName(endSeg.sign)} (${formatNavamsaDegreeRange(endSeg.start, endSeg.end)})`,
        };
    };

    /** Aspected planet `Aspect[]` for a manual horoscope row. Records computed at save time are
     *  already stored on `p.aspects` (with `reasons`, incl. rashi drishti where enabled); older
     *  records that predate the aspects-aware engine are re-derived at render time from the
     *  synthesized (navamsa-midpoint) degrees using the same shared pure module as auto charts.
     *  Conjunction records (aspectType 0) are excluded — they render in the Conjunctions column. */
    const getManualAspects = (p: Planet): Aspect[] => {
        if (horoscope.source !== "manual" || !calculatedDetails?.planets.length) return [];
        if (p.aspects.length > 0) return p.aspects.filter((a) => a.aspectType !== 0);
        const planets = getManualAdjustedPlanets();
        if (planets.length === 0) return [];
        return (computeManualPlanetAspects(planets)[p.name] ?? []).filter((a) => a.aspectType !== 0);
    };

    /** Surya Lagna / Chandra Lagna chart data. Auto horoscopes have these precomputed and stored on
     *  the document; manual horoscopes don't, so the birth chart is rotated to the Sun (planet 1) or
     *  Moon (planet 2) lagna on the fly using its sign. */
    const getSunMoonChartData = (type: ChartType): ChartInput | null => {
        if (horoscope.source !== "manual" || !calculatedDetails) return null;
        const planets = getManualAdjustedPlanets();
        const target = type === ChartType.SURYA_LAGNA ? 1 : 2;
        if (!planets.some((p) => p.name === target)) return null;
        const result = {
            planets,
            houses: calculatedDetails.houses,
            ascendant: calculatedDetails.ascendant,
        };
        return getChartData(result as CalculationResult, type);
    };

    const getStrength = (s: number | string | PlanetaryStrength | undefined | null): PlanetaryStrength => {
        if (typeof s === "number") {
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
        }
        if (typeof s === "string") {
            const STR_TO_ENUM: Record<string, PlanetaryStrength> = {
                athiuchcha: PlanetaryStrength.ATHI_UCHCHA,
                uchcha: PlanetaryStrength.UCHCHA,
                exalted: PlanetaryStrength.UCHCHA,
                neecha: PlanetaryStrength.NEECHA,
                debilitated: PlanetaryStrength.NEECHA,
                athineecha: PlanetaryStrength.ATHI_NEECHA,
                moolatrikona: PlanetaryStrength.MOOLATRIKONA,
                ownsign: PlanetaryStrength.OWN_SIGN,
                mitra: PlanetaryStrength.MITRA,
                friendly: PlanetaryStrength.MITRA,
                shatru: PlanetaryStrength.SHATRU,
                enemy: PlanetaryStrength.SHATRU,
                sama: PlanetaryStrength.SAMA,
                neutral: PlanetaryStrength.SAMA,
            };
            return STR_TO_ENUM[s.toLowerCase().replace(/[\s_-]/g, "")] ?? PlanetaryStrength.SAMA;
        }
        return PlanetaryStrength.SAMA;
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

    const chartTypes = ALL_CHART_TYPES.filter((type) => type !== ChartType.BIRTH && type !== ChartType.NAVAMSA_D9);

    return (
        <div>
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm transition-all ${
                        toast.type === "success"
                            ? "bg-green-600 text-white"
                            : toast.type === "info"
                              ? "bg-indigo-600 text-white"
                              : "bg-red-600 text-white"
                    }`}
                >
                    {toast.message}
                </div>
            )}

            {renderNav()}

            <div className="flex justify-between items-start mb-2 gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold">{horoscope.name}</h1>
                        {horoscope.source === "manual" && <CalculatedChartBadge />}
                        <PrivacyBadge
                            isPublic={isPublicState}
                            displayName={displayNameState}
                            isOwner={horoscope.owner?.id === session?.user?.id}
                            size="md"
                        />
                    </div>
                    {horoscope.source !== "manual" && (
                        <p className="text-sm text-gray-500 truncate" title={horoscope.locationName || undefined}>
                            {formatDate(horoscope.birthDate)} {horoscope.birthTime} |{" "}
                            {horoscope.locationName
                                ? horoscope.locationName
                                : `${horoscope.latitude}, ${horoscope.longitude}`}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {horoscope.owner?.id === session?.user?.id && (
                        <>
                            {horoscope.source === "manual" ? (
                                <button
                                    onClick={() => setEditingChart((v) => !v)}
                                    aria-label={t("manualChart.editChart")}
                                    title={t("manualChart.editChart")}
                                    className={`w-8 h-8 flex items-center justify-center border rounded transition-colors ${
                                        editingChart
                                            ? "bg-indigo-100 text-indigo-600 border-indigo-200"
                                            : "hover:bg-gray-50 text-gray-600"
                                    }`}
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
                            ) : (
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
                            )}
                            <button
                                onClick={() => setPrivacyPanelOpen(!privacyPanelOpen)}
                                aria-label={t("horoscope.privacy.title")}
                                title={t("horoscope.privacy.title")}
                                className={`w-8 h-8 flex items-center justify-center border rounded transition-colors ${
                                    privacyPanelOpen
                                        ? "bg-indigo-100 text-indigo-600 border-indigo-200"
                                        : "hover:bg-gray-50 text-gray-600"
                                }`}
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
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setConfirmDelete(true)}
                                aria-label={t("common.delete")}
                                title={t("common.delete")}
                                className="w-8 h-8 flex items-center justify-center border rounded hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors"
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
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {privacyPanelOpen && (
                <div className="mb-6">
                    <PrivacyToggle
                        isPublic={isPublicState}
                        displayName={displayNameState}
                        onChange={handlePrivacyChange}
                        saving={savingPrivacy}
                        error={privacyError}
                        context="detail"
                    />
                </div>
            )}

            {horoscope.source === "manual" && editingChart && calculatedDetails?.manualHousePlacements && (
                <div className="mb-6">
                    <ManualChartEditor
                        mode="edit"
                        horoscopeId={params.id as string}
                        initialName={horoscope.name}
                        initialBirthDate={birthDateInputValue(horoscope.birthDate)}
                        initialLagna={calculatedDetails.manualHousePlacements.lagna}
                        initialLagnaDegree={calculatedDetails.manualHousePlacements.lagnaDegree}
                        initialNavamsaLagna={calculatedDetails.manualHousePlacements.navamsaLagna ?? 0}
                        initialHouses={placementsRecord(calculatedDetails.manualHousePlacements.houses)}
                        initialNavamsaHouses={
                            calculatedDetails.manualHousePlacements.navamsaHouses
                                ? placementsRecord(calculatedDetails.manualHousePlacements.navamsaHouses)
                                : {}
                        }
                        onSaved={() => {
                            setEditingChart(false);
                            window.location.reload();
                        }}
                        onCancel={() => setEditingChart(false)}
                    />
                </div>
            )}

            {!editingChart && (
                <>
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
                        <div className="space-y-6">
                            <section aria-labelledby="chart-pair-title">
                                <h3
                                    id="chart-pair-title"
                                    className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide"
                                >
                                    {t("astrology.chartPairTitle")}
                                </h3>
                                {(() => {
                                    if (!calculatedDetails) {
                                        return (
                                            <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                <p className="text-sm">{t("astrology.noChartData")}</p>
                                            </div>
                                        );
                                    }
                                    const navamsaData = getNavamsaChartData();
                                    return (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <figure className="bg-white rounded-lg border p-4 overflow-auto">
                                                <figcaption className="text-sm font-semibold text-gray-700 mb-2">
                                                    {t("astrology.chartCaptions.birth")}
                                                </figcaption>
                                                <div className="flex justify-center">
                                                    <BirthChart
                                                        {...toBirthChartData({
                                                            planets: calculatedDetails.planets,
                                                            houses: calculatedDetails.houses,
                                                            ascendant: calculatedDetails.ascendant,
                                                        })}
                                                        ascendantDegreeLabel={getBirthChartAscendantDegreeLabel()}
                                                    />
                                                </div>
                                            </figure>
                                            <figure className="bg-white rounded-lg border p-4 overflow-auto">
                                                <figcaption className="text-sm font-semibold text-gray-700 mb-2">
                                                    {t("astrology.chartCaptions.navamsa-d9")}
                                                </figcaption>
                                                {!navamsaData ? (
                                                    <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                        <p className="text-sm">{t("astrology.noChartData")}</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center">
                                                        <BirthChart
                                                            {...toBirthChartData(navamsaData)}
                                                            showAscendantDegree={false}
                                                        />
                                                    </div>
                                                )}
                                            </figure>
                                        </div>
                                    );
                                })()}
                            </section>

                            <section aria-labelledby="other-charts-title">
                                <h3
                                    id="other-charts-title"
                                    className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide"
                                >
                                    {t("astrology.otherCharts")}
                                </h3>
                                <div
                                    role="group"
                                    aria-label={t("astrology.otherCharts")}
                                    className="flex gap-2 mb-4 flex-wrap"
                                >
                                    {chartTypes.map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedChart(type)}
                                            aria-pressed={selectedChart === type}
                                            className={`text-xs px-3 py-1.5 border rounded capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                selectedChart === type
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "hover:bg-gray-50"
                                            }`}
                                        >
                                            {t(`astrology.chartTypes.${type}`)}
                                        </button>
                                    ))}
                                </div>
                                {(() => {
                                    if (!calculatedDetails) {
                                        return (
                                            <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                <p className="text-sm">{t("astrology.noChartData")}</p>
                                            </div>
                                        );
                                    }

                                    if (selectedChart === ChartType.HOUSE) {
                                        return (
                                            <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                                <HouseChart
                                                    planets={getManualAdjustedPlanets()}
                                                    houses={calculatedDetails.houses}
                                                    ascendant={calculatedDetails.ascendant}
                                                    horoscopeId={params.id as string}
                                                    ascNavamsaNum={getAscendantNavamsaNum()}
                                                    ascAbsDeg={getAscendantAbsDeg()}
                                                />
                                            </div>
                                        );
                                    }

                                    if (
                                        selectedChart === ChartType.CHANDRA_LAGNA ||
                                        selectedChart === ChartType.SURYA_LAGNA
                                    ) {
                                        const chartData = data.charts.find((c) => c.type === selectedChart);
                                        if (chartData?.data) {
                                            return (
                                                <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                                    <BirthChart {...toBirthChartData(chartData.data)} />
                                                </div>
                                            );
                                        }
                                        const manualChartData = getSunMoonChartData(selectedChart);
                                        if (!manualChartData) {
                                            return (
                                                <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                    <p className="text-sm">{t("astrology.noChartData")}</p>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="flex justify-center bg-white rounded-lg border p-4 overflow-auto">
                                                <BirthChart {...toBirthChartData(manualChartData)} />
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                            <p className="text-sm">{t("astrology.noChartData")}</p>
                                        </div>
                                    );
                                })()}
                            </section>
                        </div>
                    )}

                    {activeTab === "calculations" && calculatedDetails && (
                        <div className="space-y-6">
                            {horoscope.source === "manual" && calculatedDetails.manualHousePlacements && (
                                <ValidationBadges
                                    validation={calculatedDetails.manualHousePlacements.validation}
                                    scope="birth"
                                />
                            )}
                            <section className="bg-white rounded-lg border p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded p-3">
                                        <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide mb-2">
                                            {t("astrology.ascendant")}
                                        </h4>
                                        <p className="text-sm mb-1">
                                            {getSignName(calculatedDetails.ascendant.sign)} (
                                            {getPlanetName(calculatedDetails.ascendant.lord)}){" "}
                                            {isManualNoBirthDate
                                                ? formatNavamsaDegreeRange(getAscMidRange().start, getAscMidRange().end)
                                                : formatDegree(calculatedDetails.ascendant.degree)}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {getNakshatraName(calculatedDetails.nakshatra.ascendantNakshatra?.id ?? 0)}{" "}
                                            ({getPlanetName(calculatedDetails.nakshatra.ascendantNakshatra?.lord ?? 0)}){" "}
                                            {getPadaFormat(calculatedDetails.nakshatra.ascendantNakshatra?.pada ?? 1)}
                                        </p>
                                        {(() => {
                                            const ascNak = calculatedDetails.nakshatra?.ascendantNakshatra;
                                            const recomputedAscFlags = computeAscendantSpecialFlags(
                                                calculatedDetails.ascendant.sign,
                                                calculatedDetails.ascendant.degree,
                                                ascNak?.id ?? 0,
                                                ascNak?.pada ?? 1,
                                            );
                                            const ascFlags = {
                                                isAscendantGandantha:
                                                    calculatedDetails.isAscendantGandantha ??
                                                    recomputedAscFlags.isAscendantGandantha,
                                                isAscendantGandamula:
                                                    calculatedDetails.isAscendantGandamula ??
                                                    recomputedAscFlags.isAscendantGandamula,
                                                isAscendantPushkara:
                                                    calculatedDetails.isAscendantPushkara ??
                                                    recomputedAscFlags.isAscendantPushkara,
                                            };
                                            const ascTags: {
                                                key: string;
                                                text: string;
                                                strikethrough?: boolean;
                                            }[] = [];
                                            if (calculatedDetails.isAscendantWargoththama) {
                                                const crossed =
                                                    ascFlags.isAscendantGandantha || ascFlags.isAscendantGandamula;
                                                ascTags.push({
                                                    key: "wargoththama",
                                                    text: t("astrology.wargoththamaLabel"),
                                                    strikethrough: crossed,
                                                });
                                            }
                                            if (ascFlags.isAscendantGandantha)
                                                ascTags.push({
                                                    key: "gandanta",
                                                    text: t("astrology.gandantaLabel"),
                                                });
                                            if (ascFlags.isAscendantGandamula)
                                                ascTags.push({
                                                    key: "gandamula",
                                                    text: t("astrology.gandamulaLabel"),
                                                });
                                            if (ascFlags.isAscendantPushkara)
                                                ascTags.push({
                                                    key: "pushkara",
                                                    text: t("astrology.pushkaraLabel"),
                                                });
                                            if (ascTags.length === 0) return null;
                                            return (
                                                <p className="mt-2 flex flex-wrap gap-1">
                                                    {ascTags.map((tag) => (
                                                        <span
                                                            key={tag.key}
                                                            className={`inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border ${
                                                                tag.key === "wargoththama"
                                                                    ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                                                                    : "text-gray-600 bg-gray-100 border-gray-200"
                                                            } ${tag.strikethrough ? "line-through" : ""}`}
                                                        >
                                                            {tag.text}
                                                        </span>
                                                    ))}
                                                </p>
                                            );
                                        })()}
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
                                        <p className="text-sm mt-1 text-gray-600">
                                            {t("astrology.thithi")}: {getThithiName(getThithi())} ({getThithi()})
                                        </p>
                                        <p className="text-sm mt-1 text-gray-600">
                                            {t("astrology.panchaPakshi")}: {getPanchaPakshiName(getPanchaPakshi())}
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
                                                const isManualRow = isManualNoBirthDate;
                                                const manualRange = isManualRow
                                                    ? getManualHouseRange(
                                                          h.houseNumber,
                                                          h.sign,
                                                          getAscMidRange().start,
                                                          getAscMidRange().end,
                                                          getAscendantAbsDeg() ?? 0,
                                                      )
                                                    : null;
                                                const aspectsToHouse = getAspectsToHouse(h.houseNumber)
                                                    .map((a) => ({
                                                        ...a,
                                                        diff: getAspectDiff(
                                                            a.planet.absoluteDegree,
                                                            a.aspectType,
                                                            houseMidAbs,
                                                        ),
                                                    }))
                                                    .filter((a) => Math.abs(a.diff) <= (orbMap[a.planet.name] ?? 0))
                                                    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
                                                return (
                                                    <tr key={h.houseNumber} className="border-b border-gray-50">
                                                        <td className="py-1 pr-3 font-medium">{h.houseNumber}</td>
                                                        <td className="py-1 pr-3 text-gray-600">
                                                            {manualRange
                                                                ? manualRange.start
                                                                : formatSignLordDegree(
                                                                      h.startSign,
                                                                      h.startLord,
                                                                      h.startDegree,
                                                                      h.sign,
                                                                      h.lord,
                                                                  )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-gray-600">
                                                            {manualRange
                                                                ? manualRange.mid
                                                                : formatSignLordDegree(
                                                                      h.middleSign,
                                                                      h.middleLord,
                                                                      h.middleDegree,
                                                                      h.sign,
                                                                      h.lord,
                                                                  )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-gray-600">
                                                            {manualRange
                                                                ? manualRange.end
                                                                : formatSignLordDegree(
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
                                                                              `${getPlanetName(p.name)} (${manualRange ? getPlanetDegreeRange(p) : formatDegree(p.degree)})`,
                                                                      )
                                                                      .join(", ")
                                                                : "—"}
                                                        </td>
                                                        <td className="py-1 pr-3">
                                                            {aspectsToHouse.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {aspectsToHouse.map((a) => {
                                                                        const record: Aspect = {
                                                                            planetName: a.planet.name,
                                                                            aspectType: a.aspectType,
                                                                            planetAbsoluteDegree:
                                                                                a.planet.absoluteDegree,
                                                                            degreeGap: Math.abs(a.diff),
                                                                            exactAspectDegree: a.aspectType,
                                                                            isBeneficial:
                                                                                a.aspectType === 60 ||
                                                                                a.aspectType === 120,
                                                                            delta: a.diff,
                                                                            reasons: [
                                                                                {
                                                                                    type: "planetary",
                                                                                    angle: a.aspectType,
                                                                                    delta: a.diff,
                                                                                },
                                                                            ],
                                                                        };
                                                                        return (
                                                                            <AspectChip
                                                                                key={a.planet.name}
                                                                                aspect={record}
                                                                                planetLabel={`${PLANET_SYMBOLS[a.planet.name] ?? ""} ${getPlanetName(a.planet.name)}`.trim()}
                                                                                aspectingSign={a.planet.sign}
                                                                                house={h.houseNumber}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
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

                                {/* Desktop: table view */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b">
                                                <th className="py-1 pr-3">{t("astrology.planet")}</th>
                                                <th className="py-1 pr-3">
                                                    {t("astrology.sign")} ({t("astrology.degree")})
                                                </th>
                                                <th className="py-1 pr-3">{t("astrology.strength")}</th>
                                                <th className="py-1 pr-3">{t("astrology.house")}</th>
                                                <th className="py-1 pr-3">{t("astrology.navamsa")}</th>
                                                <th className="py-1 pr-3">
                                                    {t("astrology.navamsa")} {t("astrology.strength")}
                                                </th>
                                                <th className="py-1 pr-3">
                                                    {t("astrology.nakshatra")} ({t("astrology.pada")})
                                                </th>
                                                <th className="py-1 pr-3">{t("astrology.conjunctions")}</th>
                                                <th className="py-1 pr-3">{t("astrology.aspects")}</th>
                                                <th className="py-1 pr-3">{t("astrology.other")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...calculatedDetails.planets]
                                                .sort((a, b) => a.name - b.name)
                                                .map((p) => {
                                                    const displayHouse =
                                                        horoscope.source === "manual"
                                                            ? p.house
                                                            : (findHouse(p.absoluteDegree, calculatedDetails.houses) ??
                                                              p.house);
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
                                                    const aspectRecords: Aspect[] =
                                                        horoscope.source === "manual"
                                                            ? getManualAspects(p)
                                                            : p.aspects
                                                                  .filter((a) => a.aspectType !== 0)
                                                                  .filter((a) => {
                                                                      const q = calculatedDetails.planets.find(
                                                                          (x) => x.name === a.planetName,
                                                                      );
                                                                      if (!q) return false;
                                                                      const exactPoint =
                                                                          (p.absoluteDegree + a.aspectType) % 360;
                                                                      let diff = exactPoint - q.absoluteDegree;
                                                                      if (diff > 180) diff -= 360;
                                                                      if (diff < -180) diff += 360;
                                                                      return Math.abs(diff) <= (orbMap[p.name] ?? 0);
                                                                  });
                                                    const tags: {
                                                        key: string;
                                                        text: string;
                                                        strikethrough?: boolean;
                                                    }[] = [];
                                                    if (p.combustion)
                                                        tags.push({
                                                            key: "combustion",
                                                            text: t("astrology.combustLabel"),
                                                        });
                                                    if (calculatedDetails.lord22ndDrekkana === p.name)
                                                        tags.push({
                                                            key: "drekkana",
                                                            text: t("astrology.drekkanaLordLabel"),
                                                        });
                                                    if (calculatedDetails.lord64thNavamsa === p.name)
                                                        tags.push({
                                                            key: "navamsa",
                                                            text: t("astrology.navamsaLordLabel"),
                                                        });
                                                    if (calculatedDetails.atmakaraka === p.name)
                                                        tags.push({
                                                            key: "atmakaraka",
                                                            text: t("astrology.atmakarakaLabel"),
                                                        });
                                                    if (resolvedMaranakaraka === p.name)
                                                        tags.push({
                                                            key: "maranakaraka",
                                                            text: t("astrology.maranakarakaLabel"),
                                                        });
                                                    if (calculatedDetails.marakaPlanets?.includes(p.name))
                                                        tags.push({ key: "maraka", text: t("astrology.marakaLabel") });
                                                    if (calculatedDetails.badhakaPlanet?.includes(p.name))
                                                        tags.push({
                                                            key: "badhaka",
                                                            text: t("astrology.badhakaLabel"),
                                                        });
                                                    if (calculatedDetails.nidhanamshaPlanets?.includes(p.name))
                                                        tags.push({
                                                            key: "nidhanamsha",
                                                            text: t("astrology.nidhanamshaLabel"),
                                                        });
                                                    if (calculatedDetails.ashtamanshaPlanets?.includes(p.name))
                                                        tags.push({
                                                            key: "ashtamansha",
                                                            text: t("astrology.ashtamanshaLabel"),
                                                        });
                                                    if (calculatedDetails.wargoththamaPlanets?.includes(p.name)) {
                                                        const crossed =
                                                            calculatedDetails.gandanthaPlanets?.includes(p.name) ||
                                                            calculatedDetails.gandamulaPlanets?.includes(p.name);
                                                        tags.push({
                                                            key: "wargoththama",
                                                            text: t("astrology.wargoththamaLabel"),
                                                            strikethrough: crossed,
                                                        });
                                                    }
                                                    if (calculatedDetails.gandanthaPlanets?.includes(p.name))
                                                        tags.push({
                                                            key: "gandanta",
                                                            text: t("astrology.gandantaLabel"),
                                                        });
                                                    if (calculatedDetails.gandamulaPlanets?.includes(p.name))
                                                        tags.push({
                                                            key: "gandamula",
                                                            text: t("astrology.gandamulaLabel"),
                                                        });
                                                    if (calculatedDetails.pushkaraPlanets?.includes(p.name))
                                                        tags.push({
                                                            key: "pushkara",
                                                            text: t("astrology.pushkaraLabel"),
                                                        });
                                                    return (
                                                        <tr key={p.name} className="border-b border-gray-50">
                                                            <td className="py-1 pr-3 font-medium">
                                                                {p.retrograde && p.name !== 8 && p.name !== 9
                                                                    ? `(${getPlanetName(p.name)})`
                                                                    : getPlanetName(p.name)}
                                                            </td>
                                                            <td className="py-1 pr-3">
                                                                {getSignName(p.sign)} (
                                                                {isManualNoBirthDate
                                                                    ? getPlanetDegreeRange(p)
                                                                    : formatDegree(p.degree)}
                                                                )
                                                            </td>
                                                            <td className="py-1 pr-3">
                                                                {t(
                                                                    `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.strength)] ?? "neutral"}`,
                                                                )}
                                                            </td>
                                                            <td className="py-1 pr-3">{displayHouse}</td>
                                                            <td className="py-1 pr-3">{getSignName(p.navamsaSign)}</td>
                                                            <td className="py-1 pr-3">
                                                                {t(
                                                                    `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.navamsaStrength)] ?? "neutral"}`,
                                                                )}
                                                            </td>
                                                            <td className="py-1 pr-3 text-gray-600">
                                                                {getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada}
                                                                )
                                                            </td>
                                                            <td className="py-1 pr-3">
                                                                {conjunct.length > 0 ? conjunct.join(", ") : "—"}
                                                            </td>
                                                            <td className="py-1 pr-3">
                                                                {aspectRecords.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {aspectRecords.map((a) => (
                                                                            <AspectChip
                                                                                key={a.planetName}
                                                                                aspect={a}
                                                                                planetLabel={`${PLANET_SYMBOLS[a.planetName] ?? ""} ${getPlanetName(a.planetName)}`.trim()}
                                                                                aspectingSign={p.sign}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    "—"
                                                                )}
                                                            </td>
                                                            <td className="py-1 pr-3">
                                                                {tags.length > 0 ? (
                                                                    <span className="flex flex-wrap gap-1">
                                                                        {tags.map((tag) => (
                                                                            <span
                                                                                key={tag.key}
                                                                                className={`text-[10px] leading-tight px-1 rounded bg-gray-100 text-gray-600 whitespace-nowrap ${
                                                                                    tag.strikethrough
                                                                                        ? "line-through"
                                                                                        : ""
                                                                                }`}
                                                                            >
                                                                                {tag.text}
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                ) : (
                                                                    "—"
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile: card view */}
                                <div className="block sm:hidden space-y-2">
                                    {[...calculatedDetails.planets]
                                        .sort((a, b) => a.name - b.name)
                                        .map((p) => {
                                            const isExpanded = expandedPlanets.has(p.name);
                                            const isRetrograde = p.retrograde && p.name !== 8 && p.name !== 9;
                                            const displayHouse =
                                                horoscope.source === "manual"
                                                    ? p.house
                                                    : (findHouse(p.absoluteDegree, calculatedDetails.houses) ??
                                                      p.house);

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

                                            const aspectRecords: Aspect[] =
                                                horoscope.source === "manual"
                                                    ? getManualAspects(p)
                                                    : p.aspects
                                                          .filter((a) => a.aspectType !== 0)
                                                          .filter((a) => {
                                                              const q = calculatedDetails.planets.find(
                                                                  (x) => x.name === a.planetName,
                                                              );
                                                              if (!q) return false;
                                                              const exactPoint =
                                                                  (p.absoluteDegree + a.aspectType) % 360;
                                                              let diff = exactPoint - q.absoluteDegree;
                                                              if (diff > 180) diff -= 360;
                                                              if (diff < -180) diff += 360;
                                                              return Math.abs(diff) <= (orbMap[p.name] ?? 0);
                                                          });

                                            const tags: { key: string; text: string; strikethrough?: boolean }[] = [];
                                            if (p.combustion)
                                                tags.push({ key: "combustion", text: t("astrology.combustLabel") });
                                            if (calculatedDetails.lord22ndDrekkana === p.name)
                                                tags.push({ key: "drekkana", text: t("astrology.drekkanaLordLabel") });
                                            if (calculatedDetails.lord64thNavamsa === p.name)
                                                tags.push({ key: "navamsa", text: t("astrology.navamsaLordLabel") });
                                            if (calculatedDetails.atmakaraka === p.name)
                                                tags.push({ key: "atmakaraka", text: t("astrology.atmakarakaLabel") });
                                            if (resolvedMaranakaraka === p.name)
                                                tags.push({
                                                    key: "maranakaraka",
                                                    text: t("astrology.maranakarakaLabel"),
                                                });
                                            if (calculatedDetails.marakaPlanets?.includes(p.name))
                                                tags.push({ key: "maraka", text: t("astrology.marakaLabel") });
                                            if (calculatedDetails.badhakaPlanet?.includes(p.name))
                                                tags.push({ key: "badhaka", text: t("astrology.badhakaLabel") });
                                            if (calculatedDetails.nidhanamshaPlanets?.includes(p.name))
                                                tags.push({
                                                    key: "nidhanamsha",
                                                    text: t("astrology.nidhanamshaLabel"),
                                                });
                                            if (calculatedDetails.ashtamanshaPlanets?.includes(p.name))
                                                tags.push({
                                                    key: "ashtamansha",
                                                    text: t("astrology.ashtamanshaLabel"),
                                                });
                                            if (calculatedDetails.wargoththamaPlanets?.includes(p.name)) {
                                                const crossed =
                                                    calculatedDetails.gandanthaPlanets?.includes(p.name) ||
                                                    calculatedDetails.gandamulaPlanets?.includes(p.name);
                                                tags.push({
                                                    key: "wargoththama",
                                                    text: t("astrology.wargoththamaLabel"),
                                                    strikethrough: crossed,
                                                });
                                            }
                                            if (calculatedDetails.gandanthaPlanets?.includes(p.name))
                                                tags.push({ key: "gandanta", text: t("astrology.gandantaLabel") });
                                            if (calculatedDetails.gandamulaPlanets?.includes(p.name))
                                                tags.push({ key: "gandamula", text: t("astrology.gandamulaLabel") });
                                            if (calculatedDetails.pushkaraPlanets?.includes(p.name))
                                                tags.push({ key: "pushkara", text: t("astrology.pushkaraLabel") });

                                            const STRENGTH_COLORS: Record<string, string> = {
                                                athiUchcha: "text-green-700 font-semibold",
                                                exalted: "text-green-700 font-semibold",
                                                athiNeecha: "text-red-600",
                                                debilitated: "text-red-600",
                                                moolatrikona: "text-indigo-600 font-semibold",
                                                ownSign: "text-indigo-600 font-semibold",
                                            };
                                            const resolvedStrength = getStrength(p.strength);
                                            const strengthClass =
                                                STRENGTH_COLORS[STRENGTH_TRANSLATION_KEYS[resolvedStrength]] ||
                                                "text-gray-600";

                                            return (
                                                <div key={p.name} className="border rounded overflow-hidden">
                                                    <button
                                                        onClick={() => {
                                                            setExpandedPlanets((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(p.name)) {
                                                                    next.delete(p.name);
                                                                } else {
                                                                    next.add(p.name);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                                                    >
                                                        <span className="font-medium whitespace-nowrap">
                                                            {PLANET_SYMBOLS[p.name]} {getPlanetName(p.name)}
                                                        </span>
                                                        {isRetrograde && (
                                                            <span className="text-amber-600 bg-amber-50 text-[10px] rounded px-1 leading-tight">
                                                                {t("astrology.retrograde")}
                                                            </span>
                                                        )}
                                                        <span className="text-gray-600 whitespace-nowrap">
                                                            {getSignName(p.sign)}
                                                        </span>
                                                        <span className={`whitespace-nowrap ${strengthClass}`}>
                                                            {t(
                                                                `astrology.${STRENGTH_TRANSLATION_KEYS[resolvedStrength] ?? "neutral"}`,
                                                            )}
                                                        </span>
                                                        <span className="text-gray-600 whitespace-nowrap">
                                                            {t("astrology.house")} {displayHouse}
                                                        </span>
                                                        <span className="text-gray-500 whitespace-nowrap">
                                                            {getNakshatraName(p.nakshatra) || p.nakshatra} ({p.pada})
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
                                                            {isExpanded ? "▼" : "▶"}
                                                        </span>
                                                    </button>
                                                    {isExpanded && (
                                                        <div className="border-t px-3 py-2 space-y-1.5 text-xs text-gray-600 bg-gray-50">
                                                            <p>
                                                                <span className="font-medium text-gray-700">
                                                                    {t("astrology.degree")}:
                                                                </span>{" "}
                                                                {formatDegree(p.degree)}
                                                            </p>
                                                            {conjunct.length > 0 && (
                                                                <p>
                                                                    <span className="font-medium text-gray-700">
                                                                        {t("astrology.conjunctions")}:
                                                                    </span>{" "}
                                                                    {conjunct.join(", ")}
                                                                </p>
                                                            )}
                                                            {aspectRecords.length > 0 && (
                                                                <p>
                                                                    <span className="font-medium text-gray-700">
                                                                        {t("astrology.aspects")}:
                                                                    </span>{" "}
                                                                    <span className="inline-flex flex-wrap gap-1">
                                                                        {aspectRecords.map((a) => (
                                                                            <AspectChip
                                                                                key={a.planetName}
                                                                                aspect={a}
                                                                                planetLabel={`${PLANET_SYMBOLS[a.planetName] ?? ""} ${getPlanetName(a.planetName)}`.trim()}
                                                                                aspectingSign={p.sign}
                                                                            />
                                                                        ))}
                                                                    </span>
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
                                                            <p>
                                                                <span className="font-medium text-gray-700">
                                                                    {t("astrology.navamsaka")}:
                                                                </span>{" "}
                                                                {getSignName(p.navamsaSign)} (
                                                                {t(
                                                                    `astrology.${STRENGTH_TRANSLATION_KEYS[getStrength(p.navamsaStrength)] ?? "neutral"}`,
                                                                )}
                                                                )
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </section>

                            {horoscope.source === "manual" && calculatedDetails.derivedRanges && (
                                <DerivedRangesSection ranges={calculatedDetails.derivedRanges} />
                            )}
                        </div>
                    )}

                    {activeTab === "dashas" && calculatedDetails && (
                        <div className="bg-white rounded-lg border p-4">
                            <DashaSection
                                dashas={calculatedDetails.dashas as unknown as Dashas}
                                getPlanetName={getPlanetName}
                                getDashaLevelName={getDashaLevelName}
                            />
                        </div>
                    )}

                    {activeTab === "metadata" && (
                        <div className="bg-white rounded-lg border p-6 text-center text-gray-400">
                            <p>{t("horoscope.metadata")}</p>
                        </div>
                    )}
                </>
            )}

            <div className="border-t pt-4 mt-8">{renderNav()}</div>

            <ConfirmDeleteModal
                open={confirmDelete}
                onConfirm={handleDelete}
                onCancel={() => {
                    setConfirmDelete(false);
                    setDeleteError(null);
                }}
                loading={deleting}
                error={deleteError}
            />
        </div>
    );
}
