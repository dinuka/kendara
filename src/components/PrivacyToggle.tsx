"use client";

import { useI18n } from "@/hooks/useI18n";

interface PrivacyToggleProps {
    isPublic: boolean;
    displayName: boolean;
    onChange: (settings: { isPublic?: boolean; displayName?: boolean }) => void;
    saving: boolean;
    error: string | null;
    disabled?: boolean;
    context: "create" | "detail";
}

export default function PrivacyToggle({
    isPublic,
    displayName,
    onChange,
    saving,
    error,
    disabled,
    context,
}: PrivacyToggleProps) {
    const { t } = useI18n();

    const handleVisibilityChange = (value: boolean) => {
        onChange({ isPublic: value });
    };

    const handleDisplayNameChange = (value: boolean) => {
        onChange({ displayName: value });
    };

    return (
        <div
            role="group"
            aria-label={t("horoscope.privacy.title")}
            aria-busy={saving}
            className={`rounded-lg border p-4 ${context === "detail" ? "bg-gray-50" : "bg-white"}`}
        >
            <div role="radiogroup" aria-label={t("horoscope.privacy.title")} className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">{t("horoscope.privacy.title")}</p>

                <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        !isPublic ? "border-gray-400 bg-white" : "border-gray-200 hover:bg-gray-50"
                    } ${saving || disabled ? "pointer-events-none opacity-50" : ""}`}
                >
                    <input
                        type="radio"
                        name="visibility"
                        checked={!isPublic}
                        onChange={() => handleVisibilityChange(false)}
                        disabled={saving || disabled}
                        className="sr-only"
                    />
                    <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            !isPublic ? "border-gray-600" : "border-gray-300"
                        }`}
                    >
                        {!isPublic && <span className="w-2 h-2 rounded-full bg-gray-600" />}
                    </span>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-gray-500"
                            >
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span className="text-sm font-medium">{t("horoscope.privacy.private_label")}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t("horoscope.privacy.private_description")}</p>
                    </div>
                </label>

                <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isPublic ? "border-green-400 bg-white" : "border-gray-200 hover:bg-gray-50"
                    } ${saving || disabled ? "pointer-events-none opacity-50" : ""}`}
                >
                    <input
                        type="radio"
                        name="visibility"
                        checked={isPublic}
                        onChange={() => handleVisibilityChange(true)}
                        disabled={saving || disabled}
                        className="sr-only"
                    />
                    <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isPublic ? "border-green-600" : "border-gray-300"
                        }`}
                    >
                        {isPublic && <span className="w-2 h-2 rounded-full bg-green-600" />}
                    </span>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 text-green-600"
                            >
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                                <path d="M2 12h20" />
                            </svg>
                            <span className="text-sm font-medium">{t("horoscope.privacy.public_label")}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t("horoscope.privacy.public_description")}</p>
                    </div>
                </label>
            </div>

            <div
                className={`overflow-hidden transition-all duration-200 ease-out ${
                    isPublic ? "max-h-64 opacity-100 mt-4" : "max-h-0 opacity-0"
                }`}
                aria-hidden={!isPublic}
            >
                <div role="radiogroup" aria-label={t("horoscope.privacy.display_name_title")} className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        {t("horoscope.privacy.display_name_title")}
                    </p>

                    <label
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            displayName ? "border-indigo-400 bg-white" : "border-gray-200 hover:bg-gray-50"
                        } ${saving || disabled || !isPublic ? "pointer-events-none opacity-50" : ""}`}
                    >
                        <input
                            type="radio"
                            name="displayName"
                            checked={displayName}
                            onChange={() => handleDisplayNameChange(true)}
                            disabled={saving || disabled || !isPublic}
                            className="sr-only"
                        />
                        <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                displayName ? "border-indigo-600" : "border-gray-300"
                            }`}
                        >
                            {displayName && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                        </span>
                        <div className="flex-1">
                            <span className="text-sm">{t("horoscope.privacy.display_name_show")}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {t("horoscope.privacy.display_name_show_description")}
                            </p>
                        </div>
                    </label>

                    <label
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            !displayName ? "border-amber-400 bg-white" : "border-gray-200 hover:bg-gray-50"
                        } ${saving || disabled || !isPublic ? "pointer-events-none opacity-50" : ""}`}
                    >
                        <input
                            type="radio"
                            name="displayName"
                            checked={!displayName}
                            onChange={() => handleDisplayNameChange(false)}
                            disabled={saving || disabled || !isPublic}
                            className="sr-only"
                        />
                        <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                !displayName ? "border-amber-600" : "border-gray-300"
                            }`}
                        >
                            {!displayName && <span className="w-2 h-2 rounded-full bg-amber-600" />}
                        </span>
                        <div className="flex-1">
                            <span className="text-sm">{t("horoscope.privacy.display_name_hide")}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {t("horoscope.privacy.display_name_hide_description")}
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {saving && (
                <div className="flex items-center justify-center mt-3 text-sm text-gray-500">
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    {t("common.saving")}
                </div>
            )}

            {error && (
                <div role="alert" className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                </div>
            )}

            {context === "detail" && (
                <p className="text-xs text-gray-400 mt-3">{t("horoscope.privacy.share_link_note")}</p>
            )}
        </div>
    );
}
