"use client";

import { useI18n } from "@/hooks/useI18n";

interface StateBadgeProps {
    status: number;
}

const BADGE_STYLES: Record<number, string> = {
    1: "bg-slate-100 text-slate-700 border-slate-300",
    2: "bg-gray-200 text-gray-600 border-gray-400 line-through",
    3: "bg-amber-50 text-amber-700 border-amber-300",
};

const DOT_COLORS: Record<number, string> = {
    1: "bg-slate-400",
    2: "bg-gray-500",
    3: "bg-amber-500",
};

/** CancellationStatus badge (data-model §CancellationStatus): Not cancelled / Cancelled / Mitigated. */
const StateBadge = ({ status }: StateBadgeProps) => {
    const { t } = useI18n();

    return (
        <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border ${
                BADGE_STYLES[status] ?? "bg-gray-100 text-gray-500 border-dashed border-gray-400"
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status] ?? "bg-gray-400"}`} aria-hidden="true" />
            {t(`cancellationStatus.${status}`)}
        </span>
    );
};

export default StateBadge;
