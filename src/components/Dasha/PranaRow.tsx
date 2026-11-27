"use client";

import type { ReactNode } from "react";
import { memo } from "react";

import type { Prana } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";

import { useDashaRowDisplay } from "./DashaDisplayContext";

interface PranaRowProps {
    prana: Prana;
    path: string;
    isActive: boolean;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    renderDashaNumbers: (planet: number) => ReactNode;
}

function PranaRow({ prana, path, isActive, getPlanetName, getDashaLevelName, renderDashaNumbers }: PranaRowProps) {
    const { fields } = useDashaRowDisplay();
    return (
        <div
            data-dasha-path={path}
            aria-current={isActive ? "true" : undefined}
            className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 px-2 ml-8 sm:ml-16 text-xs ${isActive ? "bg-indigo-100 rounded" : ""}`}
        >
            <span className="text-gray-400 text-[10px]">{String.fromCharCode(0x25cf)}</span>
            <span
                className="inline-flex items-center justify-center w-4 h-4 text-xs"
                style={{
                    color: PLANET_COLORS[prana.planet] ?? "#374151",
                    fontWeight: 300,
                }}
            >
                {PLANET_SYMBOLS[prana.planet] ?? ""}
            </span>
            <span className="text-gray-600">{getPlanetName(prana.planet)}</span>
            {fields.levelName && (
                <span className="text-[10px] text-gray-400 ml-0.5">{getDashaLevelName("prana")}</span>
            )}
            {renderDashaNumbers(prana.planet)}
            <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 text-gray-400">
                {fields.dates && (
                    <span>
                        {formatPranaTime(prana.startDate)} &mdash; {formatPranaTime(prana.endDate)}
                    </span>
                )}
                {fields.duration && <span className="whitespace-nowrap">{prana.durationHours}h</span>}
            </span>
            {isActive && (
                <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                    Active
                </span>
            )}
        </div>
    );
}

/** "2026-11-16T05:30:00" → "2026-11-16 05:30" (Prana periods last hours, so the time matters). */
function formatPranaTime(value: string): string {
    return value.replace("T", " ").slice(0, 16);
}

export default memo(PranaRow);
