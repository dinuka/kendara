"use client";

import { useCallback } from "react";

import type { Vidasa } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatDayDuration } from "@/lib/astrology";

import SukshamaAccordion from "./SukshamaAccordion";

interface VidasaAccordionProps {
    vidasa: Vidasa;
    isActive: boolean;
    defaultExpanded: boolean;
    activeSkIndex: number | null;
    depth: number;
    path: string;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

export default function VidasaAccordion({
    vidasa,
    isActive,
    defaultExpanded,
    activeSkIndex,
    depth,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
}: VidasaAccordionProps) {
    const isExpanded = expandedPaths.has(path);
    const hasSukshama = vidasa.sukshama && vidasa.sukshama.length > 0;

    const handleToggle = useCallback(() => {
        onToggle(path);
    }, [onToggle, path]);

    return (
        <div role="treeitem" aria-expanded={isExpanded} aria-current={isActive ? "true" : undefined}>
            <div
                role="button"
                tabIndex={0}
                aria-label={`${getPlanetName(vidasa.planet)} Vidasa`}
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 py-2 px-2 ml-8 text-xs cursor-pointer select-none transition-colors ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
            >
                <span
                    className={`inline-block transition-transform duration-200 text-gray-400 text-[10px] ${isExpanded ? "rotate-180" : ""}`}
                >
                    {String.fromCharCode(0x25b8)}
                </span>
                <span
                    className="inline-flex items-center justify-center w-4 h-4 text-xs"
                    style={{ color: PLANET_COLORS[vidasa.planet] ?? "#374151", fontWeight: 300 }}
                >
                    {PLANET_SYMBOLS[vidasa.planet] ?? ""}
                </span>
                <span className="text-gray-600 font-medium">{getPlanetName(vidasa.planet)}</span>
                <span className="text-[10px] text-gray-400 ml-1">{getDashaLevelName("vidasa")}</span>
                <span className="text-gray-400 ml-auto">
                    {vidasa.startDate} &mdash; {vidasa.endDate}
                </span>
                <span className="text-gray-500 ml-1">(age {Math.floor(vidasa.startAge)}y)</span>
                <span className="text-gray-400 whitespace-nowrap">{formatDayDuration(vidasa.durationDays)}</span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasSukshama && (
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[10000px]" : "max-h-0"}`}
                >
                    {vidasa.sukshama.map((sk, skIdx) => {
                        const skPath = `${path}/sk:${skIdx}`;
                        return (
                            <SukshamaAccordion
                                key={skIdx}
                                sukshama={sk}
                                isActive={isActive && skIdx === activeSkIndex}
                                defaultExpanded={defaultExpanded && skIdx === activeSkIndex}
                                path={skPath}
                                expandedPaths={expandedPaths}
                                onToggle={onToggle}
                                getPlanetName={getPlanetName}
                                getDashaLevelName={getDashaLevelName}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
