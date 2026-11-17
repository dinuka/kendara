"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Dashas, Planet } from "@/lib/astrology";
import { computeDashaNumbers } from "@/lib/dashaNumbers";

import CurrentPeriodBadge from "./CurrentPeriodBadge";
import DashaNumberTags from "./DashaNumberTags";
import DashaTimeline from "./DashaTimeline";
import { ancestorPaths, buildPath } from "./expandedPaths";

interface DashaSectionProps {
    dashas: Dashas | null;
    getPlanetName: (id: number) => string;
    getDashaLevelName: (level: string) => string;
    getSignName: (id: number) => string;
    planets: Planet[];
    lagnaSign: number;
    /** Nakshatra lord numbers are only shown when the chart has reliable nakshatra data. */
    showNakshatraNumbers: boolean;
}

interface Period {
    startDate: string;
    endDate: string;
}

function findActivePeriodIndex(periods: Period[] | undefined, now: Date): number | null {
    if (!periods) return null;
    for (let i = 0; i < periods.length; i++) {
        const start = new Date(periods[i].startDate);
        const end = new Date(periods[i].endDate);
        if (start <= now && now < end) return i;
    }
    return null;
}

/** Walks down the tree to the running period at each level: [md, ad, vd, sk, pr]. */
function findActiveIndices(dashas: Dashas | null, now: Date): (number | null)[] {
    const indices: (number | null)[] = [null, null, null, null, null];
    if (!dashas?.mahadasha) return indices;

    const md = findActivePeriodIndex(dashas.mahadasha, now);
    indices[0] = md;
    if (md === null) return indices;

    const mdNode = dashas.mahadasha[md];
    const ad = findActivePeriodIndex(mdNode.antardasha, now);
    indices[1] = ad;
    if (ad === null) return indices;

    const adNode = mdNode.antardasha[ad];
    const vd = findActivePeriodIndex(adNode.vidasa, now);
    indices[2] = vd;
    if (vd === null) return indices;

    const vdNode = adNode.vidasa[vd];
    const sk = findActivePeriodIndex(vdNode.sukshama, now);
    indices[3] = sk;
    if (sk === null) return indices;

    indices[4] = findActivePeriodIndex(vdNode.sukshama[sk].prana, now);
    return indices;
}

export default function DashaSection({
    dashas,
    getPlanetName,
    getDashaLevelName,
    getSignName,
    planets,
    lagnaSign,
    showNakshatraNumbers,
}: DashaSectionProps) {
    const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
    const [scrollTarget, setScrollTarget] = useState<string | null>(null);
    const [currentDate] = useState(() => new Date());

    const activeIndices = useMemo(() => findActiveIndices(dashas, currentDate), [dashas, currentDate]);
    const [activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex, activePrIndex] = activeIndices;

    // Open the running period down to the sukshama level (prana rows have no children).
    useEffect(() => {
        if (activeMdIndex === null) return;
        const deepest = buildPath(activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex);
        setExpandedPaths(new Set(ancestorPaths(deepest)));
    }, [activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex]);

    // Children mount only once their parent is open, so scroll after the expansion has rendered.
    useEffect(() => {
        if (!scrollTarget) return;
        const frame = requestAnimationFrame(() => {
            document
                .querySelector(`[data-dasha-path="${scrollTarget}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            setScrollTarget(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [scrollTarget, expandedPaths]);

    const dashaNumbers = useMemo(
        () => computeDashaNumbers(planets, lagnaSign, showNakshatraNumbers),
        [planets, lagnaSign, showNakshatraNumbers],
    );

    const renderDashaNumbers = useCallback(
        (planet: number) => (
            <DashaNumberTags numbers={dashaNumbers[planet]} getPlanetName={getPlanetName} getSignName={getSignName} />
        ),
        [dashaNumbers, getPlanetName, getSignName],
    );

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
            // Prana rows are leaves: open everything above the target, but never the leaf itself.
            const toOpen = ancestorPaths(path).filter((p) => !p.split("/").pop()?.startsWith("pr:"));
            toOpen.forEach((p) => next.add(p));
            return next;
        });
        setScrollTarget(path);
    }, []);

    if (!dashas || !dashas.mahadasha || dashas.mahadasha.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">Dasha data not available.</div>;
    }

    return (
        <div>
            <CurrentPeriodBadge
                currentPeriod={dashas.currentPeriod}
                mahadashaList={dashas.mahadasha}
                activeIndices={activeIndices}
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
                activePrIndex={activePrIndex}
                getPlanetName={getPlanetName}
                getDashaLevelName={getDashaLevelName}
                renderDashaNumbers={renderDashaNumbers}
            />
        </div>
    );
}
