"use client";

import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import type { Mahadasha } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, formatYearDuration } from "@/lib/astrology";

import AntardashaAccordion from "./AntardashaAccordion";
import { useDashaRowDisplay } from "./DashaDisplayContext";
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
    const { fields, depth } = useDashaRowDisplay();
    const hasAntardasha = depth >= 2 && mahadasha.antardasha && mahadasha.antardasha.length > 0;
    const isExpanded = hasAntardasha && expandedPaths.has(path);

    const handleToggle = useCallback(() => {
        if (hasAntardasha) onToggle(path);
    }, [onToggle, path, hasAntardasha]);

    return (
        <div
            role="treeitem"
            aria-expanded={hasAntardasha ? isExpanded : undefined}
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
                className={`flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 py-3 px-3 sm:px-4 cursor-pointer select-none transition-colors ${
                    isActive ? "border-l-3 border-indigo-700 bg-indigo-100" : "hover:bg-gray-50"
                }`}
            >
                <span
                    className={`inline-block w-2.5 transition-transform duration-200 text-gray-400 text-sm ${
                        isExpanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                >
                    {hasAntardasha && String.fromCharCode(0x25b8)}
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
                {fields.levelName && (
                    <span className="text-xs text-gray-400">{getDashaLevelName("mahadasha")}</span>
                )}
                {renderDashaNumbers(mahadasha.planet)}
                <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 text-xs text-gray-400">
                    {fields.dates && mahadasha.startDate && (
                        <span>
                            {mahadasha.startDate} &mdash; {mahadasha.endDate}
                        </span>
                    )}
                    {(fields.age || !mahadasha.startDate) && (
                        <span className="text-gray-500">
                            {!mahadasha.startDate && "age "}({formatYearDuration(mahadasha.startAge)})
                        </span>
                    )}
                    {fields.duration && (
                        <span className="whitespace-nowrap">{formatYearDuration(mahadasha.durationYears)}</span>
                    )}
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
