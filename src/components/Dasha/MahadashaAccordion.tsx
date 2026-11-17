"use client";

import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import type { Mahadasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatYearDuration } from "@/lib/astrology";

import AntardashaAccordion from "./AntardashaAccordion";
import { pathsFor } from "./expandedPaths";

interface MahadashaAccordionProps {
    mahadasha: Mahadasha;
    isActive: boolean;
    activeAdIndex: number | null;
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

function MahadashaAccordion({
    mahadasha,
    isActive,
    activeAdIndex,
    activeVdIndex,
    activeSkIndex,
    activePrIndex,
    path,
    expandedPaths,
    onToggle,
    getPlanetName,
    getDashaLevelName,
    renderDashaNumbers,
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
                data-dasha-path={path}
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
                    style={{
                        color: PLANET_COLORS[mahadasha.planet] ?? "#374151",
                        fontWeight: 300,
                    }}
                >
                    {PLANET_SYMBOLS[mahadasha.planet] ?? ""}
                </span>
                <span className="font-semibold text-gray-800 text-sm">{getPlanetName(mahadasha.planet)}</span>
                <span className="text-xs text-gray-400">{getDashaLevelName("mahadasha")}</span>
                {renderDashaNumbers(mahadasha.planet)}
                <span className="text-xs text-gray-400 ml-auto">
                    {mahadasha.startDate ? (
                        <>
                            {mahadasha.startDate} &mdash; {mahadasha.endDate}
                        </>
                    ) : (
                        <span className="text-gray-400">age</span>
                    )}
                    <span className="text-gray-500 ml-2">({formatYearDuration(mahadasha.startAge)})</span>
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatYearDuration(mahadasha.durationYears)}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {/* Children are only mounted while open — a full Vimshottari tree is ~66k rows. */}
            {hasAntardasha && isExpanded && (
                <div className="border-t border-gray-100">
                    {mahadasha.antardasha.map((ad, adIdx) => {
                        const adPath = `${path}/ad:${adIdx}`;
                        const isActiveAd = isActive && adIdx === activeAdIndex;
                        return (
                            <AntardashaAccordion
                                key={adIdx}
                                antardasha={ad}
                                isActive={isActiveAd}
                                activeVdIndex={isActiveAd ? activeVdIndex : null}
                                activeSkIndex={isActiveAd ? activeSkIndex : null}
                                activePrIndex={isActiveAd ? activePrIndex : null}
                                path={adPath}
                                expandedPaths={pathsFor(expandedPaths, adPath)}
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

export default memo(MahadashaAccordion);
