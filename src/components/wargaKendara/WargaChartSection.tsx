"use client";

import { type ReactNode, useId, useState } from "react";

import { BirthChart } from "@/components/BirthChart";
import HousesTable from "@/components/chartTables/HousesTable";
import PlanetsTable from "@/components/chartTables/PlanetsTable";
import { useI18n } from "@/hooks/useI18n";

import type { Aspect } from "@/lib/astrology";
import type { DisplayAspects } from "@/lib/chartAspects";
import { toBirthChartData } from "@/lib/chartDataTransform";
import type { ChartInput } from "@/lib/chartDataTransform";
import { type HouseTableData, type PlanetTableData, buildWargaHouseData, buildWargaPlanetData } from "@/lib/chartTableRows";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";
import { resolveWargaDisplayAspects } from "@/lib/wargaKendara";
import type { WargaChartEntry, WargaChartKey, WargaDegreeVargaKey } from "@/lib/wargaKendara";

import WargaIndicationTags from "./WargaIndicationTags";

interface WargaChartSectionProps {
    /** Warga key of this figure — drives the indication tags and the D1-only table columns. */
    chartKey: WargaChartKey | WargaDegreeVargaKey | "nisheka";
    /** Localized figure caption (astrology.chartCaptions.*). */
    caption: string;
    /** SVG figure source; null → the no-data placeholder. */
    chartData: ChartInput | null;
    /** Per-chart tables data; null → the no-data placeholder (no empty tables). */
    entry: WargaChartEntry | null;
    /** Localized no-data message (astrology.noChartData). */
    noDataMessage: string;
    /** Manual D1 ascendant degree label (existing BirthChart behavior). */
    ascendantDegreeLabel?: string;
    /** D9 figures hide the ascendant degree (existing BirthChart behavior). */
    showAscendantDegree?: boolean;
    /** Prebuilt table rows (D1): the exact rows of the Calculations tab, so both tabs show the same
     *  values. Omitted → rows are built from `entry`. */
    houseData?: HouseTableData;
    planetData?: PlanetTableData;
    /** Degree-based conjunction records (D1 and Surya/Chandra Lagna) for the Planets table — the same orb-matched Aspect[]
     *  records as the calculation tab (true deltas; Rahu/Ketu only via a partner's orb). When
     *  present the table renders these instead of the stored whole-sign conjunctions. */
    conjunctionMap?: Record<number, Aspect[]>;
    /** Degree-based aspect records — D1's (resolveDisplayAspects), or for Surya/Chandra Lagna the
     *  same records re-keyed onto the rotated houses (rotateDisplayAspects). Omitted → whole-sign
     *  records from `entry`. */
    displayAspects?: DisplayAspects;
    /** Rashi Aspects setting for the non-D1 charts' whole-sign rashi aspects (default rules when
     *  omitted). D1 uses `displayAspects` instead. */
    rashiAspects?: RashiAspectsSetting;
    /** Hora Lagna sign (1-12), marked "HL" on the D1 figure only. */
    horaLagnaSign?: number;
    /** Gulika Lagna sign (1-12), marked "GL" on the D1 figure only. */
    gulikaLagnaSign?: number;
    /** Pranapada Lagna sign (1-12), marked "PL" on the D1 figure only. */
    pranapadaLagnaSign?: number;
    /** Sun's sidereal longitude, for the Upagraha markers on the D1 figure only. */
    sunLongitude?: number;
    /** Extra content under the indication tags (e.g. the Nisheka calculation steps). */
    details?: ReactNode;
    /** Phone-only control shown in place of the caption text (e.g. the second-chart picker). */
    captionControl?: ReactNode;
}

/** Charts whose aspect records carry real degree differences (D1 and its Sun/Moon rotations). The
 *  whole-sign vargas (D9/D3/D30) have no degree difference, so their tooltips hide it. */
const DEGREE_ASPECT_CHARTS: ReadonlySet<string> = new Set(["d1", "suryaLagna", "chandraLagna"]);

/** One Warga Kendara figure: caption, main-indication tag chips, the SVG chart, and the per-chart
 *  Houses/Planets tables (shared with the Calculations tab; columns follow the user's Charts-tab
 *  layout). When `entry` is null the figure slot shows the no-data placeholder and no tables are
 *  rendered. */
const WargaChartSection = ({
    chartKey,
    caption,
    chartData,
    entry,
    noDataMessage,
    ascendantDegreeLabel,
    showAscendantDegree = true,
    houseData,
    planetData,
    conjunctionMap,
    displayAspects,
    rashiAspects,
    horaLagnaSign,
    gulikaLagnaSign,
    pranapadaLagnaSign,
    sunLongitude,
    details,
    captionControl,
}: WargaChartSectionProps) => {
    const { t } = useI18n();
    // Phones keep the figure in focus: tags, details and tables sit behind a toggle (closed by
    // default). From `sm` up they are always shown and the toggle is hidden.
    const [extrasOpen, setExtrasOpen] = useState(false);
    const extrasId = useId();
    const isD1 = chartKey === "d1";
    const showAspectDelta = DEGREE_ASPECT_CHARTS.has(chartKey);
    // D1 and the Surya/Chandra Lagna rotations render the degree-based engine records (passed in);
    // the whole-sign vargas get planetary + rashi aspect records from their own entry.
    const chartAspects = displayAspects ?? (entry ? resolveWargaDisplayAspects(entry, rashiAspects) : undefined);
    const rowOptions = {
        houseAspects: chartAspects?.byHouse,
        planetAspects: chartAspects?.receivedByPlanet,
        conjunctions: conjunctionMap,
        degreeBased: showAspectDelta,
        t,
    };
    const houses = entry ? (houseData ?? buildWargaHouseData(entry, rowOptions)) : null;
    const planets = entry ? (planetData ?? buildWargaPlanetData(entry, rowOptions)) : null;
    const planetSigns = Object.fromEntries((planets?.rows ?? []).map((row) => [row.name, row.sign]));

    return (
        <figure className="bg-white rounded-lg border p-3 sm:p-4">
            <figcaption className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <div className="flex-1 min-w-0">
                    {captionControl ? (
                        <>
                            <span className="hidden sm:inline">{caption}</span>
                            <div className="sm:hidden">{captionControl}</div>
                        </>
                    ) : (
                        caption
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setExtrasOpen((open) => !open)}
                    aria-expanded={extrasOpen}
                    aria-controls={extrasId}
                    aria-label={extrasOpen ? t("astrology.wargaKendara.hideTables") : t("astrology.wargaKendara.showTables")}
                    title={extrasOpen ? t("astrology.wargaKendara.hideTables") : t("astrology.wargaKendara.showTables")}
                    className={`sm:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                        extrasOpen
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                    <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M3 15h18M12 9v12" />
                    </svg>
                </button>
            </figcaption>
            <div className="hidden sm:block">
                <WargaIndicationTags chartKey={chartKey} />
                {details}
            </div>
            {chartData ? (
                <div className="flex justify-center mt-2">
                    <BirthChart
                        {...toBirthChartData(chartData)}
                        ascendantDegreeLabel={ascendantDegreeLabel}
                        showAscendantDegree={showAscendantDegree}
                        showInduLagna={isD1}
                        horaLagnaSign={isD1 ? horaLagnaSign : undefined}
                        gulikaLagnaSign={isD1 ? gulikaLagnaSign : undefined}
                        pranapadaLagnaSign={isD1 ? pranapadaLagnaSign : undefined}
                        sunLongitude={isD1 ? sunLongitude : undefined}
                    />
                </div>
            ) : (
                <div className="mt-2 bg-white rounded-lg border p-6 min-h-[300px] flex items-center justify-center">
                    <p className="text-sm text-gray-400">{noDataMessage}</p>
                </div>
            )}
            <div id={extrasId} className={`${extrasOpen ? "" : "hidden"} sm:block`}>
                <div className="sm:hidden">
                    <WargaIndicationTags chartKey={chartKey} />
                    {details}
                </div>
                {houses && planets ? (
                    <>
                        <HousesTable
                            view="charts"
                            data={houses}
                            planetSigns={planetSigns}
                            showAspectDelta={showAspectDelta}
                            caption={caption}
                        />
                        <PlanetsTable view="charts" data={planets} caption={caption} />
                    </>
                ) : (
                    chartData !== null && (
                        <div className="mt-4 bg-white rounded-lg border p-6 min-h-[150px] flex items-center justify-center">
                            <p className="text-sm text-gray-400">{noDataMessage}</p>
                        </div>
                    )
                )}
            </div>
        </figure>
    );
};

export default WargaChartSection;
