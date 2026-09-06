"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** One selectable swatch of the color picker. `value` is the stored color (an `ObservationColor`
 *  string for system tags, a numeric `TagColor` for student tags) — the component is type-agnostic. */
export interface TagColorSwatch {
    value: string | number;
    className: string;
    label: string;
}

/** Optional secondary action rendered below the swatches (e.g. the "not relevant" toggle for
 *  system observation tags). Kept type-agnostic so the same popover serves system and student tags. */
export interface TagColorPickerFooter {
    label: string;
    active: boolean;
    onPress: () => void;
}

interface TagColorPickerProps {
    swatches: TagColorSwatch[];
    /** The currently applied color of the tag being edited (highlighted, aria-checked). */
    current: string | number;
    /** The trigger element the popover anchors to (positioned just below it). */
    anchor: HTMLElement;
    onPick: (value: string | number) => void;
    onClose: () => void;
    /** Renders a toggle row under the swatches (not-available tags pass none). */
    footer?: TagColorPickerFooter | null;
}

/** Small swatch popover for changing a tag's color and, for system observation tags, marking it
 *  "not relevant" (TODO #26). Rendered `fixed`, anchored just below the clicked tag and clamped to
 *  the viewport; clicking a swatch picks it, clicking the backdrop or pressing Escape closes. */
const TagColorPicker = ({ swatches, current, anchor, onPick, onClose, footer }: TagColorPickerProps) => {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    useLayoutEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const rect = anchor.getBoundingClientRect();
        const panel = el.getBoundingClientRect();
        const left = Math.max(4, Math.min(rect.left, window.innerWidth - panel.width - 4));
        let top = rect.bottom + 4;
        if (top + panel.height > window.innerHeight - 4) top = Math.max(4, rect.top - panel.height - 4);
        setPosition({ top, left });
    }, [anchor]);

    useLayoutEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);

    return (
        <>
            <div className="fixed inset-0 z-40" role="presentation" onClick={onClose} />
            <div
                ref={panelRef}
                className="fixed z-50 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                style={{ top: position.top, left: position.left }}
            >
                <div role="radiogroup" aria-label="Tag color" className="flex items-center gap-1">
                    {swatches.map((swatch) => (
                        <button
                            key={String(swatch.value)}
                            type="button"
                            role="radio"
                            aria-checked={swatch.value === current}
                            aria-label={swatch.label}
                            title={swatch.label}
                            onClick={() => onPick(swatch.value)}
                            className={`w-5 h-5 rounded-full border border-gray-300 ${swatch.className} ${
                                swatch.value === current ? "ring-2 ring-indigo-500" : ""
                            }`}
                        />
                    ))}
                </div>
                {footer && (
                    <button
                        type="button"
                        aria-pressed={footer.active}
                        onClick={footer.onPress}
                        className={`mt-1 block w-full rounded px-2 py-1 text-left text-xs border-t border-gray-100 ${
                            footer.active ? "line-through text-gray-500 bg-gray-50" : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                        {footer.label}
                    </button>
                )}
            </div>
        </>
    );
};

export default TagColorPicker;
