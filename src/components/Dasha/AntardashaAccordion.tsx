"use client";

import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import type { Antardasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatMonthDuration } from "@/lib/astrology";

import VidasaAccordion from "./VidasaAccordion";
import { pathsFor } from "./expandedPaths";

interface AntardashaAccordionProps {
    antardasha: Antardasha;
    isActive: boolean;
    activeVdIndex: number | null;
    activeSkIndex: number | null;
    activePrIndex: number | null;
    path: string;
    expandedPaths: ReadonlySet<string>;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    renderDashaNumbers: (planet: number) => ReactNode;
}

function AntardashaAccordion({
    antardasha,
    isActive,
    activeVdIndex,
    activeSkIndex,
    activePrIndex,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
    renderDashaNumbers,
}: AntardashaAccordionProps) {
    const isExpanded = expandedPaths.has(path);
    const hasVidasa = antardasha.vidasa && antardasha.vidasa.length > 0;

    const handleToggle = useCallback(() => {
        onToggle(path);
    }, [onToggle, path]);

    return (
        <div role="treeitem" aria-expanded={isExpanded} aria-current={isActive ? "true" : undefined}>
            <div
                role="button"
                tabIndex={0}
                data-dasha-path={path}
                aria-label={`${getPlanetName(antardasha.planet)} Antardasha`}
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 py-2 px-2 ml-4 text-sm cursor-pointer select-none transition-colors ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
            >
                <span
                    className={`inline-block transition-transform duration-200 text-gray-400 text-xs ${isExpanded ? "rotate-180" : ""}`}
                >
                    {String.fromCharCode(0x25b8)}
                </span>
                <span
                    className="inline-flex items-center justify-center w-4 h-4 text-xs"
                    style={{
                        color: PLANET_COLORS[antardasha.planet] ?? "#374151",
                        fontWeight: 300,
                    }}
                >
                    {PLANET_SYMBOLS[antardasha.planet] ?? ""}
                </span>
                <span className="text-gray-700 font-medium">{getPlanetName(antardasha.planet)}</span>
                <span className="text-xs text-gray-400 ml-1">{getDashaLevelName("antardasha")}</span>
                {renderDashaNumbers(antardasha.planet)}
                <span className="text-gray-400 ml-auto text-xs">
                    {antardasha.startDate ? (
                        <>
                            {antardasha.startDate} &mdash; {antardasha.endDate}
                            <span className="text-gray-500 ml-1">(age {Math.floor(antardasha.startAge)}y)</span>
                        </>
                    ) : (
                        <>
                            age
                            <span className="text-gray-500 ml-1">({Math.floor(antardasha.startAge)}y)</span>
                        </>
                    )}
                </span>
                <span className="text-gray-400 whitespace-nowrap text-xs">
                    {formatMonthDuration(antardasha.durationMonths)}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasVidasa && isExpanded && (
                <div>
                    {antardasha.vidasa.map((vd, vdIdx) => {
                        const vdPath = `${path}/vd:${vdIdx}`;
                        const isActiveVd = isActive && vdIdx === activeVdIndex;
                        return (
                            <VidasaAccordion
                                key={vdIdx}
                                vidasa={vd}
                                isActive={isActiveVd}
                                activeSkIndex={isActiveVd ? activeSkIndex : null}
                                activePrIndex={isActiveVd ? activePrIndex : null}
                                path={vdPath}
                                expandedPaths={pathsFor(expandedPaths, vdPath)}
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

export default memo(AntardashaAccordion);
