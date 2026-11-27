"use client";

import { useI18n } from "@/hooks/useI18n";
import { useId } from "react";

/** Small info glyph with a hover/focus tooltip (mirrors BhavaSuchikaTag's tooltip pattern). */
const InfoGlyph = () => {
    const { t } = useI18n();
    const tooltipId = useId();
    const tooltipText = t("yogaDosha.infoGlyph");

    return (
        <span className="relative inline-flex ml-1 align-middle group">
            <button
                type="button"
                title={tooltipText}
                aria-describedby={`yoga-dosha-info-${tooltipId}`}
                className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] leading-none text-gray-500 bg-gray-200 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label={tooltipText}
            >
                i
            </button>
            <span
                id={`yoga-dosha-info-${tooltipId}`}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 rounded bg-gray-900 text-white text-[11px] leading-snug px-2 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {tooltipText}
            </span>
        </span>
    );
};

export default InfoGlyph;
