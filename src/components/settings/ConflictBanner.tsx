"use client";

import { useI18n } from "@/hooks/useI18n";

interface ConflictBannerProps {
    /** The version the stale copy was based on (before the other admin's save). */
    version: number;
    /** Whether local edits exist that a reload would discard. */
    dirty: boolean;
    /** Confirmation modal is open (dirty reload path). */
    confirming: boolean;
    onReload: () => void;
    onDiscardConfirm: () => void;
    onCancel: () => void;
}

/** 409-stale recovery banner (US-SAS-002 AC6 / UX §6.2). Offers a reload that re-fetches the
 *  current document; when the form is dirty a confirmation precedes the discard. */
export default function ConflictBanner({
    version,
    dirty,
    confirming,
    onReload,
    onDiscardConfirm,
    onCancel,
}: ConflictBannerProps) {
    const { t } = useI18n();

    return (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
            <p className="font-semibold">{t("settings.conflict.title")}</p>
            <p className="mt-1">{t("settings.conflict.body", { version })}</p>
            {dirty && <p className="mt-1 text-xs">{t("settings.conflict.discardConfirmBody")}</p>}
            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={onReload}
                    className="px-3 py-1.5 rounded text-sm font-medium bg-amber-600 text-white hover:bg-amber-700"
                >
                    {t("settings.conflict.reload")}
                </button>
                {confirming && (
                    <>
                        <button
                            type="button"
                            onClick={onDiscardConfirm}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                        >
                            {t("settings.conflict.discardConfirmTitle")}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-3 py-1.5 rounded text-sm border border-amber-300 hover:bg-amber-100"
                        >
                            {t("common.cancel")}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
