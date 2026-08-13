"use client";

import { useI18n } from "@/hooks/useI18n";

import { formatDate } from "@/lib/date";

export interface SettingsMetadataDoc {
    version?: number;
    updatedBy?: { id: string; name?: string };
    updatedAt?: string;
    lastRecalculatedAt?: string;
}

export default function SettingsMetadataStrip({ doc }: { doc: SettingsMetadataDoc }) {
    const { t } = useI18n();
    const updatedByLabel = doc.updatedBy ? doc.updatedBy.name || doc.updatedBy.id.slice(-6) : null;
    const updatedAtLabel = doc.updatedAt ? formatDate(doc.updatedAt) : null;
    const recalculatedLabel = doc.lastRecalculatedAt ? formatDate(doc.lastRecalculatedAt) : null;

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>
                {t("settings.system.version")}{" "}
                <span className="font-mono font-medium text-gray-700">{doc.version ?? 1}</span>
            </span>
            {updatedByLabel && (
                <>
                    <span aria-hidden="true">·</span>
                    <span>
                        {t("settings.system.updatedBy")}{" "}
                        <span className="font-medium text-gray-700">{updatedByLabel}</span>
                    </span>
                </>
            )}
            {updatedAtLabel && (
                <>
                    <span aria-hidden="true">·</span>
                    <span>
                        {t("settings.system.updatedAt")}{" "}
                        <span className="font-medium text-gray-700">{updatedAtLabel}</span>
                    </span>
                </>
            )}
            <span aria-hidden="true">·</span>
            <span>
                {t("settings.system.lastRecalculated")}{" "}
                {recalculatedLabel ? (
                    <span className="font-medium text-gray-700">{recalculatedLabel}</span>
                ) : (
                    <span className="text-gray-400">{t("settings.system.neverRecalculated")}</span>
                )}
            </span>
        </div>
    );
}
