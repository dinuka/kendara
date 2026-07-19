"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useRef } from "react";

interface ConfirmDeleteModalProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
    error: string | null;
}

export default function ConfirmDeleteModal({ open, onConfirm, onCancel, loading, error }: ConfirmDeleteModalProps) {
    const { t } = useI18n();
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            cancelRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-label={t("horoscope.deleteConfirm")}
            onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
            }}
        >
            <div
                className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5 text-red-600"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{t("horoscope.deleteConfirm")}</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4 pl-[52px]">{t("horoscope.deleteWarning")}</p>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700" role="alert">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        {t("common.cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        {loading ? t("common.loading") : t("common.delete")}
                    </button>
                </div>
            </div>
        </div>
    );
}
