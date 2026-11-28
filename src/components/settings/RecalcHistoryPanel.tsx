"use client";

import type { RecalcRunEntry } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";
import { useState } from "react";

import { formatDate } from "@/lib/date";

interface RecalcHistoryPanelProps {
    runs?: RecalcRunEntry[];
}

/** Default-collapsed recalculation run history (US-SAS-011). Capped at 20 runs server-side; newest
 *  first here. Each run shows version, trigger, started→finished window, counts, and an expandable
 *  failed-id list when the run had failures. */
export default function RecalcHistoryPanel({ runs }: RecalcHistoryPanelProps) {
    const { t } = useI18n();
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const list = runs ? [...runs].reverse() : [];

    const toggleExpanded = (id: string) => {
        setExpandedRuns((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <details className="group border-t border-gray-200 pt-4">
            <summary className="cursor-pointer flex items-center justify-between gap-2 text-sm font-medium text-gray-700 select-none">
                <span>
                    <span aria-hidden="true" className="mr-2 text-gray-400 transition-transform group-open:rotate-90">
                        ▸
                    </span>
                    {t("settings.history.title")}
                </span>
                {list.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{list.length}</span>
                )}
            </summary>
            <div className="mt-3 space-y-2">
                {list.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("settings.history.empty")}</p>
                ) : (
                    list.map((run) => {
                        const expanded = expandedRuns.has(run.id);
                        const failedIds = run.failedHoroscopeIds ?? [];
                        return (
                            <div key={run.id} className="border rounded p-3 text-xs">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono">
                                        {t("settings.history.settingsVersion", { version: run.settingsVersion })}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {run.triggeredBy.name || run.triggeredBy.id.slice(-6)}
                                    </span>
                                    <span className="text-gray-500">
                                        {formatDate(run.startedAt)}
                                        {run.finishedAt && ` → ${formatDate(run.finishedAt)}`}
                                    </span>
                                    <span className="text-gray-500 ml-auto">
                                        {t("settings.recalc.total", { total: run.total })} ·{" "}
                                        <span className="text-green-700">{run.succeeded}</span> /{" "}
                                        <span className="text-red-700">{run.failed}</span>
                                    </span>
                                    {failedIds.length > 0 && (
                                        <button
                                            type="button"
                                            aria-expanded={expanded}
                                            onClick={() => toggleExpanded(run.id)}
                                            className="text-indigo-600 hover:text-indigo-800 underline"
                                        >
                                            {expanded
                                                ? t("settings.recalc.hideFailed")
                                                : t("settings.recalc.viewFailed", { count: failedIds.length })}
                                        </button>
                                    )}
                                </div>
                                {expanded && (
                                    <div className="mt-2 border rounded bg-gray-50 max-h-40 overflow-y-auto p-2 space-y-0.5">
                                        {failedIds.map((id) => (
                                            <div key={id} className="font-mono text-gray-600">
                                                {id}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </details>
    );
}
