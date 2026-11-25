"use client";

import { useI18n } from "@/hooks/useI18n";

import { composeAspectTooltip } from "@/lib/aspectTooltip";
import type { AspectTooltipTokens } from "@/lib/aspectTooltip";
import type { Aspect } from "@/lib/astrology";

import AspectTooltip from "./AspectTooltip";
import TooltipChip from "./TooltipChip";

export interface AspectChipProps {
    /** The planet-to-planet aspect record driving the tooltip reason lines. */
    aspect: Aspect;
    /** Chip label — the aspecting planet only (glyph + localized name, no angle/delta). */
    planetLabel: string;
    /** Whole-sign the aspecting planet occupies — the `{aspectingSign}` of rashi reason lines. */
    aspectingSign?: number;
    /** False on whole-sign charts (D9/D3/D30): the tooltip omits the (always zero) delta. */
    showDelta?: boolean;
}

/** Planets/houses table aspect chip — planet name only (UX §8.1), anchoring the compact
 *  reason-line `AspectTooltip` (single-reason keeps the inline delta; multi-reason shows one line
 *  per reason + a shared `Δ {delta}` footer). Hover (150ms delay) / focus / tap open it; `Esc`,
 *  blur, mouseleave or tap-outside close. The `title` fallback carries the same full text (delta
 *  exactly once) for no-JS/print. The tooltip is portaled to `document.body` and measured after
 *  mount so it sits right next to the tag. */
export default function AspectChip({ aspect, planetLabel, aspectingSign, showDelta = true }: AspectChipProps) {
    const { t, locale } = useI18n();
    const tokens: AspectTooltipTokens = {
        label: t("astrology.drishti.label"),
        rashiLabel: t("astrology.drishti.rashiLabel"),
        kendraLabel: t("astrology.drishti.kendraLabel"),
        arrow: t("astrology.drishti.arrow"),
        getSignName: (sign) => t(`astrology.signNames.${sign}`),
    };
    const { lines, single, delta, title } = composeAspectTooltip(tokens, { aspect, aspectingSign, showDelta });

    return (
        <TooltipChip
            label={planetLabel}
            title={title}
            className="border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
            renderTooltip={
                lines.length > 0
                    ? (id) => (
                          <AspectTooltip
                              id={id}
                              lines={lines}
                              single={single}
                              delta={delta}
                              title={title}
                              rashiVerbAria={t("astrology.drishti.rashiVerbAria")}
                              isSinhala={locale === "si"}
                          />
                      )
                    : null
            }
        />
    );
}
