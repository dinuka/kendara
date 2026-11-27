"use client";

export interface SubaAsubaTooltipProps {
    id: string;
    /** Localized verdict heading ("Suba"/"Asuba"). */
    heading: string;
    /** `Suba because:` / `Asuba because:` state line. */
    stateLine: string;
    /** One localized reason line per stored reason. */
    lines: string[];
    /** Full plain text for the tooltip's aria-label fallback. */
    title: string;
    /** `si` renders a slightly wider tooltip (Sinhala is ~15–20% wider). */
    isSinhala: boolean;
}

/** Suba/Asuba cell reason tooltip. Positioned by SubaAsubaBadge via out-of-flow fixed coordinates,
 *  mirroring AspectTooltip and ShadBalaTooltip (UX §8.1.1). */
const SubaAsubaTooltip = ({ id, heading, stateLine, lines, title, isSinhala }: SubaAsubaTooltipProps) => {
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
        </div>
    );
};

export default SubaAsubaTooltip;
