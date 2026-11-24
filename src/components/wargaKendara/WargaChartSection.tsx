"use client";

import { BirthChart } from "@/components/BirthChart";
import type { PlanetTag } from "@/components/Dasha/DashaPlanetTags";

import type { Aspect } from "@/lib/astrology";
import type { DisplayAspects } from "@/lib/chartAspects";
import { toBirthChartData } from "@/lib/chartDataTransform";
import type { ChartInput } from "@/lib/chartDataTransform";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";
import { resolveWargaDisplayAspects } from "@/lib/wargaKendara";
import type { WargaChartEntry, WargaChartKey, WargaDegreeVargaKey } from "@/lib/wargaKendara";

import WargaHousesTable from "./WargaHousesTable";
import WargaIndicationTags from "./WargaIndicationTags";
import WargaPlanetsTable from "./WargaPlanetsTable";

interface WargaChartSectionProps {
    /** Warga key of this figure — drives the indication tags and the D1-only table columns. */
    chartKey: WargaChartKey | WargaDegreeVargaKey;
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
    /** Per-planet Bhava Suchika values for the D1 Planets table (existing top-level field). */
    bhavaSuchika?: Record<number, number>;
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
    /** Planet → full "Other" tags for the Planets table (D1: the calculation tab's tags). */
    otherTags?: Record<number, PlanetTag[]>;
}

/** Charts whose aspect records carry real degree differences (D1 and its Sun/Moon rotations). The
 *  whole-sign vargas (D9/D3/D30) have no degree difference, so their tooltips hide it. */
const DEGREE_ASPECT_CHARTS: ReadonlySet<string> = new Set(["d1", "suryaLagna", "chandraLagna"]);

/** One Warga Kendara figure: caption, main-indication tag chips, the SVG chart, and the per-chart
 *  Houses/Planets tables (architecture component sketch). When `entry` is null the figure slot
 *  shows the no-data placeholder and no tables are rendered. */
const WargaChartSection = ({
    chartKey,
    caption,
    chartData,
    entry,
    noDataMessage,
    ascendantDegreeLabel,
    showAscendantDegree = true,
    bhavaSuchika,
    conjunctionMap,
    displayAspects,
    rashiAspects,
    otherTags,
}: WargaChartSectionProps) => {
    const isD1 = chartKey === "d1";
    const showAspectDelta = DEGREE_ASPECT_CHARTS.has(chartKey);
    // D1 and the Surya/Chandra Lagna rotations render the degree-based engine records (passed in);
    // the whole-sign vargas get planetary + rashi aspect records from their own entry.
    const chartAspects = displayAspects ?? (entry ? resolveWargaDisplayAspects(entry, rashiAspects) : undefined);

    return (
        <figure className="bg-white rounded-lg border p-4">
            <figcaption className="text-sm font-semibold text-gray-700">{caption}</figcaption>
            <WargaIndicationTags chartKey={chartKey} />
            {chartData ? (
                <div className="flex justify-center mt-2">
                    <BirthChart
                        {...toBirthChartData(chartData)}
                        ascendantDegreeLabel={ascendantDegreeLabel}
                        showAscendantDegree={showAscendantDegree}
                        showInduLagna={isD1}
                    />
                </div>
            ) : (
                <div className="mt-2 bg-white rounded-lg border p-6 min-h-[300px] flex items-center justify-center">
                    <p className="text-sm text-gray-400">{noDataMessage}</p>
                </div>
            )}
            {entry ? (
                <>
                    <WargaHousesTable
                        houses={entry.houses}
                        planets={entry.planets}
                        caption={caption}
                        aspectMap={chartAspects?.byHouse}
                        showAspectDelta={showAspectDelta}
                    />
                    <WargaPlanetsTable
                        entry={entry}
                        caption={caption}
                        isD1={isD1}
                        bhavaSuchika={bhavaSuchika}
                        conjunctionMap={conjunctionMap}
                        aspectMap={chartAspects?.receivedByPlanet}
                        showAspectDelta={showAspectDelta}
                        otherTags={otherTags}
                    />
                </>
            ) : (
                chartData !== null && (
                    <div className="mt-4 bg-white rounded-lg border p-6 min-h-[150px] flex items-center justify-center">
                        <p className="text-sm text-gray-400">{noDataMessage}</p>
                    </div>
                )
            )}
        </figure>
    );
};

export default WargaChartSection;
