"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useId, useRef, useState } from "react";

import { composeAspectTooltip } from "@/lib/aspectTooltip";
import type { AspectTooltipTokens } from "@/lib/aspectTooltip";
import type { Aspect } from "@/lib/astrology";

import AspectTooltip from "./AspectTooltip";

export interface AspectChipProps {
    /** The planet-to-planet aspect record driving the tooltip reason lines. */
    aspect: Aspect;
    /** Chip label — the aspecting planet only (glyph + localized name, no angle/delta). */
    planetLabel: string;
    /** Whole-sign the aspecting planet occupies — the `{aspectingSign}` of rashi reason lines. */
    aspectingSign?: number;
    /** Aspected row house (houses table) — overrides the relative-house derivation. */
    house?: number;
}

interface TooltipPosition {
    top: number;
    left: number;
}

/** Planets/houses table aspect chip — planet name only (UX §8.1), anchoring the compact
 *  reason-line `AspectTooltip` (single-reason keeps the inline delta; multi-reason shows one line
 *  per reason + a shared `Δ {delta}` footer). Hover (150ms delay) / focus / tap open it; `Esc`,
 *  blur, mouseleave or tap-outside close. The `title` fallback carries the same full text (delta
 *  exactly once) for no-JS/print. */
export default function AspectChip({ aspect, planetLabel, aspectingSign, house }: AspectChipProps) {
    const { t, locale } = useI18n();
    const tokens: AspectTooltipTokens = {
        label: t("astrology.drishti.label"),
        rashiLabel: t("astrology.drishti.rashiLabel"),
        arrow: t("astrology.drishti.arrow"),
        getSignName: (sign) => t(`astrology.signNames.${sign}`),
    };
    const { lines, single, delta, title } = composeAspectTooltip(tokens, { aspect, aspectingSign, house });

    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<TooltipPosition | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const tooltipId = useId();

    const updatePosition = () => {
        const el = buttonRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const GAP = 8;
        const ESTIMATED_HEIGHT = 96;
        let top = rect.top - ESTIMATED_HEIGHT - GAP;
        if (top < 8) top = rect.bottom + GAP;
        let left = rect.left + rect.width / 2;
        left = Math.min(Math.max(left, 160), window.innerWidth - 160);
        setPosition({ top, left });
    };

    const openTooltip = () => {
        updatePosition();
        setOpen(true);
    };
    const closeTooltip = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    return (
        <span className="inline-flex">
            <button
                ref={buttonRef}
                type="button"
                aria-describedby={open ? tooltipId : undefined}
                title={title}
                onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(openTooltip, 150);
                }}
                onMouseLeave={closeTooltip}
                onFocus={openTooltip}
                onBlur={closeTooltip}
                onClick={() => (open ? closeTooltip() : openTooltip())}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        closeTooltip();
                        buttonRef.current?.focus();
                    }
                }}
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {planetLabel}
            </button>
            {open && position && (
                <span
                    className="fixed"
                    role="presentation"
                    style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                >
                    <AspectTooltip
                        id={tooltipId}
                        lines={lines}
                        single={single}
                        delta={delta}
                        title={title}
                        rashiVerbAria={t("astrology.drishti.rashiVerbAria")}
                        isSinhala={locale === "si"}
                    />
                </span>
            )}
        </span>
    );
}
