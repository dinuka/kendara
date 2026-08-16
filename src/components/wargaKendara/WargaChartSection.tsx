"use client";

import { BirthChart } from "@/components/BirthChart";
import { toBirthChartData } from "@/lib/chartDataTransform";
import type { ChartInput } from "@/lib/chartDataTransform";
import type { WargaChartEntry, WargaChartKey } from "@/lib/wargaKendara";

import WargaHousesTable from "./WargaHousesTable";
import WargaIndicationTags from "./WargaIndicationTags";
import WargaPlanetsTable from "./WargaPlanetsTable";

interface WargaChartSectionProps {
    /** Warga key of this figure — drives the indication tags and the D1-only table columns. */
    chartKey: WargaChartKey;
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
}

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
}: WargaChartSectionProps) => {
    const isD1 = chartKey === "d1";

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
                    />
                </div>
            ) : (
                <div className="mt-2 bg-white rounded-lg border p-6 min-h-[300px] flex items-center justify-center">
                    <p className="text-sm text-gray-400">{noDataMessage}</p>
                </div>
            )}
            {entry ? (
                <>
                    <WargaHousesTable houses={entry.houses} caption={caption} />
                    <WargaPlanetsTable entry={entry} caption={caption} isD1={isD1} bhavaSuchika={bhavaSuchika} />
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
