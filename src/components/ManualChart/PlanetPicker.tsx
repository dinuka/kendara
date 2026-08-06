"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useRef, useState } from "react";

import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

interface PlanetPickerProps {
    unplaced: number[];
    onSelect: (planet: number) => void;
    idPrefix: string;
    disabled?: boolean;
}

export default function PlanetPicker({ unplaced, onSelect, idPrefix, disabled }: PlanetPickerProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                disabled={disabled || unplaced.length === 0}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="text-xs px-2 py-1 border border-dashed rounded hover:bg-indigo-50 text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
                + {t("manualChart.addPlanet")}
            </button>
            {open && (
                <div role="menu" className="absolute z-20 mt-1 left-0 bg-white border rounded-lg shadow-lg p-1 w-56">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {t("manualChart.selectPlanet")}
                    </p>
                    {unplaced.map((planet) => (
                        <button
                            key={planet}
                            role="menuitem"
                            type="button"
                            onClick={() => {
                                onSelect(planet);
                                setOpen(false);
                            }}
                            aria-label={`${t(`astrology.planetNames.${planet}`)} ${t(`astrology.planetNames.${planet}`)}`}
                            className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 hover:bg-indigo-50 text-sm"
                        >
                            <span style={{ color: PLANET_COLORS[planet] }}>{PLANET_SYMBOLS[planet]}</span>
                            <span className="font-medium">{t(`astrology.planetNames.${planet}`)}</span>
                            <span className="text-xs text-gray-400">{t(`astrology.planetNames.${planet}`)}</span>
                        </button>
                    ))}
                    <div id={`${idPrefix}-picker`} />
                </div>
            )}
        </div>
    );
}

export function allPlanets(): number[] {
    return Object.values(Planet).filter((v): v is number => typeof v === "number");
}
