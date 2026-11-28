"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface TooltipPosition {
    top: number;
    left: number;
}

export interface UseTooltipPositionOptions {
    /** Vertical gap between the tooltip and the anchor tag (px). */
    gap?: number;
    /** Minimum side margin keeping the tooltip inside the viewport (px). */
    horizontalMargin?: number;
}

/** Shared positioning hook for the JS-anchored tooltips (AspectChip, SubaAsubaBadge, ShadBalaCell,
 *  PlanetChip). Coordinates come from `getBoundingClientRect` (viewport-relative); the caller portals
 *  the tooltip to `document.body` so no ancestor `transform`/`overflow`/stacking context can move or
 *  clip it. The tooltip is re-measured right after it mounts so it hugs the tag (`gap` px away)
 *  instead of floating at an estimated distance. `updatePosition` is exported for the open-window
 *  scroll/resize listeners. */
export function useTooltipPosition<T extends HTMLElement = HTMLElement>(
    open: boolean,
    options: UseTooltipPositionOptions = {},
): {
    anchorRef: RefObject<T | null>;
    tooltipRef: RefObject<HTMLDivElement | null>;
    position: TooltipPosition | null;
    updatePosition: () => void;
} {
    const { gap = 8, horizontalMargin = 160 } = options;
    const anchorRef = useRef<T | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<TooltipPosition | null>(null);

    const updatePosition = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const tipHeight = tooltipRef.current?.getBoundingClientRect().height ?? 0;
        let top = rect.top - tipHeight - gap;
        if (top < 8) top = rect.bottom + gap;
        let left = rect.left + rect.width / 2;
        left = Math.min(Math.max(left, horizontalMargin), window.innerWidth - horizontalMargin);
        setPosition((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    }, [gap, horizontalMargin]);

    // Runs after the tooltip commit, before paint: corrects the position using the real tooltip
    // height. Bailing out when the values are unchanged keeps the effect from re-triggering.
    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open, position, updatePosition]);

    return { anchorRef, tooltipRef, position, updatePosition };
}
