"use client";

import type { RashiAspectsSettings } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";

import { DEFAULT_RASHI_ASPECTS } from "@/lib/rashiAspects";
import { computeRashiAspectSigns, isRashiTargetEnabled } from "@/lib/rashiAspects";

const SIGN_IDS = Array.from({ length: 12 }, (_, i) => String(i + 1));

interface RashiAspectsSectionProps {
    rashiAspects: RashiAspectsSettings;
    readOnly?: boolean;
    onChange?: (rashiAspects: RashiAspectsSettings) => void;
}

/** System-wide rashi aspects. `readOnly` renders the enabled badge + override badges (disabled
 *  signs struck through) with the fixed-rule summary; the editable mode adds the enabled toggle
 *  and per-sign override chips. */
export default function RashiAspectsSection({ rashiAspects, readOnly = false, onChange }: RashiAspectsSectionProps) {
    const { t } = useI18n();
    const rashi = { ...DEFAULT_RASHI_ASPECTS, ...rashiAspects };
    const enabled = !!rashi.enabled;

    const toggleEnabled = () => {
        if (!onChange) return;
        onChange({ ...rashi, enabled: !enabled });
    };

    const toggleSignOverride = (signId: string) => {
        if (!onChange) return;
        const overrides = { ...rashi.overrides };
        const current = overrides[signId];
        if (current?.enabled === false) {
            const { enabled: _ignored, ...rest } = current;
            if (Object.keys(rest).length > 0) overrides[signId] = rest;
            else delete overrides[signId];
        } else {
            overrides[signId] = { ...current, enabled: false };
        }
        onChange({ ...rashi, overrides });
    };

    const toggleTargetOverride = (signId: string, targetSign: string) => {
        if (!onChange) return;
        const overrides = { ...rashi.overrides };
        const current = overrides[signId] ?? {};
        const targets = { ...current.targets };
        if (targets[targetSign] === false) {
            delete targets[targetSign];
        } else {
            targets[targetSign] = false;
        }
        overrides[signId] = { ...current, targets: Object.keys(targets).length ? targets : undefined };
        onChange({ ...rashi, overrides });
    };

    const signChipClass = (disabled: boolean) =>
        `px-3 py-1 rounded text-sm border ${
            disabled
                ? "bg-red-50 text-red-500 border-red-200 line-through"
                : "bg-indigo-50 text-indigo-600 border-indigo-200"
        }`;

    const targetChipClass = (disabled: boolean) =>
        `px-2 py-0.5 rounded text-xs border ${
            disabled
                ? "bg-red-50 text-red-500 border-red-200 line-through"
                : "bg-indigo-50 text-indigo-600 border-indigo-200"
        }`;

    return (
        <div>
            <h2 className="text-lg font-semibold mb-1">{t("settings.rashiAspects")}</h2>
            <p className="text-sm text-gray-500 mb-3">{t("settings.rashiAspectsDescription")}</p>

            <div className="flex items-center gap-3 mb-4">
                {readOnly ? (
                    <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                            enabled ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
                        }`}
                    >
                        {enabled ? t("settings.enabled") : t("settings.disabled")}
                    </span>
                ) : (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={toggleEnabled}
                        className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                            enabled
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        {enabled ? t("settings.enabled") : t("settings.disabled")}
                    </button>
                )}
            </div>

            {enabled && (
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide mr-3 block mb-2">
                        {t("settings.aspectingSigns")}
                    </span>
                    <div className="space-y-2">
                        {SIGN_IDS.map((signId) => {
                            const disabled = rashi.overrides?.[signId]?.enabled === false;
                            const aspected = computeRashiAspectSigns(Number(signId));
                            return (
                                <div
                                    key={signId}
                                    className="flex items-center justify-between gap-4 border rounded p-2"
                                >
                                    {readOnly ? (
                                        <span className={signChipClass(disabled)}>
                                            {t(`astrology.signNames.${signId}`)}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-pressed={!disabled}
                                            onClick={() => toggleSignOverride(signId)}
                                            title={t("settings.disableSign")}
                                            className={`${signChipClass(disabled)} ${disabled ? "" : "hover:border-indigo-400"}`}
                                        >
                                            {t(`astrology.signNames.${signId}`)}
                                        </button>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex flex-wrap gap-2">
                                            {aspected.map((target) => {
                                                const tDisabled = !isRashiTargetEnabled(Number(signId), target, rashi);
                                                if (readOnly) {
                                                    return (
                                                        <span key={target} className={targetChipClass(tDisabled)}>
                                                            {t(`astrology.signNames.${String(target)}`)}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        key={target}
                                                        type="button"
                                                        aria-pressed={!tDisabled}
                                                        onClick={() => toggleTargetOverride(signId, String(target))}
                                                        className={`${targetChipClass(tDisabled)} ${
                                                            tDisabled ? "" : "hover:border-indigo-400"
                                                        }`}
                                                    >
                                                        {t(`astrology.signNames.${String(target)}`)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <p className="text-sm text-gray-500 mt-4">{t("settings.rashiAspectsDescription")}</p>
        </div>
    );
}
