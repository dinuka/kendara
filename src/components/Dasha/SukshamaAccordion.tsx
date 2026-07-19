"use client";

import { useCallback } from "react";

import type { Sukshama } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatDayDuration } from "@/lib/astrology";

import PranaRow from "./PranaRow";

interface SukshamaAccordionProps {
    sukshama: Sukshama;
    isActive: boolean;
    defaultExpanded: boolean;
    path: string;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

export default function SukshamaAccordion({
    sukshama,
    isActive,
    defaultExpanded,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
}: SukshamaAccordionProps) {
    const isExpanded = expandedPaths.has(path);
    const hasPrana = sukshama.prana && sukshama.prana.length > 0;

    const handleToggle = useCallback(() => {
        onToggle(path);
    }, [onToggle, path]);

    return (
        <div role="treeitem" aria-expanded={isExpanded} aria-current={isActive ? "true" : undefined}>
            <div
                role="button"
                tabIndex={0}
                aria-label={`${getPlanetName(sukshama.planet)} Sukshama`}
                onClick={hasPrana ? handleToggle : undefined}
                onKeyDown={(e) => {
                    if (hasPrana && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 py-2 px-2 ml-12 text-xs cursor-pointer select-none transition-colors ${hasPrana ? "" : "cursor-default"} ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
            >
                {hasPrana && (
                    <span
                        className={`inline-block transition-transform duration-200 text-gray-400 text-[10px] ${isExpanded ? "rotate-180" : ""}`}
                    >
                        {String.fromCharCode(0x25b8)}
                    </span>
                )}
                {!hasPrana && <span className="inline-block w-3" />}
                <span
                    className="inline-flex items-center justify-center w-4 h-4 text-xs"
                    style={{ color: PLANET_COLORS[sukshama.planet] ?? "#374151", fontWeight: 300 }}
                >
                    {PLANET_SYMBOLS[sukshama.planet] ?? ""}
                </span>
                <span className="text-gray-600 font-medium">{getPlanetName(sukshama.planet)}</span>
                <span className="text-[10px] text-gray-400 ml-1">{getDashaLevelName("sukshama")}</span>
                <span className="text-gray-400 ml-auto">
                    {sukshama.startDate} &mdash; {sukshama.endDate}
                </span>
                <span className="text-gray-500 ml-1">(age {Math.floor(sukshama.startAge)}y)</span>
                <span className="text-gray-400 whitespace-nowrap">{formatDayDuration(sukshama.durationDays)}</span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasPrana && (
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[2000px]" : "max-h-0"}`}
                >
                    <div className="border-l border-gray-100 ml-[18px]">
                        {sukshama.prana.map((pr, prIdx) => (
                            <PranaRow
                                key={prIdx}
                                prana={pr}
                                isActive={isActive && prIdx === 0}
                                getPlanetName={getPlanetName}
                                getDashaLevelName={getDashaLevelName}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
