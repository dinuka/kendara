"use client";

import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";

import type { Sukshama } from "@/lib/astrology";
import { pranasOf } from "@/lib/pranaDasha";
import { PLANET_COLORS, PLANET_SYMBOLS, formatDayDuration } from "@/lib/astrology";

import { useDashaRowDisplay } from "./DashaDisplayContext";
import PranaRow from "./PranaRow";

interface SukshamaAccordionProps {
    sukshama: Sukshama;
    isActive: boolean;
    activePrIndex: number | null;
    path: string;
    /** Sukshama is the deepest accordion level, so it only needs its own open state. */
    isExpanded: boolean;
    onToggle: (path: string) => void;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    renderDashaNumbers: (planet: number) => ReactNode;
}

function SukshamaAccordion({
    sukshama,
    isActive,
    activePrIndex,
    path,
    isExpanded,
    onToggle,
    getPlanetName,
    getDashaLevelName,
    renderDashaNumbers,
}: SukshamaAccordionProps) {
    const { fields, depth } = useDashaRowDisplay();
    // Stored trees stop at Sukshama; Prana rows are derived on demand, only while this row is open.
    const hasPrana = depth >= 5;
    const pranas = useMemo(() => (hasPrana && isExpanded ? pranasOf(sukshama) : []), [hasPrana, isExpanded, sukshama]);

    const handleToggle = useCallback(() => {
        onToggle(path);
    }, [onToggle, path]);

    return (
        <div role="treeitem" aria-expanded={hasPrana ? isExpanded : undefined} aria-current={isActive ? "true" : undefined}
            aria-selected={isActive}>
            <div
                role="button"
                tabIndex={0}
                data-dasha-path={path}
                aria-label={`${getPlanetName(sukshama.planet)} Sukshama`}
                onClick={hasPrana ? handleToggle : undefined}
                onKeyDown={(e) => {
                    if (hasPrana && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 px-2 ml-6 sm:ml-12 text-xs cursor-pointer select-none transition-colors ${hasPrana ? "" : "cursor-default"} ${isActive ? "border-l-3 border-indigo-700 bg-indigo-100 rounded" : "hover:bg-gray-50/50"}`}
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
                    style={{
                        color: PLANET_COLORS[sukshama.planet] ?? "#374151",
                        fontWeight: 300,
                    }}
                >
                    {PLANET_SYMBOLS[sukshama.planet] ?? ""}
                </span>
                <span className="text-gray-600 font-medium">{getPlanetName(sukshama.planet)}</span>
                {fields.levelName && (
                    <span className="text-[10px] text-gray-400 ml-1">{getDashaLevelName("sukshama")}</span>
                )}
                {renderDashaNumbers(sukshama.planet)}
                <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 text-gray-400">
                    {fields.dates && (
                        <span>
                            {sukshama.startDate} &mdash; {sukshama.endDate}
                        </span>
                    )}
                    {fields.age && <span className="text-gray-500">(age {Math.floor(sukshama.startAge)}y)</span>}
                    {fields.duration && (
                        <span className="whitespace-nowrap">{formatDayDuration(sukshama.durationDays)}</span>
                    )}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Active
                    </span>
                )}
            </div>
            {hasPrana && isExpanded && (
                <div className="border-l border-gray-100 ml-2 sm:ml-[18px]">
                    {pranas.map((pr, prIdx) => (
                        <PranaRow
                            key={prIdx}
                            prana={pr}
                            path={`${path}/pr:${prIdx}`}
                            isActive={isActive && prIdx === activePrIndex}
                            getPlanetName={getPlanetName}
                            getDashaLevelName={getDashaLevelName}
                            renderDashaNumbers={renderDashaNumbers}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default memo(SukshamaAccordion);
