"use client";

import type { CurrentPeriod, Mahadasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";

import { buildPath } from "./expandedPaths";

interface CurrentPeriodBadgeProps {
    currentPeriod: CurrentPeriod | null;
    mahadashaList: Mahadasha[];
    /** Indices of the running period at each level, as found in `mahadashaList` (null when not found). */
    activeIndices: (number | null)[];
    onJumpToPeriod: (path: string) => void;
    getPlanetName: (id: number) => string;
}

const LEVELS: { key: keyof CurrentPeriod; level: string; suffix: string }[] = [
    { key: "mahadashaLord", level: "mahadasha", suffix: "MD" },
    { key: "antardashaLord", level: "antardasha", suffix: "AD" },
    { key: "vidasaLord", level: "vidasa", suffix: "VD" },
    { key: "sukshamaLord", level: "sukshama", suffix: "SK" },
    { key: "pranaLord", level: "prana", suffix: "PR" },
];

export default function CurrentPeriodBadge({
    currentPeriod,
    mahadashaList,
    activeIndices,
    onJumpToPeriod,
    getPlanetName,
}: CurrentPeriodBadgeProps) {
    if (!currentPeriod) return null;

    const badges: {
        label: string;
        planet: number;
        level: string;
        path: string | null;
    }[] = [];

    LEVELS.forEach(({ key, level, suffix }, depth) => {
        const planet = currentPeriod[key];
        if (!planet) return;
        // The path is only usable when every level down to this one was located in the tree.
        const indices = activeIndices.slice(0, depth + 1);
        const path = indices.every((index) => index !== null) ? buildPath(...indices) : null;
        badges.push({
            label: `${getPlanetName(planet)} ${suffix}`,
            planet,
            level,
            path,
        });
    });

    if (badges.length === 0) return null;

    const running = mahadashaList.find((m) => m.planet === currentPeriod.mahadashaLord);

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
            <div className="text-xs text-gray-500 mb-2">{String.fromCharCode(0x25cf)} Current:</div>
            <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
                {badges.map((badge, idx) => (
                    <span key={badge.level} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-gray-300 text-xs">{">"}</span>}
                        <button
                            type="button"
                            aria-label={`Jump to ${badge.label}`}
                            disabled={badge.path === null}
                            onClick={() => badge.path && onJumpToPeriod(badge.path)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-indigo-100"
                        >
                            <span
                                className="inline-flex items-center justify-center w-4 h-4 text-xs"
                                style={{
                                    color: PLANET_COLORS[badge.planet] ?? "#374151",
                                    fontWeight: 300,
                                }}
                            >
                                {PLANET_SYMBOLS[badge.planet] ?? ""}
                            </span>
                            <span>{badge.label}</span>
                        </button>
                    </span>
                ))}
            </div>
            {mahadashaList.length > 0 && (
                <div className="text-[11px] text-gray-400 mt-1.5">
                    {getPlanetName(currentPeriod.mahadashaLord)} Mahadasha:{" "}
                    {running?.startDate ? (
                        <>
                            {running.startDate} &mdash; {running.endDate}
                        </>
                    ) : running?.durationYears ? (
                        `${running.durationYears} years`
                    ) : (
                        "duration unavailable"
                    )}
                </div>
            )}
        </div>
    );
}
