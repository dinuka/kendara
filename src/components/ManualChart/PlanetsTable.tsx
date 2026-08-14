"use client";

import { planetColor, planetGlyph, signGlyph } from "@/components/ManualChart/visuals";
import { useI18n } from "@/hooks/useI18n";

import { PlanetaryStrength } from "@/lib/astrologyEnums";
import type { ManualChartResult, ManualPlanetRow, NavamsaEnrichment } from "@/lib/manualChart";
import { formatNavamsaDegreeRange } from "@/lib/manualChart";

interface PlanetsTableProps {
    result: ManualChartResult;
}

const STRENGTH_KEYS: Record<PlanetaryStrength, string> = {
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

const OTHER_KEYS: Record<string, string> = {
    lord22ndDrekkana: "lord22ndDrekkana",
    lord64thNavamsa: "lord64thNavamsa",
    atmakaraka: "atmakaraka",
    maranakaraka: "maranakaraka",
    yogakaraka: "yogakaraka",
};

export default function PlanetsTable({ result }: PlanetsTableProps) {
    const { t } = useI18n();

    if (result.planetsTable.length === 0) {
        return (
            <section className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                    {t("manualChart.planetsTableTitle")}
                </h3>
                <p className="text-sm text-gray-400">{t("manualChart.placePlanetsFirst")}</p>
            </section>
        );
    }

    const enrichmentByPlanet = new Map<number, NavamsaEnrichment>();
    result.navamsaEnrichment.forEach((e) => enrichmentByPlanet.set(e.planet, e));

    return (
        <section className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                {t("manualChart.planetsTableTitle")}
            </h3>
            <div className="w-full">
                <table className="w-full table-fixed text-sm" aria-label={t("manualChart.planetsTableTitle")}>
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colPlanet")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colSign")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colStrength")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colHouse")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colConjunctions")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colAspects")}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                                {t("manualChart.colOther")}
                            </th>
                            {result.navamsaEnrichment.length > 0 && (
                                <>
                                    <th scope="col" className="py-1 pr-3">
                                        {t("manualChart.colNavamsa")}
                                    </th>
                                    <th scope="col" className="py-1 pr-3">
                                        {t("manualChart.colNavamsaStrength")}
                                    </th>
                                    <th scope="col" className="py-1 pr-3">
                                        {t("manualChart.colDegreeRange")}
                                    </th>
                                    <th scope="col" className="py-1 pr-3">
                                        {t("manualChart.colNakshatraPada")}
                                    </th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {result.planetsTable.map((row) => (
                            <Row key={row.planet} row={row} enrichment={enrichmentByPlanet.get(row.planet)} />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function Row({ row, enrichment }: { row: ManualPlanetRow; enrichment?: NavamsaEnrichment }) {
    const { t } = useI18n();
    return (
        <tr className="border-b border-gray-50">
            <td className="py-1 pr-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                    <span style={{ color: planetColor(row.planet) }}>{planetGlyph(row.planet)}</span>
                    {t(`astrology.planetNames.${row.planet}`)}
                </span>
            </td>
            <td className="py-1 pr-3 text-gray-600">
                {signGlyph(row.sign)} {t(`astrology.signNames.${row.sign}`)}
            </td>
            <td className="py-1 pr-3">{t(`astrology.${STRENGTH_KEYS[row.strength]}`)}</td>
            <td className="py-1 pr-3 text-gray-600">{row.house}</td>
            <td className="py-1 pr-3 text-gray-600">
                {row.conjunctions.length > 0
                    ? row.conjunctions.map((p) => `${planetGlyph(p)} ${t(`astrology.planetNames.${p}`)}`).join(", ")
                    : "—"}
            </td>
            <td className="py-1 pr-3 text-gray-600">
                {row.aspectsPlanets.length > 0
                    ? row.aspectsPlanets.map((p) => `${planetGlyph(p)} ${t(`astrology.planetNames.${p}`)}`).join(", ")
                    : "—"}
            </td>
            <td className="py-1 pr-3 text-gray-600">
                {row.other.length > 0 ? row.other.map((k) => t(`manualChart.${OTHER_KEYS[k] ?? k}`)).join(", ") : "—"}
            </td>
            {enrichment ? (
                <>
                    <td className="py-1 pr-3 text-gray-600">
                        {signGlyph(enrichment.navamsaSign)} {t(`astrology.signNames.${enrichment.navamsaSign}`)}
                    </td>
                    <td className="py-1 pr-3">{t(`astrology.${STRENGTH_KEYS[enrichment.navamsaStrength]}`)}</td>
                    <td className="py-1 pr-3 text-gray-600">
                        {formatNavamsaDegreeRange(enrichment.degreeRangeStart, enrichment.degreeRangeEnd)}
                    </td>
                    <td className="py-1 pr-3 text-gray-600">
                        {t(`astrology.nakshatraNames.${enrichment.nakshatra}`)} (
                        {t("astrology.padaFormat", { pada: String(enrichment.pada) })})
                    </td>
                </>
            ) : (
                <>
                    <td className="py-1 pr-3 text-gray-400">—</td>
                    <td className="py-1 pr-3 text-gray-400">—</td>
                    <td className="py-1 pr-3 text-gray-400">—</td>
                    <td className="py-1 pr-3 text-gray-400">—</td>
                </>
            )}
        </tr>
    );
}
