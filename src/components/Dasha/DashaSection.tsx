"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import DashaTimeline from "./DashaTimeline";
import type { Dashas, Mahadasha } from "@/lib/astrology";

import CurrentPeriodBadge from "./CurrentPeriodBadge";

interface DashaSectionProps {
    dashas: Dashas | null;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
}

function findActivePeriodIndex(periods: { startDate: string; endDate: string }[], now: Date): number | null {
    for (let i = 0; i < periods.length; i++) {
        const start = new Date(periods[i].startDate);
        const end = new Date(periods[i].endDate);
        if (start <= now && now < end) return i;
    }
    return null;
}

function buildPath(mdIndex: number, adIndex?: number, vdIndex?: number, skIndex?: number): string {
    let path = `md:${mdIndex}`;
    if (adIndex !== undefined) path += `/ad:${adIndex}`;
    if (vdIndex !== undefined) path += `/vd:${vdIndex}`;
    if (skIndex !== undefined) path += `/sk:${skIndex}`;
    return path;
}

export default function DashaSection({ dashas, getPlanetName, getDashaLevelName }: DashaSectionProps) {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [currentDate] = useState(() => new Date());

    const activeMdIndex = useMemo(() => {
        if (!dashas) return null;
        return findActivePeriodIndex(dashas.mahadasha, currentDate);
    }, [dashas, currentDate]);

    const activeAdIndex = useMemo(() => {
        if (!dashas || activeMdIndex === null) return null;
        const md = dashas.mahadasha[activeMdIndex];
        return findActivePeriodIndex(md.antardasha, currentDate);
    }, [dashas, activeMdIndex, currentDate]);

    const activeVdIndex = useMemo(() => {
        if (!dashas || activeMdIndex === null || activeAdIndex === null) return null;
        const md = dashas.mahadasha[activeMdIndex];
        const ad = md.antardasha[activeAdIndex];
        if (!ad || !ad.vidasa) return null;
        return findActivePeriodIndex(ad.vidasa, currentDate);
    }, [dashas, activeMdIndex, activeAdIndex, currentDate]);

    const activeSkIndex = useMemo(() => {
        if (!dashas || activeMdIndex === null || activeAdIndex === null || activeVdIndex === null) return null;
        const md = dashas.mahadasha[activeMdIndex];
        const ad = md.antardasha[activeAdIndex];
        if (!ad || !ad.vidasa) return null;
        const vd = ad.vidasa[activeVdIndex];
        if (!vd || !vd.sukshama) return null;
        return findActivePeriodIndex(vd.sukshama, currentDate);
    }, [dashas, activeMdIndex, activeAdIndex, activeVdIndex, currentDate]);

    useEffect(() => {
        if (activeMdIndex !== null) {
            const paths = new Set<string>();
            const activePath = buildPath(activeMdIndex);
            paths.add(activePath);

            if (activeAdIndex !== null) {
                const adPath = buildPath(activeMdIndex, activeAdIndex);
                paths.add(adPath);

                if (activeVdIndex !== null) {
                    const vdPath = buildPath(activeMdIndex, activeAdIndex, activeVdIndex);
                    paths.add(vdPath);

                    if (activeSkIndex !== null) {
                        const skPath = buildPath(activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex);
                        paths.add(skPath);
                    }
                }
            }

            setExpandedPaths(paths);
        }
    }, [activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex]);

    const handleToggle = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleJumpToPeriod = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.add(path);
            return next;
        });
    }, []);

    if (!dashas || !dashas.mahadasha || dashas.mahadasha.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">Dasha data not available.</div>;
    }

    return (
        <div>
            <CurrentPeriodBadge
                currentPeriod={dashas.currentPeriod}
                mahadashaList={dashas.mahadasha}
                onJumpToPeriod={handleJumpToPeriod}
                getPlanetName={getPlanetName}
            />
            <DashaTimeline
                mahadasha={dashas.mahadasha}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                activeMdIndex={activeMdIndex}
                activeAdIndex={activeAdIndex}
                activeVdIndex={activeVdIndex}
                activeSkIndex={activeSkIndex}
                getPlanetName={getPlanetName}
                getDashaLevelName={getDashaLevelName}
            />
        </div>
    );
}
