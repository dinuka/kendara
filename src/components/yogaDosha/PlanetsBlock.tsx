"use client";

import { useI18n } from "@/hooks/useI18n";

import { PlanetReasonShare, YogaDoshaEvaluation, planetReasonShares } from "@/lib/yogaDosha";

interface PlanetsBlockProps {
    entry: YogaDoshaEvaluation;
}

const NEUTRAL_CLASS = "border-gray-300 bg-white text-gray-800";

/** Yoga planets go green, dosha planets red: light past a quarter of the reasons, dark past half. */
const SHARE_CLASS: Record<"yoga" | "dosha", Record<PlanetReasonShare, string>> = {
    yoga: {
        [PlanetReasonShare.MINOR]: NEUTRAL_CLASS,
        [PlanetReasonShare.MAJOR]: "border-green-400 bg-green-100 text-green-900",
        [PlanetReasonShare.DOMINANT]: "border-green-800 bg-green-600 text-white",
    },
    dosha: {
        [PlanetReasonShare.MINOR]: NEUTRAL_CLASS,
        [PlanetReasonShare.MAJOR]: "border-red-400 bg-red-100 text-red-900",
        [PlanetReasonShare.DOMINANT]: "border-red-800 bg-red-600 text-white",
    },
};

/** "Planets" — every planet that forms the yoga/dosha in this chart (formation.planets), shaded by
 *  the share of "why it forms" reasons it takes part in. */
const PlanetsBlock = ({ entry }: PlanetsBlockProps) => {
    const { t } = useI18n();
    const { planets } = entry.formation;

    if (!planets?.length) return null;

    const shares = planetReasonShares(entry.formation);

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">{t("yogaDosha.planets")}</h5>
            <ul className="mt-1 flex flex-wrap gap-1.5">
                {planets.map((planet) => {
                    const share = shares.get(planet) ?? PlanetReasonShare.MINOR;
                    return (
                        <li
                            key={planet}
                            data-share={share}
                            className={`rounded border px-1.5 py-0.5 text-xs font-medium ${SHARE_CLASS[entry.kind][share]}`}
                        >
                            {t(`astrology.planetNames.${planet}`)}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default PlanetsBlock;
