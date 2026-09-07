"use client";

import { useI18n } from "@/hooks/useI18n";
import { CancellationStatus } from "@/lib/astrologyEnums";
import { doshaCatalogEntry, YogaDoshaEvaluation, yogaCatalogEntry } from "@/lib/yogaDosha";

interface YogaDoshaTagProps {
    entry: YogaDoshaEvaluation;
    open: boolean;
    onToggle: () => void;
}

const isKnownId = (entry: YogaDoshaEvaluation): boolean => {
    if (entry.kind === "yoga") return yogaCatalogEntry(entry.id) !== undefined;
    return doshaCatalogEntry(entry.id) !== undefined;
};

/** A single yoga/dosha tag chip (button). Unknown entries render as a dashed, gray, non-button
 *  (not actionable, US-YD-011). Only present entries reach this component. */
const YogaDoshaTag = ({ entry, open, onToggle }: YogaDoshaTagProps) => {
    const { t } = useI18n();

    const known = isKnownId(entry);
    const strength = t(`yogaStrength.${entry.finalAssessment.severity}`);
    const status = t(`cancellationStatus.${entry.cancellation.status}`);
    const name = known ? t(`${entry.kind}.${entry.id}.name`) : t("yogaDosha.unknownName");
    const isCancelled = entry.cancellation.status === CancellationStatus.CANCELLED;
    const isDosha = entry.kind === "dosha";
    // Dosha emphasis (user direction): a present dosha is a red tag; a cancelled dosha goes gray.
    // Yogas keep the neutral chip with an indigo hover.
    const chipClass = isCancelled
        ? "line-through text-gray-500 bg-gray-100 border-gray-300"
        : isDosha
          ? "bg-red-50 text-red-700 border-red-300 hover:border-red-500 hover:text-red-800"
          : "text-gray-800 bg-white border-gray-300 hover:border-indigo-400 hover:text-indigo-700";
    const dotClass = isCancelled
        ? "bg-gray-500"
        : isDosha
          ? "bg-red-600"
          : entry.cancellation.status === CancellationStatus.MITIGATED
            ? "bg-amber-500"
            : "bg-slate-400";
    const ringClass = isDosha ? "focus-visible:ring-red-400" : "focus-visible:ring-indigo-400";

    const label = known
        ? `${name}, ${strength}, ${status}`
        : // AX-YD-605: unknown chips keep the raw id in their accessible name.
          `${entry.id}, ${name}`;

    if (!known) {
        return (
            <span
                className="inline-flex items-center gap-1.5 rounded border border-dashed border-gray-400 bg-gray-50 px-2 py-1 text-xs text-gray-500"
                aria-label={label}
                title={label}
            >
                {name}
            </span>
        );
    }

    return (
        <button
            type="button"
            aria-expanded={open}
            aria-controls={`${entry.kind}-${entry.id}-panel`}
            aria-label={label}
            onClick={onToggle}
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 ${ringClass} ${chipClass}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
            {name}
        </button>
    );
};

export default YogaDoshaTag;