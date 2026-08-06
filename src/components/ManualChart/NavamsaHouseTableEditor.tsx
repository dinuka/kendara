"use client";

import PlanetPicker from "@/components/ManualChart/PlanetPicker";
import { planetColor, planetGlyph, signGlyph } from "@/components/ManualChart/visuals";
import { useI18n } from "@/hooks/useI18n";

import { Planet } from "@/lib/astrologyEnums";
import { deriveHouseSigns } from "@/lib/manualChart";

interface NavamsaHouseTableEditorProps {
    navamsaLagna: number;
    navamsaHouses: Record<number, number[]>;
    computedNavamsaHouseByPlanet?: Record<number, number>;
    onAdd: (house: number, planet: number) => void;
    onRemove: (house: number, planet: number) => void;
}

export default function NavamsaHouseTableEditor({
    navamsaLagna,
    navamsaHouses,
    computedNavamsaHouseByPlanet,
    onAdd,
    onRemove,
}: NavamsaHouseTableEditorProps) {
    const { t } = useI18n();
    const MAX_PLANETS_PER_HOUSE = 8;
    const houseSigns = deriveHouseSigns(navamsaLagna);

    const placed = new Set<number>();
    Object.values(navamsaHouses).forEach((planets) => planets.forEach((p) => placed.add(p)));
    const unplaced = Object.values(Planet).filter((v): v is number => typeof v === "number" && !placed.has(v));

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th scope="col" className="w-10">
                                {t("manualChart.colHouse")}
                            </th>
                            <th scope="col" className="w-24">
                                {t("manualChart.colSign")}
                            </th>
                            <th scope="col">{t("manualChart.colPlanets")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {houseSigns.map((sign, i) => {
                            const houseNumber = i + 1;
                            const rowPlanets = navamsaHouses[houseNumber] ?? [];
                            return (
                                <tr key={houseNumber} className="border-b border-gray-50 align-top">
                                    <td className="py-2 w-10 text-center font-medium">{houseNumber}</td>
                                    <td className="py-2 w-24 text-gray-600 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1">
                                            <span>{signGlyph(sign)}</span>
                                            <span className="text-xs text-gray-500">
                                                {t(`astrology.signNames.${sign}`)}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="py-2 pr-3">
                                        <div className="flex flex-wrap gap-1">
                                            {rowPlanets.map((planet) => {
                                                const computedHouse = computedNavamsaHouseByPlanet?.[planet];
                                                const differs =
                                                    computedHouse !== undefined && computedHouse !== houseNumber;
                                                return (
                                                    <span
                                                        key={planet}
                                                        title={
                                                            differs
                                                                ? t("manualChart.computedDiffers", {
                                                                      house: computedHouse,
                                                                  })
                                                                : undefined
                                                        }
                                                        className={`inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-xs ${
                                                            differs
                                                                ? "border-amber-400 bg-amber-50"
                                                                : "border-gray-200 bg-slate-50"
                                                        }`}
                                                    >
                                                        <span style={{ color: planetColor(planet) }}>
                                                            {planetGlyph(planet)}
                                                        </span>
                                                        {t(`astrology.planetNames.${planet}`)}
                                                        {differs && (
                                                            <span className="text-amber-600 font-semibold">•</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            aria-label={t("manualChart.removePlanet", {
                                                                planet: t(`astrology.planetNames.${planet}`),
                                                            })}
                                                            onClick={() => onRemove(houseNumber, planet)}
                                                            className="text-gray-400 hover:text-red-500 ml-0.5"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                            <PlanetPicker
                                                unplaced={unplaced}
                                                idPrefix={`nav-${houseNumber}`}
                                                disabled={rowPlanets.length >= MAX_PLANETS_PER_HOUSE}
                                                onSelect={(planet) => onAdd(houseNumber, planet)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
