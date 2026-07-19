"use client";

import type { Mahadasha } from "@/lib/astrology";

import MahadashaAccordion from "./MahadashaAccordion";

interface DashaTimelineProps {
    mahadasha: Mahadasha[];
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    activeMdIndex: number | null;
    activeAdIndex: number | null;
    activeVdIndex: number | null;
    activeSkIndex: number | null;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

export default function DashaTimeline({
    mahadasha,
    expandedPaths,
    onToggle,
    activeMdIndex,
    activeAdIndex,
    activeVdIndex,
    activeSkIndex,
    getPlanetName,
    getDashaLevelName,
}: DashaTimelineProps) {
    if (!mahadasha || mahadasha.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">Dasha data not available.</div>;
    }

    return (
        <div role="tree" aria-label="Dasha timeline" className="space-y-1">
            {mahadasha.map((md, mdIdx) => {
                const mdPath = `md:${mdIdx}`;
                return (
                    <MahadashaAccordion
                        key={mdIdx}
                        mahadasha={md}
                        isActive={activeMdIndex === mdIdx}
                        defaultExpanded={activeMdIndex === mdIdx}
                        activeAdIndex={mdIdx === activeMdIndex ? activeAdIndex : null}
                        activeVdIndex={mdIdx === activeMdIndex ? activeVdIndex : null}
                        activeSkIndex={mdIdx === activeMdIndex ? activeSkIndex : null}
                        path={mdPath}
                        expandedPaths={expandedPaths}
                        onToggle={onToggle}
                        getPlanetName={getPlanetName}
                        getDashaLevelName={getDashaLevelName}
                    />
                );
            })}
        </div>
    );
}
