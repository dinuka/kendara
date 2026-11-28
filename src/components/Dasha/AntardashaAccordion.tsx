"use client";

import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import type { Antardasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatMonthDuration } from "@/lib/astrology";

import { useDashaRowDisplay } from "./DashaDisplayContext";
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
    const { fields, depth } = useDashaRowDisplay();
    const hasVidasa = depth >= 3 && antardasha.vidasa && antardasha.vidasa.length > 0;
    const isExpanded = hasVidasa && expandedPaths.has(path);

    const handleToggle = useCallback(() => {
        if (hasVidasa) onToggle(path);
    }, [onToggle, path, hasVidasa]);

    return (
        <div role="treeitem" aria-expanded={hasVidasa ? isExpanded : undefined} aria-current={isActive ? "true" : undefined}
            aria-selected={isActive}>
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
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 px-2 ml-2 sm:ml-4 text-sm cursor-pointer select-none transition-colors ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
            >
                <span
                    className={`inline-block w-2 transition-transform duration-200 text-gray-400 text-xs ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                >
                    {hasVidasa && String.fromCharCode(0x25b8)}
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
                {fields.levelName && (
                    <span className="text-xs text-gray-400 ml-1">{getDashaLevelName("antardasha")}</span>
                )}
                {renderDashaNumbers(antardasha.planet)}
                <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 text-xs text-gray-400">
                    {fields.dates && antardasha.startDate && (
                        <span>
                            {antardasha.startDate} &mdash; {antardasha.endDate}
                        </span>
                    )}
                    {(fields.age || !antardasha.startDate) && (
                        <span className="text-gray-500">(age {Math.floor(antardasha.startAge)}y)</span>
                    )}
                    {fields.duration && (
                        <span className="whitespace-nowrap">{formatMonthDuration(antardasha.durationMonths)}</span>
                    )}
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
