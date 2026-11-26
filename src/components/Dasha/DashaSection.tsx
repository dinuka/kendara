"use client";

import { PHONE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useDashaDisplay } from "@/hooks/useTablePreferences";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Dashas, Planet } from "@/lib/astrology";
import { computeDashaNumbers } from "@/lib/dashaNumbers";
import { parseDashaDate, pranasOf } from "@/lib/pranaDasha";

import CurrentPeriodBadge from "./CurrentPeriodBadge";
import { DashaDisplayContext } from "./DashaDisplayContext";
import DashaDisplayMenu from "./DashaDisplayMenu";
import DashaNumberTags from "./DashaNumberTags";
import DashaPlanetTags from "./DashaPlanetTags";
import type { PlanetTag } from "./DashaPlanetTags";
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
    /** Text tags per planet id (22nd drekkana lord, pushkara, uchcha/neecha, …) shown after the numbers. */
    planetTags: Record<number, PlanetTag[]>;
}

interface Period {
    startDate: string;
    endDate: string;
}

function findActivePeriodIndex(periods: Period[] | undefined, now: Date): number | null {
    if (!periods) return null;
    for (let i = 0; i < periods.length; i++) {
        const start = parseDashaDate(periods[i].startDate);
        const end = parseDashaDate(periods[i].endDate);
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

    // Stored trees stop at Sukshama; Prana is derived on demand.
    indices[4] = findActivePeriodIndex(pranasOf(vdNode.sukshama[sk]), now);
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
    planetTags,
}: DashaSectionProps) {
    const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
    const [scrollTarget, setScrollTarget] = useState<string | null>(null);
    const [currentDate] = useState(() => new Date());
    const { display } = useDashaDisplay();
    const { fields } = display;

    const activeIndices = useMemo(() => findActiveIndices(dashas, currentDate), [dashas, currentDate]);
    const [activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex, activePrIndex] = activeIndices;
    const isPhone = useMediaQuery(PHONE_QUERY);

    // The stored current period has no Prana lord (the tree stops at Sukshama) — fill it from the
    // derived Prana so the "Current" summary reaches Prana too.
    const currentPeriod = useMemo(() => {
        const period = dashas?.currentPeriod;
        if (!period || period.pranaLord || activePrIndex === null || activeSkIndex === null) return period;
        const sk =
            dashas?.mahadasha[activeMdIndex ?? -1]?.antardasha[activeAdIndex ?? -1]?.vidasa[activeVdIndex ?? -1]
                ?.sukshama[activeSkIndex];
        const pranaLord = sk ? pranasOf(sk)[activePrIndex]?.planet : undefined;
        return pranaLord ? { ...period, pranaLord } : period;
    }, [dashas, activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex, activePrIndex]);

    // Open the running period down to the sukshama level (prana rows have no children).
    useEffect(() => {
        if (activeMdIndex === null) return;
        const deepest = buildPath(activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex);
        setExpandedPaths(new Set(ancestorPaths(deepest)));
    }, [activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex]);

    // Phones: the running period usually sits below the fold under the collapsed earlier periods,
    // so bring its deepest row into view once on open (desktop keeps its position).
    useEffect(() => {
        if (!isPhone || activeMdIndex === null) return;
        setScrollTarget(buildPath(activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex, activePrIndex));
    }, [isPhone, activeMdIndex, activeAdIndex, activeVdIndex, activeSkIndex, activePrIndex]);

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
            <>
                <DashaNumberTags
                    numbers={dashaNumbers[planet]}
                    getPlanetName={getPlanetName}
                    getSignName={getSignName}
                    showOwn={fields.ownNumbers}
                    showNakshatraLord={fields.nakshatraNumbers}
                    showConjunctions={fields.conjunctionNumbers}
                />
                {fields.planetTags && <DashaPlanetTags tags={planetTags[planet]} />}
            </>
        ),
        [
            dashaNumbers,
            getPlanetName,
            getSignName,
            planetTags,
            fields.ownNumbers,
            fields.nakshatraNumbers,
            fields.conjunctionNumbers,
            fields.planetTags,
        ],
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
        <DashaDisplayContext.Provider value={display}>
            <div className="flex justify-end mb-2">
                <DashaDisplayMenu getDashaLevelName={getDashaLevelName} />
            </div>
            <CurrentPeriodBadge
                currentPeriod={currentPeriod ?? dashas.currentPeriod}
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
        </DashaDisplayContext.Provider>
    );
}
