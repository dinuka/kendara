"use client";

import type { CurrentPeriod, Mahadasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS } from "@/lib/astrology";

interface CurrentPeriodBadgeProps {
    currentPeriod: CurrentPeriod | null;
    mahadashaList: Mahadasha[];
    onJumpToPeriod: (path: string) => void;
    getPlanetName: (id: number) => string;
}

export default function CurrentPeriodBadge({
    currentPeriod,
    mahadashaList,
    onJumpToPeriod,
    getPlanetName,
}: CurrentPeriodBadgeProps) {
    if (!currentPeriod) return null;

    const badges: { label: string; planet: number; level: string; path: string }[] = [];

    if (currentPeriod.mahadashaLord) {
        badges.push({
            label: `${getPlanetName(currentPeriod.mahadashaLord)} MD`,
            planet: currentPeriod.mahadashaLord,
            level: "mahadasha",
            path: "md:0",
        });
    }

    if (currentPeriod.antardashaLord) {
        badges.push({
            label: `${getPlanetName(currentPeriod.antardashaLord)} AD`,
            planet: currentPeriod.antardashaLord,
            level: "antardasha",
            path: "md:0/ad:0",
        });
    }

    if (currentPeriod.vidasaLord) {
        badges.push({
            label: `${getPlanetName(currentPeriod.vidasaLord)} VD`,
            planet: currentPeriod.vidasaLord,
            level: "vidasa",
            path: "md:0/ad:0/vd:0",
        });
    }

    if (currentPeriod.sukshamaLord) {
        badges.push({
            label: `${getPlanetName(currentPeriod.sukshamaLord)} SK`,
            planet: currentPeriod.sukshamaLord,
            level: "sukshama",
            path: "md:0/ad:0/vd:0/sk:0",
        });
    }

    if (currentPeriod.pranaLord) {
        badges.push({
            label: `${getPlanetName(currentPeriod.pranaLord)} PR`,
            planet: currentPeriod.pranaLord,
            level: "prana",
            path: "md:0/ad:0/vd:0/sk:0/pr:0",
        });
    }

    if (badges.length === 0) return null;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
            <div className="text-xs text-gray-500 mb-2">{String.fromCharCode(0x25cf)} Current:</div>
            <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
                {badges.map((badge, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-gray-300 text-xs">{">"}</span>}
                        <button
                            role="button"
                            tabIndex={0}
                            aria-label={`Jump to ${badge.label}`}
                            onClick={() => onJumpToPeriod(badge.path)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors cursor-pointer"
                        >
                            <span
                                className="inline-flex items-center justify-center w-4 h-4 text-xs"
                                style={{ color: PLANET_COLORS[badge.planet] ?? "#374151", fontWeight: 300 }}
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
                    {mahadashaList.find((m) => m.planet === currentPeriod.mahadashaLord)?.startDate ?? ""} &mdash;{" "}
                    {mahadashaList.find((m) => m.planet === currentPeriod.mahadashaLord)?.endDate ?? ""}
                </div>
            )}
        </div>
    );
}
