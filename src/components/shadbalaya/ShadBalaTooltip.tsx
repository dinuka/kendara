"use client";

export interface ShadBalaTooltipProps {
    id: string;
    /** Localized bala name heading (`astrology.shadbalaya.balaNames.{bala}`). */
    heading: string;
    /** `✓ Checked because:` / `✗ Unchecked because:`. */
    stateLine: string;
    /** One localized reason line per stored reason (empty stored reasons → generic manual line). */
    lines: string[];
    /** Override footer — present only when the bala was set manually. */
    overrideFooter?: string;
    /** Full plain text for the tooltip's aria-label fallback. */
    title: string;
    /** `si` renders a slightly wider tooltip (Sinhala is ~15–20% wider). */
    isSinhala: boolean;
}

/** Shad Bala cell reason tooltip (UX §7). Positioned by ShadBalaTable via out-of-flow fixed
 *  coordinates, mirroring AspectTooltip. */
export default function ShadBalaTooltip({
    id,
    heading,
    stateLine,
    lines,
    overrideFooter,
    title,
    isSinhala,
}: ShadBalaTooltipProps) {
    return (
        <div
            id={id}
            role="tooltip"
            aria-label={title}
            className={`pointer-events-none rounded-lg border bg-white shadow-lg z-50 px-3 py-2 text-left ${
                isSinhala ? "max-w-[320px]" : "max-w-[280px]"
            }`}
        >
            <div className="text-[13px] font-bold text-gray-800 leading-[1.5]">{heading}</div>
            <div className="text-xs text-gray-600 leading-[1.5]">{stateLine}</div>
            <div className="space-y-0.5">
                {lines.map((line) => (
                    <div key={line} className="text-xs text-gray-700 leading-[1.5]">
                        · {line}
                    </div>
                ))}
            </div>
            {overrideFooter && (
                <div className="mt-1 pt-1 border-t border-gray-200 text-xs text-indigo-600 leading-[1.5]">
                    {overrideFooter}
                </div>
            )}
        </div>
    );
}
