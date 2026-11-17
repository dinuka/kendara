"use client";

import type { ReactNode } from "react";

import type { Mahadasha } from "@/lib/astrology";

import MahadashaAccordion from "./MahadashaAccordion";
import { pathsFor } from "./expandedPaths";

interface DashaTimelineProps {
    mahadasha: Mahadasha[];
    expandedPaths: ReadonlySet<string>;
    onToggle: (path: string) => void;
    activeMdIndex: number | null;
    activeAdIndex: number | null;
    activeVdIndex: number | null;
    activeSkIndex: number | null;
    activePrIndex: number | null;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    renderDashaNumbers: (planet: number) => ReactNode;
}

export default function DashaTimeline({
    mahadasha,
    expandedPaths,
    onToggle,
    activeMdIndex,
    activeAdIndex,
    activeVdIndex,
    activeSkIndex,
    activePrIndex,
    getPlanetName,
    getDashaLevelName,
    renderDashaNumbers,
}: DashaTimelineProps) {
    if (!mahadasha || mahadasha.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">Dasha data not available.</div>;
    }

    return (
        <div role="tree" aria-label="Dasha timeline" className="space-y-1">
            {mahadasha.map((md, mdIdx) => {
                const mdPath = `md:${mdIdx}`;
                const isActive = activeMdIndex === mdIdx;
                return (
                    <MahadashaAccordion
                        key={mdIdx}
                        mahadasha={md}
                        isActive={isActive}
                        activeAdIndex={isActive ? activeAdIndex : null}
                        activeVdIndex={isActive ? activeVdIndex : null}
                        activeSkIndex={isActive ? activeSkIndex : null}
                        activePrIndex={isActive ? activePrIndex : null}
                        path={mdPath}
                        expandedPaths={pathsFor(expandedPaths, mdPath)}
                        onToggle={onToggle}
                        getPlanetName={getPlanetName}
                        getDashaLevelName={getDashaLevelName}
                        renderDashaNumbers={renderDashaNumbers}
                    />
                );
            })}
        </div>
    );
}
