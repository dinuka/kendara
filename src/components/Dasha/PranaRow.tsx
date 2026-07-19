"use client";

import type { Prana } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";

interface PranaRowProps {
    prana: Prana;
    isActive: boolean;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

export default function PranaRow({ prana, isActive, getPlanetName, getDashaLevelName }: PranaRowProps) {
    return (
        <div className={`flex items-center gap-2 py-1.5 px-2 ml-16 text-xs ${isActive ? "bg-indigo-100 rounded" : ""}`}>
            <span className="text-gray-400 text-[10px]">{String.fromCharCode(0x25cf)}</span>
            <span
                className="inline-flex items-center justify-center w-4 h-4 text-xs"
                style={{ color: PLANET_COLORS[prana.planet] ?? "#374151", fontWeight: 300 }}
            >
                {PLANET_SYMBOLS[prana.planet] ?? ""}
            </span>
            <span className="text-gray-600">{getPlanetName(prana.planet)}</span>
            <span className="text-[10px] text-gray-400 ml-0.5">{getDashaLevelName("prana")}</span>
            <span className="text-gray-400 ml-auto">
                {prana.startDate} &mdash; {prana.endDate}
            </span>
            <span className="text-gray-400 whitespace-nowrap">{prana.durationHours}h</span>
            {isActive && (
                <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                    Active
                </span>
            )}
        </div>
    );
}
