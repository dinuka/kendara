"use client";

import { useI18n } from "@/hooks/useI18n";

export default function CalculatedChartBadge() {
    const { t } = useI18n();
    return (
        <span className="inline-flex items-center text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5">
            {t("manualChart.calculatedChartBadge")}
        </span>
    );
}
