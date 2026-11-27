"use client";

import TooltipChip from "@/components/aspects/TooltipChip";
import { useI18n } from "@/hooks/useI18n";

export interface MaitriChipProps {
    /** Chip label — the other planet's name. */
    label: string;
    /** Reason lines: the compound grade first, then the natural and temporary relationships. */
    lines: string[];
    /** Chip colour classes for the compound grade. */
    className: string;
}

/** Graha Maitri tag with the same hover/focus/tap tooltip as the conjunction and aspect chips. */
export default function MaitriChip({ label, lines, className }: MaitriChipProps) {
    const { locale } = useI18n();
    const title = lines.join("\n");
    return (
        <TooltipChip
            label={label}
            title={title}
            className={className}
            renderTooltip={(id) => (
                <div
                    id={id}
                    role="tooltip"
                    aria-label={title}
                    className={`pointer-events-none rounded-lg border bg-white shadow-lg z-50 px-3 py-2 text-left ${
                        locale === "si" ? "max-w-[320px]" : "max-w-[280px]"
                    }`}
                >
                    <div className="space-y-0.5">
                        {lines.map((line, index) => (
                            <div
                                key={line}
                                className={`text-xs leading-[1.5] ${
                                    index === 0 ? "font-medium text-gray-900" : "text-gray-700"
                                }`}
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        />
    );
}
