"use client";

import { useCallback } from "react";

import type { Mahadasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatYearDuration } from "@/lib/astrology";

import AntardashaAccordion from "./AntardashaAccordion";

interface MahadashaAccordionProps {
    mahadasha: Mahadasha;
    isActive: boolean;
    defaultExpanded: boolean;
    activeAdIndex: number | null;
    activeVdIndex: number | null;
    activeSkIndex: number | null;
    path: string;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

export default function MahadashaAccordion({
    mahadasha,
    isActive,
    defaultExpanded,
    activeAdIndex,
    activeVdIndex,
    activeSkIndex,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
}: MahadashaAccordionProps) {
    const isExpanded = expandedPaths.has(path);
    const hasAntardasha = mahadasha.antardasha && mahadasha.antardasha.length > 0;

    const handleToggle = useCallback(() => {
        onToggle(path);
    }, [onToggle, path]);

    return (
        <div
            role="treeitem"
            aria-expanded={isExpanded}
            aria-current={isActive ? "true" : undefined}
            className={`border rounded-lg mb-2 overflow-hidden transition-colors border-gray-200`}
        >
            <div
                role="button"
                tabIndex={0}
                aria-label={`${getPlanetName(mahadasha.planet)} Mahadasha`}
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-3 py-3 px-4 cursor-pointer select-none transition-colors ${
                    isActive ? "border-l-3 border-indigo-700 bg-indigo-100" : "hover:bg-gray-50"
                }`}
            >
                <span
                    className={`inline-block transition-transform duration-200 text-gray-400 text-sm ${
                        isExpanded ? "rotate-180" : ""
                    }`}
                >
                    {String.fromCharCode(0x25b8)}
                </span>
                <span
                    className="inline-flex items-center justify-center w-5 h-5 text-sm"
                    style={{ color: PLANET_COLORS[mahadasha.planet] ?? "#374151", fontWeight: 300 }}
                >
                    {PLANET_SYMBOLS[mahadasha.planet] ?? ""}
                </span>
                <span className="font-semibold text-gray-800 text-sm">{getPlanetName(mahadasha.planet)}</span>
                <span className="text-xs text-gray-400">{getDashaLevelName("mahadasha")}</span>
                <span className="text-xs text-gray-400 ml-auto">
                    {mahadasha.startDate} &mdash; {mahadasha.endDate}
                </span>
                <span className="text-xs text-gray-500 ml-2">(age {formatYearDuration(mahadasha.startAge)})</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatYearDuration(mahadasha.durationYears)}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasAntardasha && (
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? "max-h-[30000px]" : "max-h-0"
                    }`}
                >
                    <div className="border-t border-gray-100">
                        {mahadasha.antardasha.map((ad, adIdx) => {
                            const adPath = `${path}/ad:${adIdx}`;
                            return (
                                <AntardashaAccordion
                                    key={adIdx}
                                    antardasha={ad}
                                    isActive={isActive && adIdx === activeAdIndex}
                                    defaultExpanded={defaultExpanded && adIdx === activeAdIndex}
                                    activeVdIndex={adIdx === activeAdIndex ? activeVdIndex : null}
                                    activeSkIndex={adIdx === activeAdIndex ? activeSkIndex : null}
                                    depth={1}
                                    path={adPath}
                                    expandedPaths={expandedPaths}
                                    onToggle={onToggle}
                                    getPlanetName={getPlanetName}
                                    getDashaLevelName={getDashaLevelName}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
