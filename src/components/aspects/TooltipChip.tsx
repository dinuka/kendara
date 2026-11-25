"use client";

import { useTooltipPosition } from "@/hooks/useTooltipPosition";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const CHIP_BASE_CLASS =
    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

export interface TooltipChipProps {
    /** Chip label. */
    label: ReactNode;
    /** Plain-text `title` fallback (no-JS/print). */
    title?: string;
    /** Chip colour classes, added to CHIP_BASE_CLASS. */
    className: string;
    /** Tooltip body, given the id it must carry; null → no tooltip. */
    renderTooltip: ((id: string) => ReactNode) | null;
}

/** A table chip anchoring a portaled tooltip. Hover (150ms delay) / focus / tap open it; `Esc`,
 *  blur, mouseleave or tap-outside close. Measured after mount so it sits right next to the chip. */
export default function TooltipChip({ label, title, className, renderTooltip }: TooltipChipProps) {
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
                title={title || undefined}
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
                        anchorRef.current?.focus();
                    }
                }}
                className={`${CHIP_BASE_CLASS} ${className}`}
            >
                {label}
            </button>
            {open &&
                renderTooltip &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed z-50"
                        role="presentation"
                        style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                    >
                        {renderTooltip(tooltipId)}
                    </div>,
                    document.body,
                )}
        </span>
    );
}
