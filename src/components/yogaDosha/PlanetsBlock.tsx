"use client";

import { useI18n } from "@/hooks/useI18n";

import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface PlanetsBlockProps {
    entry: YogaDoshaEvaluation;
}

/** "Planets" — every planet that forms the yoga/dosha in this chart (formation.planets). */
const PlanetsBlock = ({ entry }: PlanetsBlockProps) => {
    const { t } = useI18n();
    const { planets } = entry.formation;

    if (!planets?.length) return null;

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">{t("yogaDosha.planets")}</h5>
            <ul className="mt-1 flex flex-wrap gap-1.5">
                {planets.map((planet) => (
                    <li
                        key={planet}
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-800"
                    >
                        {t(`astrology.planetNames.${planet}`)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PlanetsBlock;
