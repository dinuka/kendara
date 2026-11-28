"use client";

import type { PlanetAspectEntry, PlanetAspectsSettings } from "@/components/settings/types";
import { useI18n } from "@/hooks/useI18n";
import { useState } from "react";

import { DEFAULT_ASPECT_HOUSES, VALID_ASPECT_DEGREES, defaultAspectDegrees } from "@/lib/planetAspects";

const PLANET_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Effective selection for a planet: the stored (custom) entry when present, else its system
 *  defaults. `houses`/`degrees` are always non-empty for display. */
function effectiveEntry(entry: PlanetAspectEntry | undefined, planetId: string): PlanetAspectEntry {
    if (entry)
        return { houses: [...entry.houses].sort((a, b) => a - b), degrees: [...entry.degrees].sort((a, b) => a - b) };
    const defaults = DEFAULT_ASPECT_HOUSES[Number(planetId)];
    return {
        houses: defaults?.length ? [...defaults].sort((a, b) => a - b) : [7],
        degrees: defaultAspectDegrees(Number(planetId)),
    };
}

/** Aspect houses are the 2nd through 11th from the planet (house 1 is the planet's own house /
 *  conjunction and house 12 has no classical aspect, so both are excluded). House H pairs with its
 *  angle (H−1)×30 — consistent with `defaultAspectDegrees` and the tooltip relative-house rule
 *  (30°→2 … 330°→12) — so toggling one side toggles its pair, keeping houses/degrees in sync. */
const ASPECT_HOUSE_MIN = 2;
const ASPECT_HOUSE_MAX = 11;
const pairedAngleForHouse = (house: number): number | null =>
    house >= ASPECT_HOUSE_MIN && house <= ASPECT_HOUSE_MAX ? (house - 1) * 30 : null;
const pairedHouseForAngle = (angle: number): number => angle / 30 + 1;

interface PlanetAspectsSectionProps {
    planetAspects: PlanetAspectsSettings;
    readOnly?: boolean;
    onChange?: (planetAspects: PlanetAspectsSettings) => void;
}

/** System-wide planet aspects. `readOnly` renders the pill + values rows as static text; the
 *  editable mode is the existing expandable chip editor (houses 2–11, degrees 30–330 step 30). */
export default function PlanetAspectsSection({ planetAspects, readOnly = false, onChange }: PlanetAspectsSectionProps) {
    const { t } = useI18n();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggleExpanded = (planetId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(planetId)) next.delete(planetId);
            else next.add(planetId);
            return next;
        });
    };

    const updateEntry = (planetId: string, entry: PlanetAspectEntry) => {
        onChange?.({ ...planetAspects, [planetId]: entry });
    };

    const resetPlanet = (planetId: string) => {
        const next = { ...planetAspects };
        delete next[planetId];
        onChange?.(next);
    };

    const toggleHouse = (planetId: string, entry: PlanetAspectEntry, house: number) => {
        const isOn = entry.houses.includes(house);
        const houses = isOn ? entry.houses.filter((h) => h !== house) : [...entry.houses, house];
        const pair = pairedAngleForHouse(house);
        let degrees = entry.degrees;
        if (pair !== null) {
            degrees = isOn ? degrees.filter((d) => d !== pair) : degrees.includes(pair) ? degrees : [...degrees, pair];
        }
        updateEntry(planetId, { houses: houses.sort((a, b) => a - b), degrees: degrees.sort((a, b) => a - b) });
    };

    const toggleDegree = (planetId: string, entry: PlanetAspectEntry, angle: number) => {
        const isOn = entry.degrees.includes(angle);
        const pair = pairedHouseForAngle(angle);
        const houseInRange = pair >= ASPECT_HOUSE_MIN && pair <= ASPECT_HOUSE_MAX;
        const houses = isOn
            ? entry.houses.filter((h) => h !== pair)
            : houseInRange && !entry.houses.includes(pair)
              ? [...entry.houses, pair]
              : entry.houses;
        const degrees = isOn ? entry.degrees.filter((d) => d !== angle) : [...entry.degrees, angle];
        updateEntry(planetId, { houses: houses.sort((a, b) => a - b), degrees: degrees.sort((a, b) => a - b) });
    };

    const chipClass = (active: boolean) =>
        `px-2 py-0.5 rounded text-xs border transition-colors ${
            active
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`;

    return (
        <div>
            <h2 className="text-lg font-semibold mb-1">{t("settings.planetAspects")}</h2>
            <p className="text-sm text-gray-500 mb-3">{t("settings.planetAspectsDescription")}</p>
            <div className="space-y-3">
                {PLANET_IDS.map((planetId) => {
                    const entry = effectiveEntry(planetAspects[planetId], planetId);
                    const isCustom = !!planetAspects[planetId];
                    const isExpanded = expanded.has(planetId);
                    return (
                        <div key={planetId} className={readOnly ? "" : "border rounded p-2"}>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="w-24 font-medium text-gray-700">
                                    {t(`astrology.planetNames.${planetId}`)}
                                </span>
                                <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                                        isCustom ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
                                    }`}
                                >
                                    {isCustom ? t("settings.customStatus") : t("settings.defaultStatus")}
                                </span>
                                <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">
                                    {t("settings.housesColon")}
                                </span>
                                <span className="text-gray-900">{entry.houses.join(", ")}</span>
                                <span className="text-xs text-gray-500 uppercase tracking-wide mr-1 ml-2">
                                    {t("settings.degreesColon")}
                                </span>
                                <span className="text-gray-900">{entry.degrees.join(", ")}°</span>
                                {!readOnly && (
                                    <button
                                        onClick={() => toggleExpanded(planetId)}
                                        aria-expanded={isExpanded}
                                        className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        {isExpanded ? t("settings.collapse") : t("settings.customize")}
                                    </button>
                                )}
                            </div>

                            {!readOnly && isExpanded && (
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                                            {t("settings.houses")}
                                        </span>
                                        <div
                                            className="flex flex-wrap gap-1.5"
                                            role="group"
                                            aria-label={t("settings.houses")}
                                        >
                                            {Array.from(
                                                { length: ASPECT_HOUSE_MAX - ASPECT_HOUSE_MIN + 1 },
                                                (_, i) => i + ASPECT_HOUSE_MIN,
                                            ).map((house) => (
                                                <button
                                                    key={house}
                                                    type="button"
                                                    aria-pressed={entry.houses.includes(house)}
                                                    onClick={() => toggleHouse(planetId, entry, house)}
                                                    className={chipClass(entry.houses.includes(house))}
                                                >
                                                    {house}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                                            {t("settings.degrees")}
                                        </span>
                                        <div
                                            className="flex flex-wrap gap-1.5"
                                            role="group"
                                            aria-label={t("settings.degrees")}
                                        >
                                            {VALID_ASPECT_DEGREES.map((angle) => (
                                                <button
                                                    key={angle}
                                                    type="button"
                                                    aria-pressed={entry.degrees.includes(angle)}
                                                    onClick={() => toggleDegree(planetId, entry, angle)}
                                                    className={chipClass(entry.degrees.includes(angle))}
                                                >
                                                    {angle}°
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-gray-500">
                                            {t("settings.planetAspectsSelectionDescription")}
                                        </p>
                                        <button
                                            onClick={() => resetPlanet(planetId)}
                                            className="text-xs text-gray-500 hover:text-gray-700 underline shrink-0"
                                        >
                                            {t("settings.resetPlanet")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
