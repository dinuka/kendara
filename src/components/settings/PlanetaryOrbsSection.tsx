"use client";

import type { OrbSettings } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";

import { DEFAULT_ORBS } from "@/lib/planetAspects";

const PLANET_PAIRS = [["1", "2"], ["3", "4"], ["5", "6"], ["7"], ["8", "9"]];

interface PlanetaryOrbsSectionProps {
    orbs: OrbSettings;
    readOnly?: boolean;
    onChange?: (orbs: OrbSettings) => void;
}

/** System-wide planetary orbs (Rāśmi). `readOnly` renders static value rows for students; the
 *  editable mode is the same number-input grid, constrained to 0–30 step 0.5. */
export default function PlanetaryOrbsSection({ orbs, readOnly = false, onChange }: PlanetaryOrbsSectionProps) {
    const { t } = useI18n();

    const updateOrb = (planetId: string, value: string) => {
        if (!onChange) return;
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 30) return;
        onChange({ ...orbs, [planetId]: num });
    };

    return (
        <div>
            <h2 className="text-lg font-semibold mb-1">{t("settings.planetaryOrbs")}</h2>
            <p className="text-sm text-gray-500 mb-3">{t("settings.orbDescription")}</p>
            <div className="space-y-2">
                {PLANET_PAIRS.map((pair) => (
                    <div key={pair.join("-")} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {pair.map((id) => (
                            <div key={id} className="flex items-center gap-3">
                                <span className="w-24 text-sm font-medium text-gray-700">
                                    {t(`astrology.planetNames.${id}`)}
                                </span>
                                {readOnly ? (
                                    <span className="text-sm text-gray-900">{orbs[id] ?? DEFAULT_ORBS[id] ?? 0}°</span>
                                ) : (
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={30}
                                        step={0.5}
                                        value={orbs[id] ?? DEFAULT_ORBS[id] ?? 0}
                                        onChange={(e) => updateOrb(id, e.target.value)}
                                        aria-label={t(`astrology.planetNames.${id}`)}
                                        className="w-20 px-2 py-1 border rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                )}
                                {!readOnly && <span className="text-sm text-gray-500">°</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
