"use client";

import { useTooltipPosition } from "@/hooks/useTooltipPosition";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { createPortal } from "react-dom";

interface DashaNumberChipProps {
    value: number;
    /** Tooltip reason lines — the first line is emphasised when there is more than one. */
    lines: string[];
}

interface DashaNumberTooltipProps {
    anchor: RefObject<HTMLSpanElement | null>;
    id: string;
    lines: string[];
}

/** The portalled tooltip. Kept in its own component so the positioning hook and the scroll/resize
 *  listeners only exist while a tooltip is open, not once per chip in the dasha tree. */
const DashaNumberTooltip = ({ anchor, id, lines }: DashaNumberTooltipProps) => {
    const { anchorRef, tooltipRef, position, updatePosition } = useTooltipPosition<HTMLSpanElement>(true);

    useLayoutEffect(() => {
        anchorRef.current = anchor.current;
        updatePosition();
    }, [anchor, anchorRef, updatePosition]);

    useEffect(() => {
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [updatePosition]);

    if (!position) return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className="fixed z-50"
            role="presentation"
            style={{
                top: position.top,
                left: position.left,
                transform: "translateX(-50%)",
            }}
        >
            <div
                id={id}
                role="tooltip"
                className="pointer-events-none rounded-lg border bg-white shadow-lg z-50 px-3 py-2 text-left max-w-[320px]"
            >
                <div className="space-y-0.5">
                    {lines.map((line, index) => (
                        <div
                            key={line}
                            className={`text-xs leading-[1.5] ${
                                lines.length > 1 && index === 0 ? "font-semibold text-gray-800" : "text-gray-700"
                            }`}
                        >
                            {line}
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
};

/** A dasha label number tag with the same JS-anchored tooltip behaviour as `AspectChip`: hover
 *  (150ms delay) / focus / tap open it; `Esc`, blur, mouseleave or tap again close. The chip sits
 *  inside the accordion header, so clicks and Enter/Space are stopped from toggling the row. */
const DashaNumberChip = ({ value, lines }: DashaNumberChipProps) => {
    const [open, setOpen] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const anchorRef = useRef<HTMLSpanElement | null>(null);
    const tooltipId = useId();

    const closeTooltip = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setOpen(false);
    };

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        if (open) {
            closeTooltip();
        } else {
            setOpen(true);
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            closeTooltip();
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            if (open) {
                closeTooltip();
            } else {
                setOpen(true);
            }
        }
    };

    return (
        <>
            <span
                ref={anchorRef}
                role="button"
                tabIndex={0}
                aria-label={lines.join(" — ")}
                aria-describedby={open ? tooltipId : undefined}
                onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => setOpen(true), 150);
                }}
                onMouseLeave={closeTooltip}
                onFocus={() => setOpen(true)}
                onBlur={closeTooltip}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className="inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded border border-gray-200 bg-white text-[10px] font-medium text-gray-700 cursor-default hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {value}
            </span>
            {open && typeof document !== "undefined" && (
                <DashaNumberTooltip anchor={anchorRef} id={tooltipId} lines={lines} />
            )}
        </>
    );
};

export default DashaNumberChip;
