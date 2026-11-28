"use client";

import { useI18n } from "@/hooks/useI18n";
import { useId } from "react";

interface BhavaSuchikaTagProps {
    /** House index 1-12 — callers must validate the value before rendering. */
    value: number;
}

/** Indigo pill showing a Bhava Suchika (භාව සුචික) house-index value with a hover/focus tooltip.
 *  The tooltip text is duplicated in the `title` attribute so keyboard and assistive-tech users get
 *  the same explanation without JavaScript. */
const BhavaSuchikaTag = ({ value }: BhavaSuchikaTagProps) => {
    const { t } = useI18n();
    const tooltipId = useId();
    const tooltipText = t("astrology.bhavaSuchika.tooltip");

    return (
        <span className="relative inline-flex group">
            <button
                type="button"
                title={tooltipText}
                aria-describedby={`bhava-suchika-tooltip-${tooltipId}`}
                className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border text-indigo-700 bg-indigo-50 border-indigo-200 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
                {t("astrology.bhavaSuchika.label")}: {value} — {t(`astrology.bhavaSuchika.names.${value}`)}
            </button>
            <span
                id={`bhava-suchika-tooltip-${tooltipId}`}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-900 text-white text-[11px] leading-snug px-2 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {tooltipText}
            </span>
        </span>
    );
};

export default BhavaSuchikaTag;
