"use client";

import { useI18n } from "@/hooks/useI18n";
import { useTooltipPosition } from "@/hooks/useTooltipPosition";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SubaAsuba, type SubaAsubaEntry } from "@/lib/subaAsuba";
import { type SubaAsubaTooltipTokens, composeSubaAsubaTooltip } from "@/lib/subaAsubaTooltip";

import SubaAsubaTooltip from "./SubaAsubaTooltip";

interface SubaAsubaBadgeProps {
    /** Numeric Planet enum value (1-9). */
    planet: number;
    entry: SubaAsubaEntry;
    getPlanetName: (planet: number) => string;
}

/** Green (Suba) / red (Asuba) pill showing a planet's Suba Asuba verdict, anchoring the fixed-position
 *  reason tooltip mirroring AspectChip/ShadBalaCell: hover (150ms delay) / focus / tap open it; `Esc`,
 *  blur, mouseleave or tap-outside close. The `title` fallback carries the same full text for
 *  no-JS/print. The tooltip is portaled to `document.body` and measured after mount so it sits right
 *  next to the pill. */
const SubaAsubaBadge = ({ planet, entry, getPlanetName }: SubaAsubaBadgeProps) => {
    const { t, locale } = useI18n();
    const tokens: SubaAsubaTooltipTokens = { t, getPlanetName };
    const tooltip = composeSubaAsubaTooltip(tokens, planet, entry);
    const suba = entry.value === SubaAsuba.SUBA;
    const chipClass = suba ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200";

    const [open, setOpen] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipId = useId();
    const { anchorRef, tooltipRef, position, updatePosition } = useTooltipPosition<HTMLButtonElement>(open);

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
    }, [open, updatePosition]);

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    return (
        <span className="inline-flex">
            <button
                ref={anchorRef}
                type="button"
                aria-describedby={open ? tooltipId : undefined}
                title={tooltip.title}
                onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(openTooltip, 150);
                }}
                onMouseLeave={closeTooltip}
                onFocus={openTooltip}
                onBlur={closeTooltip}
                onClick={(event) => {
                    event.stopPropagation();
                    if (open) closeTooltip();
                    else openTooltip();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        closeTooltip();
                        anchorRef.current?.focus();
                    }
                }}
                className={`inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${chipClass}`}
            >
                {t(suba ? "astrology.papiGrahayan.suba" : "astrology.papiGrahayan.asuba")}
            </button>
            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed z-50"
                        role="presentation"
                        style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                    >
                        <SubaAsubaTooltip
                            id={tooltipId}
                            heading={tooltip.heading}
                            stateLine={tooltip.stateLine}
                            lines={tooltip.lines}
                            title={tooltip.title}
                            isSinhala={locale === "si"}
                        />
                    </div>,
                    document.body,
                )}
        </span>
    );
};

export default SubaAsubaBadge;
