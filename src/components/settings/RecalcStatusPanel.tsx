"use client";

import type { RecalcStatus } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";
import { useEffect, useRef, useState } from "react";

import { formatDate } from "@/lib/date";

interface RecalcStatusPanelProps {
    recalcStatus?: RecalcStatus;
    onStatusChange: (next: RecalcStatus) => void;
    onRunFull: () => void;
    onRetryFailed: (ids: string[]) => void;
}

/** Admin-only recalculation panel (US-SAS-004 UI). Polls GET /api/admin/astrology-settings/recalc
 *  every 3s while `status === "running"`; the interval is ref-guarded and cleared on unmount or
 *  completion. Offers Run full recalc always and Retry failed after a run with failures. */
export default function RecalcStatusPanel({
    recalcStatus,
    onStatusChange,
    onRunFull,
    onRetryFailed,
}: RecalcStatusPanelProps) {
    const { t } = useI18n();
    const [failedOpen, setFailedOpen] = useState(false);
    const status = recalcStatus?.status;

    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    useEffect(() => {
        if (status !== "running") return;
        let cancelled = false;
        const id = window.setInterval(() => {
            fetch("/api/admin/astrology-settings/recalc")
                .then((r) => r.json())
                .then((data) => {
                    if (!cancelled) onStatusChangeRef.current(data.recalcStatus as RecalcStatus);
                })
                .catch(() => {
                    // transient poll failure — keep polling on the next tick
                });
        }, 3000);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [status]);

    const total = recalcStatus?.total ?? 0;
    const processed = recalcStatus?.processed ?? 0;
    const succeeded = recalcStatus?.succeeded ?? 0;
    const failed = recalcStatus?.failed ?? 0;
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    const failedIds = recalcStatus?.failedHoroscopeIds ?? [];

    const counts = (
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
            <span>
                <span className="text-green-700 font-medium">{t("settings.recalc.succeeded")}</span> {succeeded}
            </span>
            <span>
                <span className="text-red-700 font-medium">{t("settings.recalc.failed")}</span> {failed}
            </span>
            {typeof recalcStatus?.settingsVersion === "number" && (
                <span>{t("settings.recalc.settingsVersion", { version: recalcStatus.settingsVersion })}</span>
            )}
        </div>
    );

    const failedList = (
        <div className="mt-3">
            <button
                type="button"
                aria-expanded={failedOpen}
                onClick={() => setFailedOpen((open) => !open)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
                {failedOpen
                    ? t("settings.recalc.hideFailed")
                    : t("settings.recalc.viewFailed", { count: failedIds.length })}
            </button>
            {failedOpen && (
                <div role="region" className="mt-2 border rounded bg-gray-50 max-h-40 overflow-y-auto p-2 space-y-0.5">
                    {failedIds.map((id) => (
                        <div key={id} className="font-mono text-xs text-gray-600">
                            {id}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div>
            <h2 className="text-lg font-semibold mb-3">{t("settings.recalc.title")}</h2>

            {!status ? (
                <div role="status">
                    <p className="text-sm text-gray-700">{t("settings.recalc.neverRun")}</p>
                    <p className="text-xs text-gray-500">{t("settings.recalc.neverRunHint")}</p>
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={onRunFull}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            {t("settings.recalc.runFull")}
                        </button>
                    </div>
                </div>
            ) : status === "running" ? (
                <div role="status" aria-live="polite">
                    <p className="text-sm text-gray-700">
                        <span className="font-medium">{t("settings.recalc.running")}</span>{" "}
                        {t("settings.recalc.processedOf", { processed, total })}
                    </p>
                    <div
                        role="progressbar"
                        aria-valuenow={processed}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuetext={t("settings.recalc.processedOf", { processed, total })}
                        className="mt-2 h-2 w-full bg-gray-200 rounded overflow-hidden"
                    >
                        <div
                            className="h-full bg-indigo-600 rounded transition-all duration-300"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {percent}% · {t("settings.recalc.updatesAutomatically")}
                    </p>
                    {counts}
                </div>
            ) : status === "failed" ? (
                <div role="alert">
                    <p className="text-sm text-red-600">
                        {t("settings.recalc.runFailed", { error: recalcStatus?.error ?? "" })}
                    </p>
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={onRunFull}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            {t("settings.recalc.retryFailed")}
                        </button>
                    </div>
                </div>
            ) : (
                <div role="status" aria-live="polite">
                    <p className="text-sm text-gray-700">
                        <span className="text-green-700 font-medium">✓</span> {t("settings.recalc.completed")}
                        {recalcStatus?.finishedAt && (
                            <span className="text-gray-500"> · {formatDate(recalcStatus.finishedAt)}</span>
                        )}
                    </p>
                    {counts}
                    {failed > 0 && failedIds.length > 0 && (
                        <>
                            {failedList}
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={() => onRetryFailed(failedIds)}
                                    className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {t("settings.recalc.retryFailed")}
                                </button>
                            </div>
                        </>
                    )}
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={onRunFull}
                            className="px-3 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-50"
                        >
                            {t("settings.recalc.runFull")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
