"use client";

import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import type { Vidasa } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatDayDuration } from "@/lib/astrology";

import { useDashaRowDisplay } from "./DashaDisplayContext";
import SukshamaAccordion from "./SukshamaAccordion";

interface VidasaAccordionProps {
    vidasa: Vidasa;
    isActive: boolean;
    activeSkIndex: number | null;
    activePrIndex: number | null;
    path: string;
    expandedPaths: ReadonlySet<string>;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    renderDashaNumbers: (planet: number) => ReactNode;
}

function VidasaAccordion({
    vidasa,
    isActive,
    activeSkIndex,
    activePrIndex,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
    renderDashaNumbers,
}: VidasaAccordionProps) {
    const { fields, depth } = useDashaRowDisplay();
    const hasSukshama = depth >= 4 && vidasa.sukshama && vidasa.sukshama.length > 0;
    const isExpanded = hasSukshama && expandedPaths.has(path);

    const handleToggle = useCallback(() => {
        if (hasSukshama) onToggle(path);
    }, [onToggle, path, hasSukshama]);

    return (
        <div role="treeitem" aria-expanded={hasSukshama ? isExpanded : undefined} aria-current={isActive ? "true" : undefined}
            aria-selected={isActive}>
            <div
                role="button"
                tabIndex={0}
                data-dasha-path={path}
                aria-label={`${getPlanetName(vidasa.planet)} Vidasa`}
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 px-2 ml-4 sm:ml-8 text-xs cursor-pointer select-none transition-colors ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
            >
                <span
                    className={`inline-block w-2 transition-transform duration-200 text-gray-400 text-[10px] ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                >
                    {hasSukshama && String.fromCharCode(0x25b8)}
                </span>
                <span
                    className="inline-flex items-center justify-center w-4 h-4 text-xs"
                    style={{
                        color: PLANET_COLORS[vidasa.planet] ?? "#374151",
                        fontWeight: 300,
                    }}
                >
                    {PLANET_SYMBOLS[vidasa.planet] ?? ""}
                </span>
                <span className="text-gray-600 font-medium">{getPlanetName(vidasa.planet)}</span>
                {fields.levelName && (
                    <span className="text-[10px] text-gray-400 ml-1">{getDashaLevelName("vidasa")}</span>
                )}
                {renderDashaNumbers(vidasa.planet)}
                <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 text-gray-400">
                    {fields.dates && (
                        <span>
                            {vidasa.startDate} &mdash; {vidasa.endDate}
                        </span>
                    )}
                    {fields.age && <span className="text-gray-500">(age {Math.floor(vidasa.startAge)}y)</span>}
                    {fields.duration && (
                        <span className="whitespace-nowrap">{formatDayDuration(vidasa.durationDays)}</span>
                    )}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasSukshama && isExpanded && (
                <div>
                    {vidasa.sukshama.map((sk, skIdx) => {
                        const skPath = `${path}/sk:${skIdx}`;
                        const isActiveSk = isActive && skIdx === activeSkIndex;
                        return (
                            <SukshamaAccordion
                                key={skIdx}
                                sukshama={sk}
                                isActive={isActiveSk}
                                activePrIndex={isActiveSk ? activePrIndex : null}
                                path={skPath}
                                isExpanded={expandedPaths.has(skPath)}
                                onToggle={onToggle}
                                getPlanetName={getPlanetName}
                                getDashaLevelName={getDashaLevelName}
                                renderDashaNumbers={renderDashaNumbers}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default memo(VidasaAccordion);
