"use client";

export interface AspectTooltipProps {
    id: string;
    /** Reason lines (single-reason tools already carry the inline delta). */
    lines: string[];
    /** When false (≥2 reasons) a hairline-separated `Δ {delta}` footer is appended once. */
    single: boolean;
    /** Signed, zero-padded `d:mm:ss` delta — rendered exactly once. */
    delta: string;
    /** Full plain text for the tooltip's aria-label fallback (delta exactly once). */
    title: string;
    /** t(`astrology.drishti.rashiVerbAria`) — sr-only expansion of the `→` arrow. */
    rashiVerbAria: string;
    /** `theme`/Surface marker: `si` renders a slightly wider tooltip (Sinhala is ~15–20% wider). */
    isSinhala: boolean;
}

/** Compact reason-line tooltip (UX §8.1.1). One line per distinct reason; a single reason keeps the
 *  signed delta inline, ≥2 reasons hoist it to one shared `Δ {delta}` footer (hairline-separated) so
 *  it is announced exactly once. Positioned by `AspectChip` via-out-of-flow fixed coordinates. */
export default function AspectTooltip({
    id,
    lines,
    single,
    delta,
    title,
    rashiVerbAria,
    isSinhala,
}: AspectTooltipProps) {
    return (
        <div
            id={id}
            role="tooltip"
            aria-label={title}
            className={`pointer-events-none rounded-lg border bg-white shadow-lg z-50 px-3 py-2 text-left ${
                isSinhala ? "max-w-[320px]" : "max-w-[280px]"
            }`}
        >
            <span className="sr-only">{rashiVerbAria}</span>
            <div className="space-y-0.5">
                {lines.map((line) => (
                    <div key={line} className="text-xs text-gray-700 leading-[1.5]">
                        {line}
                    </div>
                ))}
                {!single && (
                    <div className="mt-1 pt-1 border-t border-gray-200 text-xs text-gray-500 leading-[1.5]">
                        {`Δ ${delta}`}
                    </div>
                )}
            </div>
        </div>
    );
}
