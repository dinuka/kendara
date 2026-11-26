"use client";

import CalculatedChartBadge from "@/components/CalculatedChartBadge";
import HousesTable from "@/components/chartTables/HousesTable";
import PlanetsTable from "@/components/chartTables/PlanetsTable";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import DashaSection from "@/components/Dasha/DashaSection";
import type { PlanetTag } from "@/components/Dasha/DashaPlanetTags";
import { HouseChart } from "@/components/HouseChart";
import DerivedRangesSection from "@/components/ManualChart/DerivedRanges";
import ManualChartEditor from "@/components/ManualChart/ManualChartEditor";
import PrivacyBadge from "@/components/PrivacyBadge";
import PrivacyToggle from "@/components/PrivacyToggle";
import BhavaSuchikaTag from "@/components/bhavaSuchika/BhavaSuchikaTag";
import Notepad from "@/components/notepad/Notepad";
import ShadBalaTable from "@/components/shadbalaya/ShadBalaTable";
import WargaChartSection from "@/components/wargaKendara/WargaChartSection";
import WargaIndicationTags from "@/components/wargaKendara/WargaIndicationTags";
import YogaDoshaSection from "@/components/yogaDosha/YogaDoshaSection";
import { useI18n } from "@/hooks/useI18n";
import { TablePreferencesProvider } from "@/hooks/useTablePreferences";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import ValidationBadges from "@/components/ManualChart/ValidationBadges";
import type { Ascendant, Aspect, CalculationResult, Dashas, House, Planet } from "@/lib/astrology";
import {
    computeAscendantSpecialFlags,
    computeMaranakaraka,
    computePanchaPakshi,
    computeThithiFromPlanets,
    computeYogakaraka,
    formatDegree,
    navamsaSign,
    normalizeMaranakaraka,
} from "@/lib/astrology";
import { Planet as PlanetId, PlanetaryStrength } from "@/lib/astrologyEnums";
import { calculateBadhakaLevels } from "@/lib/badhaka";
import { resolveLagnaBhavaSuchika, resolvePlanetBhavaSuchika } from "@/lib/bhavaSuchika";
import { type AspectSettings, resolveDisplayAspects, rotateDisplayAspects } from "@/lib/chartAspects";
import { computeKendrasthana } from "@/lib/kendrasthana";
import { getChartData } from "@/lib/chartDataTransform";
import {
    CORE_HOUSE_COLUMNS,
    CORE_PLANET_COLUMNS,
    type HouseTableData,
    type HouseTableRow,
    type PlanetTableData,
    type PlanetTableRow,
    withGrahaMaitri,
    withSpecialLagnas,
    withUpagrahas,
} from "@/lib/chartTableRows";
import type { ChartInput } from "@/lib/chartDataTransform";
import { ChartType } from "@/lib/chartTypes";
import { formatDate } from "@/lib/date";
import { get22ndDrekkanaLordFromPlanet, getNthDrekkanaLord } from "@/lib/drekkanaLord";
import { readHoroscopeSort } from "@/lib/horoscopeSort";
import {
    buildBhavaHouses,
    buildWholeSignHouses,
    calculateManualDashas,
    computeAscendantNakshatra,
    computeMoonNakshatra,
    deriveBirthTimeRange,
    formatNavamsaDegreeRange,
    hasManualNavamsa,
    manualAscAbsDeg,
    manualTrimshamshaSource,
    navamsaIndexForSign,
    ownedHousesOf,
    synthesizeOtherDetails,
    synthesizeValidation,
} from "@/lib/manualChart";
import type { DerivedRanges, ManualHouse, ManualHousePlacements } from "@/lib/manualChart";
import { computePlanetConjunctions } from "@/lib/planetAspects";
import { type ShadBalaya, computeShadBalaya, deriveDay, mergeShadBalaya } from "@/lib/shadBalaya";
import { resolveSubaAsuba } from "@/lib/subaAsuba";
import type { PlanetColumnId } from "@/lib/tableColumns";
import { buildDrekkanaChart } from "@/lib/drekkana";
import { buildTrimshamshaChart } from "@/lib/trimshamsha";
import type { WargaVargaKey } from "@/lib/wargaKendara";
import { VARGA_CATALOG } from "@/lib/wargaKendara";
import { computeWargaChartEntry, computeWargaDegreeVargaEntry, resolveWargaKendara } from "@/lib/wargaKendara";
import { type Nisheka, buildNishekaChart } from "@/lib/nishekaLagna";
import NishekaDetails from "@/components/wargaKendara/NishekaDetails";
import { resolveYogaDoshas } from "@/lib/yogaDosha";

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

/** A strip key: a catalog varga (d1..d60) or the two lagna rotations. Only `d9`, `suryaLagna` and
 *  `chandraLagna` have computed figures/tables; the remaining catalog keys show name + tags only. */
type WargaStripKey = WargaVargaKey | "suryaLagna" | "chandraLagna" | "nisheka";

/** Second-chart strip order of the Warga Kendara (D1 is the pinned first slot, never a tab). The
 *  computed charts (D9, Surya/Chandra Lagna) come first; the remaining catalog keys follow in
 *  canonical order. */
const SECOND_CHART_KEYS: WargaStripKey[] = [
    "d9",
    "suryaLagna",
    "chandraLagna",
    "nisheka",
    ...VARGA_CATALOG.filter((v) => v.key !== "d1" && v.key !== "d9").map((v) => v.key as WargaStripKey),
];
/** SECOND_CHART_KEYS opens with the main charts (D9, Surya/Chandra Lagna, Nisheka); the rest are vargas. */
const MAIN_SECOND_CHART_COUNT = 4;

/** Whether a strip key has a computed figure + tables (D9, Surya/Chandra Lagna). The other catalog
 *  keys (D2..D60) currently render name + indication tags only. */
const isComputedChart = (key: WargaStripKey): key is "d9" | "suryaLagna" | "chandraLagna" =>
    key === "d9" || key === "suryaLagna" || key === "chandraLagna";

/** Chart-caption message key per computed Warga Kendara figure slot. */
const SECOND_CHART_CAPTION_KEYS: Record<"d1" | "d9" | "suryaLagna" | "chandraLagna", string> = {
    d1: "astrology.chartCaptions.birth",
    d9: "astrology.chartCaptions.navamsa-d9",
    suryaLagna: "astrology.chartCaptions.suryaLagna",
    chandraLagna: "astrology.chartCaptions.chandraLagna",
};

/** Tab-label message key per Warga Kendara chart (message keys use rashi/navamsa, not d1/d9). */
const SECOND_CHART_TAB_KEYS: Record<"d1" | "d9" | "suryaLagna" | "chandraLagna", string> = {
    d1: "astrology.wargaKendara.tabs.rashi",
    d9: "astrology.wargaKendara.tabs.navamsa",
    suryaLagna: "astrology.wargaKendara.tabs.suryaLagna",
    chandraLagna: "astrology.wargaKendara.tabs.chandraLagna",
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

/** Table column layouts are a per-viewer preference shared by every horoscope: saved to the
 *  profile when signed in, to this browser for guests viewing public horoscopes. */
export default function HoroscopeDetailPage() {
    const { status } = useSession();
    return (
        <TablePreferencesProvider
            mode={status === "authenticated" ? "account" : status === "unauthenticated" ? "device" : "off"}
        >
            <HoroscopeDetail />
        </TablePreferencesProvider>
    );
}

function HoroscopeDetail() {
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
            lord22ndDrekkanaMoon?: number;
            lord22ndDrekkanaSun?: number;
            lord10thDrekkana?: number;
            lord16thDrekkana?: number;
            lord34thDrekkana?: number;
            lord64thNavamsa: number;
            horaLagna?: { sign: number; degree: number };
            gulikaLagna?: { sign: number; degree: number };
            pranapadaLagna?: { sign: number; degree: number };
            nisheka?: Nisheka;
            badhakaPlanet: number[];
            marakaPlanets: number[];
            nidhanamshaPlanets: number[];
            ashtamanshaPlanets: number[];
            atmakaraka: number;
            maranakaraka: number[];
            yogakaraka: number[];
            isAscendantWargoththama: boolean;
            isAscendantGandantha: boolean;
            isAscendantGandamula: boolean;
            isAscendantPushkara: boolean;
            wargoththamaPlanets: number[];
            gandanthaPlanets: number[];
            gandamulaPlanets: number[];
            pushkaraPlanets: number[];
            shadbalaya?: ShadBalaya;
            lagnaBhavaSuchika?: number;
            bhavaSuchika?: Record<string, number>;
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
    const [secondChart, setSecondChart] = useState<WargaStripKey>("d9");
    const secondChartButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
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

    const [aspectSettings, setAspectSettings] = useState<AspectSettings>({});

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);


    const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false);
    const [editingChart, setEditingChart] = useState(false);
    const [savingPrivacy, setSavingPrivacy] = useState(false);
    const [privacyError, setPrivacyError] = useState<string | null>(null);
    const [isPublicState, setIsPublicState] = useState(false);
    const [displayNameState, setDisplayNameState] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // The second chart is a client-side preference only — navigating to another horoscope resets it
    // to the D9 (Navamsa) default so each chart pair starts in the canonical state.
    useEffect(() => {
        setSecondChart("d9");
    }, [params.id]);

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
        // Public horoscopes open for signed-out guests too, so a page link can be shared.
        if (status === "loading") return;

        setLoading(true);
        setData(null);

        const { sortBy, sortDir } = readHoroscopeSort();

        fetch(`/api/horoscope/${params.id}?sortBy=${sortBy}&sortDir=${sortDir}`)
            .then((r) => {
                // A guest following a link to a private horoscope is asked to sign in.
                if (!r.ok && status === "unauthenticated") {
                    router.push("/signin");
                    return null;
                }
                return r.json();
            })
            .then((d) => {
                if (d === null) return;
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
                    const moonNakshatra = moon
                        ? computeMoonNakshatra(
                              moon.sign,
                              hasManualNavamsa(mhp) ? moon.navamsaSign : undefined,
                              mhp.planetDegrees?.[2],
                          )
                        : undefined;
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
                            ascendant: {
                                ...d.calculatedDetails.ascendant,
                                degree: mhp.lagnaDegree ?? d.calculatedDetails.ascendant.degree,
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
                const { planetaryOrbs, planetAspects, rashiAspects } = data;
                setAspectSettings({ planetaryOrbs, planetAspects, rashiAspects });
            })
            .catch(() => {});
    }, [status, params.id, router]);

    if (loading || status === "loading") {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    if (!data) return <div className="text-center py-20 text-gray-400">{t("common.error")}</div>;

    const { horoscope, calculatedDetails } = data;

    const isManualChart = horoscope.source === "manual";

    // Navamsa (D9) availability: auto (ephemeris) charts always carry it; manual charts only when a
    // Navamsa Lagna AND navamsa house placements were entered. Manual charts without Navamsa data are
    // birth-chart-only — no degree values, no Navamsa-derived columns/tags, no second warga chart
    // (TODO.md manual-chart issues). It also gates the two Navamsa-only derived columns — Nakshatra
    // (Pada) and Bhava Suchika: without Navamsa there is no real degree inside the sign, so a manual
    // chart's planet Nakshatra/Pada is a placeholder derived from the sign midpoint
    // (src/lib/manualChartDetails.ts — synthesizePlanets), and Bhava Suchika resolves to undefined
    // (src/lib/bhavaSuchika.ts — no entered Navamsa houses to read a planet's D9 sign from). Neither
    // is a real calculation, so neither column is rendered. Rendered sections gate on this flag below.
    const navamsaAvailable = !isManualChart || hasManualNavamsa(calculatedDetails?.manualHousePlacements);

    // Entered degrees (amsha + kala) make a manual chart behave like one with a birth time: the
    // ascendant / planets carrying a degree show it exactly (and anchor the house cusps) instead of
    // the navamsa-segment range or sign-only placeholder.
    const manualPlanetDegrees: Record<number, number> = calculatedDetails?.manualHousePlacements?.planetDegrees ?? {};
    const hasExactAscendant = !isManualChart || calculatedDetails?.manualHousePlacements?.lagnaDegree !== undefined;
    const hasExactDegree = (p: Planet): boolean => !isManualChart || manualPlanetDegrees[p.name] !== undefined;

    // Degree-based planet conjunctions (shared with the calc-tab planet tables): the authoritative
    // conjunction list for the D1 (Lagna) warga Planets table, so its chips match the calc tab.
    const resolvedConjunctionsByPlanet: Record<number, Aspect[]> = calculatedDetails?.planets?.length
        ? computePlanetConjunctions(calculatedDetails.planets, orbMap)
        : {};

    // Aspects (දෘෂ්ඨි): one set of records for every table on this page — the calc-tab Houses and
    // Planets tables and the D1 warga tables. Stored records win; legacy docs are re-derived with the
    // same engine (src/lib/chartAspects.ts). Planet rows list the planets aspecting them.
    const displayAspects = resolveDisplayAspects(calculatedDetails, aspectSettings);
    // Kendrasthana (4/7/10 houses): derived at render with the aspect engine's point/difference rule
    // (src/lib/kendrasthana.ts). Houses list every kendra planet; planets only those within the orb.
    const kendrasthana = computeKendrasthana(
        calculatedDetails?.planets ?? [],
        calculatedDetails?.houses ?? [],
        aspectSettings.planetaryOrbs,
    );

    // Maranakaraka is recomputed at render from planets (lagna chart only — never D9) so
    // legacy stored values (a single "any rule → Moon=2") don't stick. Every planet in its
    // designated death house is a Maranakaraka, so multiple planets can qualify. The house is the
    // planet's whole-sign Rashi house (p.house), never the cusp-boundary range.
    const resolvedMaranakaraka = calculatedDetails?.planets
        ? computeMaranakaraka(calculatedDetails.planets)
        : normalizeMaranakaraka(calculatedDetails?.maranakaraka);

    // Yogakaraka depends only on the lagna sign (Kendra 4/7/10 + Trikona 5/9 lordship), so it is
    // recomputed at render so legacy docs without the stored field still show the tag.
    const resolvedYogakaraka = calculatedDetails?.ascendant?.sign
        ? computeYogakaraka(calculatedDetails.ascendant.sign)
        : (calculatedDetails?.yogakaraka ?? []);

    // Badhaka (බාධක) levels 1-4 per planet, derived at render from the lagna and the stored planets
    // (src/lib/badhaka.ts) so every existing document shows them. The nakshatra-based levels 1 and 3
    // are skipped without Navamsa data, where a manual chart's nakshatra is only a placeholder.
    const resolvedBadhakaLevels =
        calculatedDetails?.ascendant?.sign && calculatedDetails.planets
            ? calculateBadhakaLevels(calculatedDetails.ascendant.sign, calculatedDetails.planets, navamsaAvailable)
            : {};

    // 22nd Drekkana lords (22 දෙර්කාණාධිපති) from the Chandra and Ravi lagnas — computed and stored when
    // the horoscope is saved (src/lib/drekkanaLord.ts). Legacy docs that predate the fields are
    // re-derived from the stored houses until the recalculation script runs. Skipped without Navamsa
    // data, where a manual chart's planet degree is only a placeholder.
    const drekkanaLordFrom = (planetName: number, stored?: number) => {
        if (!navamsaAvailable) return undefined;
        if (stored !== undefined) return stored;
        const planet = calculatedDetails?.planets?.find(({ name }) => name === planetName);
        if (!planet || !calculatedDetails?.houses?.length) return undefined;
        return get22ndDrekkanaLordFromPlanet(planet, calculatedDetails.houses);
    };
    const moonDrekkanaLord = drekkanaLordFrom(2, calculatedDetails?.lord22ndDrekkanaMoon);
    const sunDrekkanaLord = drekkanaLordFrom(1, calculatedDetails?.lord22ndDrekkanaSun);

    // 10th / 16th / 34th Drekkana lords of the lagna — stored when the horoscope is saved; legacy docs
    // without the fields are derived from the stored ascendant sign + degree.
    const lagnaDrekkanaLord = (n: number, stored?: number) => {
        if (stored !== undefined) return stored;
        const asc = calculatedDetails?.ascendant;
        return asc?.sign ? getNthDrekkanaLord(n, asc.sign, asc.degree ?? 0) : undefined;
    };
    const drekkanaLord10 = lagnaDrekkanaLord(10, calculatedDetails?.lord10thDrekkana);
    const drekkanaLord16 = lagnaDrekkanaLord(16, calculatedDetails?.lord16thDrekkana);
    const drekkanaLord34 = lagnaDrekkanaLord(34, calculatedDetails?.lord34thDrekkana);

    // Bhava Suchika (භාව සුචික) of the Lagna point — stored value wins; legacy auto docs without
    // the field are recomputed from the birth ascendant; manual charts only use entered Navamsa
    // data (a manual chart without entered Navamsa placements shows no tag).
    const resolvedLagnaBhavaSuchika = resolveLagnaBhavaSuchika(calculatedDetails);

    // Warga Kendara tables: the stored value wins; legacy documents that predate the field are
    // re-derived from the stored chart data at render time (incl. the D1-only flags).
    const resolvedWargaKendara = resolveWargaKendara(calculatedDetails);
    const secondChartEntry = isComputedChart(secondChart) ? (resolvedWargaKendara?.[secondChart] ?? null) : null;

    // Drekkana (D3) / Trimshamsha (D30): computed and stored when the horoscope is saved (wargaKendara
    // d3/d30 entries; the D30 Chart record too). Documents stored before a key existed re-derive it
    // from the real D1 degrees. Manual charts have one only from their entered degrees (Lagna degree
    // + the planets with an amsha/kala) — other manual degrees are synthetic (navamsa midpoints / 15°).
    // Legacy stored D3 Chart records hold a copy of D1, so the D3 figure is always rebuilt.
    const degreeVargaKey = secondChart === "d3" || secondChart === "d30" ? secondChart : null;
    const degreeVargaSource =
        !degreeVargaKey || !calculatedDetails
            ? null
            : isManualChart
              ? manualTrimshamshaSource(calculatedDetails.planets ?? [], calculatedDetails.manualHousePlacements)
              : calculatedDetails;
    const degreeVargaChart =
        degreeVargaKey && degreeVargaSource
            ? degreeVargaKey === "d3"
                ? buildDrekkanaChart(degreeVargaSource)
                : (!isManualChart && data.charts.find(({ type }) => type === ChartType.TRIMSHAMSHA_D30)?.data) ||
                  buildTrimshamshaChart(degreeVargaSource)
            : null;
    const degreeVargaEntry =
        degreeVargaKey && degreeVargaSource
            ? (resolvedWargaKendara?.[degreeVargaKey] ??
              computeWargaDegreeVargaEntry(degreeVargaKey, degreeVargaSource, aspectSettings.planetAspects))
            : null;

    // Nisheka (docs/nisheka-lagna.md): computed and stored when the horoscope is saved (auto charts
    // only); the figure and tables are rebuilt from the stored nisheka planets.
    const nisheka = secondChart === "nisheka" ? calculatedDetails?.nisheka : undefined;
    const nishekaChart = nisheka ? buildNishekaChart(nisheka) : null;
    const nishekaEntry = nishekaChart ? computeWargaChartEntry(nishekaChart, aspectSettings.planetAspects) : null;

    // Yogal/Dosha tags: computed-and-stored entries win (yogaDoshaVersion: 1); legacy documents
    // are re-derived from the stored chart data at render time — same fallback as Warga Kendara.
    const resolvedYogaDoshas = resolveYogaDoshas(calculatedDetails);

    // Suba/Asuba (සුබ/අසුබ) verdicts: stored entries win; legacy documents that predate the field
    // are recomputed from the stored planets + thithi at render time (see src/lib/subaAsuba.ts).
    const resolvedSubaAsuba = resolveSubaAsuba(calculatedDetails);

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

    /** Roving-tabindex strip keyboard: Left/Right arrows move focus + selection (wrapping), Home/End
     *  jump to the first/last second-chart button. Space/Enter activate natively via onClick. */
    const handleSecondChartKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = SECOND_CHART_KEYS.length - 1;
        let nextIndex = -1;
        if (event.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
        else if (event.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = last;
        if (nextIndex === -1) return;
        event.preventDefault();
        setSecondChart(SECOND_CHART_KEYS[nextIndex]);
        secondChartButtonsRef.current[nextIndex]?.focus();
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

    /** Shad Bala (ෂඩ් බලය) table, recomputed at render time for legacy CalculatedDetails documents
     *  that predate the field, then merged with any stored student overrides (sticky — kept through
     *  recalculation). Manual charts derive only the subset of rules that use entered data. */
    const resolvedShadbalaya =
        calculatedDetails?.planets && calculatedDetails?.houses
            ? mergeShadBalaya(
                  computeShadBalaya(calculatedDetails.planets, calculatedDetails.houses, {
                      source: horoscope.source === "manual" ? "manual" : "auto",
                      thithi: getThithi(),
                      day: horoscope.source !== "manual" ? deriveDay(calculatedDetails.planets) : undefined,
                      maranakaraka: resolvedMaranakaraka,
                  }),
                  calculatedDetails.shadbalaya,
              )
            : undefined;

    const getNavamsaSign = (sign: number, degree: number): number => {
        const navamsaNum = Math.floor(degree / (30 / 9)) + 1;
        return navamsaSign(sign, navamsaNum);
    };

    const getNavamsaChartData = (): { planets: Planet[]; houses: House[]; ascendant: Ascendant } | null => {
        if (!calculatedDetails) return null;

        if (horoscope.source === "manual" && calculatedDetails.manualHousePlacements) {
            const { navamsaLagna, navamsaHouses } = calculatedDetails.manualHousePlacements;
            if (hasManualNavamsa(calculatedDetails.manualHousePlacements)) {
                // hasManualNavamsa guarantees navamsaLagna is present (1-12) — the fallback only
                // satisfies the type checker.
                const houses = buildWholeSignHouses(navamsaLagna ?? calculatedDetails.manualHousePlacements.lagna);
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
                    sign: navamsaLagna ?? calculatedDetails.manualHousePlacements.lagna,
                    degree: 0,
                    lord: SIGN_LORD_MAP[navamsaLagna ?? calculatedDetails.manualHousePlacements.lagna] ?? 1,
                };
                return { planets, houses, ascendant };
            }
            // Manual charts without entered Navamsa data have no Navamsa (D9) chart at all — never
            // fall through to the auto derivation (which would fake one from a 0° ascendant).
            return null;
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
     *  `calculatedDetails.planets` use the segment start, written when the chart was created). Manual
     *  charts WITHOUT Navamsa data have no segments — every planet sits at the house (sign) middle
     *  degree 15°, matching `synthesizePlanets`. */
    const getManualAdjustedPlanets = (): Planet[] => {
        if (horoscope.source !== "manual" || !calculatedDetails?.manualHousePlacements)
            return calculatedDetails?.planets ?? [];
        if (!navamsaAvailable) {
            return calculatedDetails.planets.map((p) =>
                hasExactDegree(p)
                    ? p
                    : {
                          ...p,
                          degree: 15,
                          absoluteDegree: (p.sign - 1) * 30 + 15,
                      },
            );
        }
        return calculatedDetails.planets.map((p) => {
            if (hasExactDegree(p)) return p;
            const index = navamsaIndexForSign(p.sign, p.navamsaSign ?? p.sign);
            const arc = 30 / 9;
            const degree = (index - 0.5) * arc;
            return { ...p, degree, absoluteDegree: (p.sign - 1) * 30 + degree };
        });
    };

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

    /** Second Warga Kendara figure data for the currently selected chart: the Navamsa (D9) chart
     *  for `d9`, and the stored Surya/Chandra Lagna chart (auto) or the on-the-fly Sun/Moon rotation
     *  (manual) for the other two. Null when the chart cannot be derived (e.g. a manual horoscope
     *  without entered Navamsa data). */
    const getSecondChartData = (): ChartInput | null => {
        if (!calculatedDetails) return null;
        if (secondChart === "d9") return getNavamsaChartData();
        const type = secondChart === "suryaLagna" ? ChartType.SURYA_LAGNA : ChartType.CHANDRA_LAGNA;
        const stored = data.charts.find((c) => c.type === type);
        if (stored?.data) return stored.data;
        return getSunMoonChartData(type);
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

    /** The planet table's "Other" column tags (22nd drekkana lords, 64th navamsa lord, karakas,
     *  badhaka, nidhanamsha, ashtamansha, wargoththama, gandanta/gandamula, pushkara, shad bala),
     *  shared by the desktop table, the mobile cards and the dasha labels. */
    const getPlanetTags = (p: Planet): PlanetTag[] => {
        const tags: PlanetTag[] = [];
        if (!calculatedDetails) return tags;
        if (p.combustion) tags.push({ key: "combustion", text: t("astrology.combustLabel") });
        if (drekkanaLord10 === p.name) tags.push({ key: "drekkana10", text: t("astrology.drekkanaLord10Label") });
        if (drekkanaLord16 === p.name) tags.push({ key: "drekkana16", text: t("astrology.drekkanaLord16Label") });
        if (calculatedDetails.lord22ndDrekkana === p.name)
            tags.push({ key: "drekkana", text: t("astrology.drekkanaLordLabel") });
        if (drekkanaLord34 === p.name) tags.push({ key: "drekkana34", text: t("astrology.drekkanaLord34Label") });
        if (moonDrekkanaLord === p.name) tags.push({ key: "drekkanaMoon", text: t("astrology.drekkanaLordMoonLabel") });
        if (sunDrekkanaLord === p.name) tags.push({ key: "drekkanaSun", text: t("astrology.drekkanaLordSunLabel") });
        if (navamsaAvailable && calculatedDetails.lord64thNavamsa === p.name)
            tags.push({ key: "navamsa", text: t("astrology.navamsaLordLabel") });
        if (calculatedDetails.atmakaraka === p.name)
            tags.push({ key: "atmakaraka", text: t("astrology.atmakarakaLabel") });
        if (resolvedMaranakaraka.includes(p.name))
            tags.push({ key: "maranakaraka", text: t("astrology.maranakarakaLabel") });
        if (resolvedYogakaraka.includes(p.name)) tags.push({ key: "yogakaraka", text: t("astrology.yogakarakaLabel") });
        if (calculatedDetails.marakaPlanets?.includes(p.name))
            tags.push({ key: "maraka", text: t("astrology.marakaLabel") });
        if (resolvedBadhakaLevels[p.name])
            tags.push({
                key: "badhaka",
                text: t("astrology.badhakaLevelLabel", { levels: resolvedBadhakaLevels[p.name].join(",") }),
            });
        if (calculatedDetails.nidhanamshaPlanets?.includes(p.name))
            tags.push({ key: "nidhanamsha", text: t("astrology.nidhanamshaLabel") });
        if (calculatedDetails.ashtamanshaPlanets?.includes(p.name))
            tags.push({ key: "ashtamansha", text: t("astrology.ashtamanshaLabel") });
        if (navamsaAvailable && calculatedDetails.wargoththamaPlanets?.includes(p.name)) {
            const crossed =
                calculatedDetails.gandanthaPlanets?.includes(p.name) ||
                calculatedDetails.gandamulaPlanets?.includes(p.name);
            tags.push({ key: "wargoththama", text: t("astrology.wargoththamaLabel"), strikethrough: crossed });
        }
        if (calculatedDetails.gandanthaPlanets?.includes(p.name))
            tags.push({ key: "gandanta", text: t("astrology.gandantaLabel") });
        if (calculatedDetails.gandamulaPlanets?.includes(p.name))
            tags.push({ key: "gandamula", text: t("astrology.gandamulaLabel") });
        if (navamsaAvailable && calculatedDetails.pushkaraPlanets?.includes(p.name))
            tags.push({ key: "pushkara", text: t("astrology.pushkaraLabel") });
        const shadBalayaPlanet = resolvedShadbalaya?.[String(p.name)];
        if (shadBalayaPlanet?.cheshtaBala.value)
            tags.push({ key: "cheshtaBala", text: t("astrology.cheshtaBalaLabel") });
        if (shadBalayaPlanet?.kalaBala.value) tags.push({ key: "kalaBala", text: t("astrology.kalaBalaLabel") });
        if (shadBalayaPlanet?.digBala.value) tags.push({ key: "digBala", text: t("astrology.digBalaLabel") });
        return tags;
    };


    /** Dignities worth flagging on a dasha label (the planet table shows them in its strength column). */
    const DASHA_DIGNITY_STRENGTHS = new Set<PlanetaryStrength>([
        PlanetaryStrength.ATHI_UCHCHA,
        PlanetaryStrength.UCHCHA,
        PlanetaryStrength.MOOLATRIKONA,
        PlanetaryStrength.OWN_SIGN,
        PlanetaryStrength.NEECHA,
        PlanetaryStrength.ATHI_NEECHA,
    ]);

    /** Dasha label tags per planet id: its dignity (uchcha/neecha/…) then the "Other" column tags. */
    const getDashaPlanetTags = (): Record<number, PlanetTag[]> => {
        const result: Record<number, PlanetTag[]> = {};
        calculatedDetails?.planets?.forEach((p) => {
            const strength = getStrength(p.strength);
            const dignity: PlanetTag[] = DASHA_DIGNITY_STRENGTHS.has(strength)
                ? [{ key: "strength", text: t(`astrology.${STRENGTH_TRANSLATION_KEYS[strength]}`) }]
                : [];
            result[p.name] = [...dignity, ...getPlanetTags(p)];
        });
        return result;
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

    /** In-sign degree label of a planet: the real degree when known, else (manual charts with Navamsa
     *  data) its navamsa segment range; undefined when neither is known. */
    const getPlanetDegreeLabel = (p: Planet): string | undefined =>
        hasExactDegree(p) ? formatDegree(p.degree) : navamsaAvailable ? getPlanetDegreeRange(p) : undefined;

    /** Sun's sidereal longitude for the Upagrahas — only when its degree is known (auto charts, or
     *  manual charts with an entered Sun degree). */
    const d1Sun = calculatedDetails?.planets?.find((p) => p.name === PlanetId.SUN);
    const d1SunLongitude = d1Sun && hasExactDegree(d1Sun) ? d1Sun.absoluteDegree : undefined;

    /** D1 rows of the shared Houses table — rendered by both the Calculations tab and the birth chart
     *  figure, so the two always show identical values (each with its own column layout). */
    const buildD1HouseData = (): HouseTableData | undefined => {
        if (!calculatedDetails) return undefined;
        // An entered lagna degree gives real cusps (rendered like an auto chart from the bhava houses).
        const isManualRow = isManualChart && !hasExactAscendant;
        // Without Navamsa data a manual chart carries no degree values: houses show the sign only.
        const showSignOnly = isManualRow && !navamsaAvailable;
        const rows: HouseTableRow[] = calculatedDetails.houses.map((h) => {
            const manualRange =
                isManualRow && navamsaAvailable
                    ? getManualHouseRange(
                          h.houseNumber,
                          h.sign,
                          getAscMidRange().start,
                          getAscMidRange().end,
                          getAscendantAbsDeg() ?? 0,
                      )
                    : null;
            const cusp = (key: "start" | "mid" | "end", sign?: number, lord?: number, degree = 0): string =>
                manualRange
                    ? manualRange[key]
                    : showSignOnly
                      ? getSignName(h.sign)
                      : formatSignLordDegree(sign, lord, degree, h.sign, h.lord);
            return {
                houseNumber: h.houseNumber,
                sign: h.sign,
                start: cusp("start", h.startSign, h.startLord, h.startDegree),
                mid: cusp("mid", h.middleSign, h.middleLord, h.middleDegree),
                end: cusp("end", h.endSign, h.endLord, h.endDegree),
                planets: getPlanetsInHouse(h.houseNumber).map((p) => ({
                    name: p.name,
                    degreeLabel: getPlanetDegreeLabel(p),
                })),
                aspects: displayAspects.byHouse[h.houseNumber] ?? [],
                kendrasthana: kendrasthana.byHouse[h.houseNumber] ?? [],
            };
        });
        const data: HouseTableData = {
            rows,
            available: new Set([...CORE_HOUSE_COLUMNS, "start", "mid", "end", "kendrasthana"]),
        };
        const withUpa = d1SunLongitude !== undefined ? withUpagrahas(data, d1SunLongitude) : data;
        // Moon's sign read from its house, as the birth chart does, so lean manual data works too.
        const moonHouse = calculatedDetails.planets?.find((p) => p.name === PlanetId.MOON)?.house;
        return withSpecialLagnas(withUpa, {
            ascendantSign: calculatedDetails.ascendant.sign,
            moonSign: rows.find((r) => r.houseNumber === moonHouse)?.sign,
            horaLagna: calculatedDetails.horaLagna,
            gulikaLagna: calculatedDetails.gulikaLagna,
            pranapadaLagna: calculatedDetails.pranapadaLagna,
        });
    };

    /** D1 rows of the shared Planets table (see buildD1HouseData). */
    const buildD1PlanetData = (): PlanetTableData | undefined => {
        if (!calculatedDetails) return undefined;
        const available = new Set<PlanetColumnId>([...CORE_PLANET_COLUMNS, "subaAsuba", "kendrasthana"]);
        if (navamsaAvailable) {
            available.add("navamsa").add("navamsaStrength").add("nakshatra").add("bhavaSuchika");
        }
        const rows: PlanetTableRow[] = [...calculatedDetails.planets]
            .sort((a, b) => a.name - b.name)
            .map((p) => ({
                name: p.name,
                retrograde: !!p.retrograde,
                sign: p.sign,
                degreeLabel: getPlanetDegreeLabel(p),
                strength: getStrength(p.strength),
                // Planet house is its whole-sign Rashi location, never the cusp-boundary range.
                house: p.house,
                ownership: ownedHousesOf(p.name, calculatedDetails.houses),
                // Suba/Asuba and Bhava Suchika: stored values win; legacy docs resolve lazily.
                subaAsuba: resolvedSubaAsuba?.[String(p.name)],
                navamsaSign: navamsaAvailable ? p.navamsaSign : undefined,
                navamsaStrength: navamsaAvailable ? getStrength(p.navamsaStrength) : undefined,
                nakshatra: navamsaAvailable ? { id: p.nakshatra, pada: p.pada } : undefined,
                bhavaSuchika: navamsaAvailable ? resolvePlanetBhavaSuchika(calculatedDetails, p.name) : undefined,
                conjunctions: resolvedConjunctionsByPlanet[p.name] ?? [],
                aspects: displayAspects.receivedByPlanet[p.name] ?? [],
                kendrasthana: kendrasthana.byPlanet[p.name] ?? [],
                tags: getPlanetTags(p),
            }));
        return withGrahaMaitri({ rows, available, showAspectDelta: true });
    };

    const d1HouseData = buildD1HouseData();
    const d1PlanetData = buildD1PlanetData();
    const d1PlanetSigns: Record<number, number> = Object.fromEntries(
        (d1PlanetData?.rows ?? []).map((row) => [row.name, row.sign]),
    );

    // Other Charts, Notepad, Shad Bala and Metadata are restricted to super admins for now.
    const isSuperAdmin = session?.user?.role === "super-admin";

    const tabs = [
        { id: "charts", label: t("horoscope.charts") },
        { id: "calculations", label: t("horoscope.calculations") },
        { id: "dashas", label: t("horoscope.dashas") },
        { id: "yoga-doshas", label: t("horoscope.yogaDoshas") },
        ...(isSuperAdmin ? [{ id: "metadata", label: t("horoscope.metadata") }] : []),
    ];

    // The Warga Kendara pair now covers Birth/Navamsa/Surya Lagna/Chandra Lagna, so the Other Charts
    // section keeps just the House (bhava) chart.
    const chartTypes = [ChartType.HOUSE];

    const getSecondChartLabel = (key: WargaStripKey): string =>
        isComputedChart(key)
            ? t(SECOND_CHART_TAB_KEYS[key as "d9" | "suryaLagna" | "chandraLagna"])
            : key === "nisheka"
              ? t("astrology.wargaKendara.tabs.nisheka")
              : `${t(`astrology.wargaKendara.vargas.${key}.name`)} (D${VARGA_CATALOG.find((v) => v.key === key)?.d})`;

    // Phone second-chart picker: one native select (grouped) in the second figure's caption, in
    // place of the 18-chip strip used from `sm` up.
    const secondChartPicker = (
        <div className="relative">
            <label htmlFor="second-chart-select" className="sr-only">
                {t("astrology.wargaKendara.secondChartAria")}
            </label>
            <select
                id="second-chart-select"
                value={secondChart}
                onChange={(e) => setSecondChart(e.target.value as WargaStripKey)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-9 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <optgroup label={t("astrology.wargaKendara.mainChartsGroup")}>
                    {SECOND_CHART_KEYS.slice(0, MAIN_SECOND_CHART_COUNT).map((key) => (
                        <option key={key} value={key}>
                            {getSecondChartLabel(key)}
                        </option>
                    ))}
                </optgroup>
                <optgroup label={t("astrology.wargaKendara.vargaChartsGroup")}>
                    {SECOND_CHART_KEYS.slice(MAIN_SECOND_CHART_COUNT).map((key) => (
                        <option key={key} value={key}>
                            {getSecondChartLabel(key)}
                        </option>
                    ))}
                </optgroup>
            </select>
            <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </div>
    );

    return (
        <div className="pb-20 sm:pb-0">
            {toast && (
                <div
                    className={`fixed top-4 left-4 right-4 sm:left-auto z-50 px-4 py-3 rounded-lg shadow-lg text-sm transition-all ${
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

            {/* Phones: prev/next lives only at the end of the page (below), so the charts lead. */}
            <div className="hidden sm:block">{renderNav()}</div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h1 className="text-xl sm:text-2xl font-bold break-words min-w-0">{horoscope.name}</h1>
                        {horoscope.source === "manual" && <CalculatedChartBadge />}
                        <PrivacyBadge
                            isPublic={isPublicState}
                            displayName={displayNameState}
                            isOwner={horoscope.owner?.id === session?.user?.id}
                            size="md"
                        />
                    </div>
                    {horoscope.source !== "manual" && (
                        <p className="text-sm text-gray-500 sm:truncate" title={horoscope.locationName || undefined}>
                            {formatDate(horoscope.birthDate)} {horoscope.birthTime} |{" "}
                            {horoscope.locationName
                                ? horoscope.locationName
                                : `${horoscope.latitude}, ${horoscope.longitude}`}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isSuperAdmin && <Notepad horoscopeId={params.id as string} calculatedDetails={calculatedDetails} />}
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
                        initialPlanetDegrees={calculatedDetails.manualHousePlacements.planetDegrees}
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
                    {/* Phones: sections live in a fixed bottom bar so the charts lead the page.
                        `sm`+: the underline tab strip below. */}
                    <nav
                        aria-label={t("horoscope.sectionsAria")}
                        className="sm:hidden fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
                    >
                        <div className="grid grid-cols-5">
                            {tabs.map((tab) => {
                                const active = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            document.querySelector("main")?.scrollTo({ top: 0 });
                                        }}
                                        aria-current={active ? "page" : undefined}
                                        className={`relative flex flex-col items-center justify-center gap-0.5 min-h-14 px-0.5 py-1.5 text-[11px] leading-tight text-center transition-colors ${
                                            active ? "text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-800"
                                        }`}
                                    >
                                        {active && (
                                            <span
                                                className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-indigo-600"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <HoroscopeTabIcon tab={tab.id} />
                                        <span className="line-clamp-2 break-words">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                    <div className="hidden sm:flex gap-1 mb-6 border-b">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                aria-pressed={activeTab === tab.id}
                                className={`whitespace-nowrap px-4 py-2 text-sm border-b-2 transition-colors ${
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
                            <section>
                                {navamsaAvailable && (
                                    <div
                                        role="group"
                                        aria-label={t("astrology.wargaKendara.secondChartAria")}
                                        className="hidden sm:flex flex-wrap gap-2 mb-4"
                                    >
                                        <span
                                            aria-label={t("astrology.wargaKendara.pinnedAria")}
                                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border rounded bg-indigo-600 text-white border-indigo-600 whitespace-nowrap"
                                        >
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                aria-hidden="true"
                                                className="shrink-0"
                                            >
                                                <rect x="4" y="11" width="16" height="10" rx="2" />
                                                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                                            </svg>
                                            {t("astrology.wargaKendara.tabs.rashi")}
                                        </span>
                                        {SECOND_CHART_KEYS.map((key, index) => {
                                            const selected = secondChart === key;
                                            const label = getSecondChartLabel(key);
                                            return (
                                                <button
                                                    key={key}
                                                    ref={(el) => {
                                                        secondChartButtonsRef.current[index] = el;
                                                    }}
                                                    onClick={() => setSecondChart(key)}
                                                    onKeyDown={(event) => handleSecondChartKeyDown(event, index)}
                                                    aria-pressed={selected}
                                                    className={`text-xs px-3 py-1.5 border rounded whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                        selected
                                                            ? "bg-indigo-600 text-white border-indigo-600"
                                                            : "hover:bg-gray-50"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {(() => {
                                    if (!calculatedDetails) {
                                        return (
                                            <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                <p className="text-sm">{t("astrology.noChartData")}</p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div
                                            className={`grid gap-4 [&>*]:min-w-0 ${navamsaAvailable ? "grid-cols-1 lg:grid-cols-[3fr_2fr]" : ""}`}
                                        >
                                            <WargaChartSection
                                                chartKey="d1"
                                                caption={t("astrology.chartCaptions.birth")}
                                                chartData={{
                                                    planets: calculatedDetails.planets,
                                                    houses: calculatedDetails.houses,
                                                    ascendant: calculatedDetails.ascendant,
                                                }}
                                                entry={resolvedWargaKendara?.d1 ?? null}
                                                noDataMessage={t("astrology.noChartData")}
                                                ascendantDegreeLabel={getBirthChartAscendantDegreeLabel()}
                                                houseData={d1HouseData}
                                                planetData={d1PlanetData}
                                                displayAspects={displayAspects}
                                                horaLagnaSign={calculatedDetails.horaLagna?.sign}
                                                gulikaLagnaSign={calculatedDetails.gulikaLagna?.sign}
                                                pranapadaLagnaSign={calculatedDetails.pranapadaLagna?.sign}
                                                sunLongitude={d1SunLongitude}
                                            />
                                            {navamsaAvailable &&
                                                (isComputedChart(secondChart) ? (
                                                    <WargaChartSection
                                                        key={secondChart}
                                                        chartKey={secondChart}
                                                        caption={t(SECOND_CHART_CAPTION_KEYS[secondChart])}
                                                        captionControl={secondChartPicker}
                                                        chartData={getSecondChartData()}
                                                        entry={secondChartEntry}
                                                        noDataMessage={t("astrology.noChartData")}
                                                        showAscendantDegree={secondChart !== "d9"}
                                                        rashiAspects={aspectSettings.rashiAspects}
                                                        {...(secondChart !== "d9" && secondChartEntry
                                                            ? {
                                                                  // Surya/Chandra Lagna: same planets & degrees as D1 → D1's records.
                                                                  conjunctionMap: resolvedConjunctionsByPlanet,
                                                                  displayAspects: rotateDisplayAspects(
                                                                      displayAspects,
                                                                      calculatedDetails.houses ?? [],
                                                                      secondChartEntry.houses,
                                                                  ),
                                                              }
                                                            : {})}
                                                    />
                                                ) : secondChart === "nisheka" ? (
                                                    <WargaChartSection
                                                        key={secondChart}
                                                        chartKey="nisheka"
                                                        caption={t("astrology.chartCaptions.nisheka")}
                                                        captionControl={secondChartPicker}
                                                        chartData={nishekaChart}
                                                        entry={nishekaEntry}
                                                        noDataMessage={t("astrology.noChartData")}
                                                        rashiAspects={aspectSettings.rashiAspects}
                                                        details={nisheka && <NishekaDetails nisheka={nisheka} />}
                                                    />
                                                ) : secondChart === "d3" || secondChart === "d30" ? (
                                                    <WargaChartSection
                                                        key={secondChart}
                                                        chartKey={secondChart}
                                                        caption={`${t(`astrology.wargaKendara.vargas.${secondChart}.name`)} (${secondChart.toUpperCase()})`}
                                                        captionControl={secondChartPicker}
                                                        chartData={degreeVargaChart}
                                                        entry={degreeVargaEntry}
                                                        noDataMessage={t("astrology.noChartData")}
                                                        showAscendantDegree={false}
                                                        rashiAspects={aspectSettings.rashiAspects}
                                                    />
                                                ) : (
                                                    <figure className="bg-white rounded-lg border p-3 sm:p-4">
                                                        <figcaption className="text-sm font-semibold text-gray-700">
                                                            <span className="hidden sm:inline">
                                                                {t(`astrology.wargaKendara.vargas.${secondChart}.name`)} ( D
                                                                {VARGA_CATALOG.find((v) => v.key === secondChart)?.d})
                                                            </span>
                                                            <div className="sm:hidden">{secondChartPicker}</div>
                                                        </figcaption>
                                                        <WargaIndicationTags chartKey={secondChart} />
                                                        <div className="mt-4 bg-white rounded-lg border p-6 min-h-[150px] flex items-center justify-center">
                                                            <p className="text-sm text-gray-400">
                                                                {t("astrology.wargaKendara.comingSoon")}
                                                            </p>
                                                        </div>
                                                    </figure>
                                                ))}
                                        </div>
                                    );
                                })()}
                            </section>

                            {isSuperAdmin && (
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
                                                <div className="bg-white rounded-lg border p-2 sm:p-4">
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

                                        return (
                                            <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
                                                <p className="text-sm">{t("astrology.noChartData")}</p>
                                            </div>
                                        );
                                    })()}
                                </section>
                            )}
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
                            <section className="bg-white rounded-lg border p-3 sm:p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded p-3">
                                        <h4 className="font-semibold text-sm text-indigo-700 uppercase tracking-wide mb-2">
                                            {t("astrology.ascendant")}
                                        </h4>
                                        <p className="text-sm mb-1">
                                            {getSignName(calculatedDetails.ascendant.sign)} (
                                            {getPlanetName(calculatedDetails.ascendant.lord)})
                                            {(navamsaAvailable || hasExactAscendant) && (
                                                <>
                                                    {" "}
                                                    {isManualChart && !hasExactAscendant
                                                        ? formatNavamsaDegreeRange(
                                                              getAscMidRange().start,
                                                              getAscMidRange().end,
                                                          )
                                                        : formatDegree(calculatedDetails.ascendant.degree)}
                                                </>
                                            )}
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
                                            if (navamsaAvailable && calculatedDetails.isAscendantWargoththama) {
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
                                            if (navamsaAvailable && ascFlags.isAscendantPushkara)
                                                ascTags.push({
                                                    key: "pushkara",
                                                    text: t("astrology.pushkaraLabel"),
                                                });
                                            if (ascTags.length === 0 && resolvedLagnaBhavaSuchika === undefined)
                                                return null;
                                            return (
                                                <p className="mt-2 flex flex-wrap gap-1">
                                                    {resolvedLagnaBhavaSuchika !== undefined && (
                                                        <BhavaSuchikaTag value={resolvedLagnaBhavaSuchika} />
                                                    )}
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

                            {d1HouseData && d1PlanetData && (
                                <>
                                    <HousesTable
                                        view="calculations"
                                        data={d1HouseData}
                                        planetSigns={d1PlanetSigns}
                                        showAspectDelta
                                    />
                                    <PlanetsTable view="calculations" data={d1PlanetData} />
                                </>
                            )}

                            {isSuperAdmin && resolvedShadbalaya && (
                                <ShadBalaTable
                                    horoscopeId={horoscope._id}
                                    shadbalaya={resolvedShadbalaya}
                                    isEditable
                                    getPlanetName={getPlanetName}
                                    getSignName={getSignName}
                                />
                            )}

                            {horoscope.source === "manual" && calculatedDetails.derivedRanges && (
                                <DerivedRangesSection
                                    ranges={calculatedDetails.derivedRanges}
                                    birthDate={horoscope.birthDate}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === "dashas" && calculatedDetails && (
                        <div className="bg-white rounded-lg border p-3 sm:p-4">
                            <DashaSection
                                dashas={calculatedDetails.dashas as unknown as Dashas}
                                getPlanetName={getPlanetName}
                                getDashaLevelName={getDashaLevelName}
                                getSignName={getSignName}
                                planets={calculatedDetails.planets}
                                lagnaSign={calculatedDetails.ascendant.sign}
                                showNakshatraNumbers={navamsaAvailable}
                                planetTags={getDashaPlanetTags()}
                            />
                        </div>
                    )}

                    {activeTab === "yoga-doshas" && calculatedDetails && (
                        <div className="space-y-6">
                            {resolvedYogaDoshas && <YogaDoshaSection result={resolvedYogaDoshas} />}
                        </div>
                    )}

                    {isSuperAdmin && activeTab === "metadata" && (
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

const TAB_ICON_PATHS: Record<string, ReactNode> = {
    // Square South-Indian style chart grid.
    charts: (
        <>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </>
    ),
    calculations: (
        <>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M9 6h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h6" />
        </>
    ),
    dashas: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    "yoga-doshas": <path d="M12 3l2.3 5.6L20 9.3l-4.4 3.9 1.3 5.8L12 16l-4.9 3 1.3-5.8L4 9.3l5.7-.7z" />,
    metadata: (
        <>
            <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
            <circle cx="7.5" cy="7.5" r="1.5" />
        </>
    ),
};

function HoroscopeTabIcon({ tab }: { tab: string }) {
    return (
        <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {TAB_ICON_PATHS[tab]}
        </svg>
    );
}
