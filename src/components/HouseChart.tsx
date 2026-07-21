"use client";

import { useI18n } from "@/hooks/useI18n";
import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { Ascendant, CurrentPlanetRecord, House, Planet } from "@/lib/astrology";
import { PLANET_COLORS, PLANET_SYMBOLS, navamsaSign } from "@/lib/astrology";
import { NAKSHATRA_SHORT_SI, PLANET_SHORT_SI, SIGN_SHORT_SI } from "@/lib/chartVisuals";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.2;

interface HouseChartProps {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
    horoscopeId?: string;
}

type Point = [number, number];

const SIZE = 780;
const CX = SIZE / 2;
const CY = SIZE / 2;

// Ring radii, outermost to innermost: Nakshatra -> Pada -> Navamsa -> Sign -> House. Leaves
// headroom out to SIZE/2 (390) for staggered planet markers (base + several overlap-avoidance
// steps, up to a full 9-planet cluster) so they can't clip the SVG viewport.
const R_PLANET_BASE = 200;
// Larger than the marker diameter (22) plus its direction-arrow badge, so radially-staggered
// markers in a cluster have real clearance and don't visually overlap each other or each other's
// arrows.
const R_PLANET_STEP = 34;
const R_NAKSHATRA_OUTER = 186;
const R_NAKSHATRA_INNER = 162;
const R_PADA_INNER = 148;
const R_NAVAMSA_OUTER = R_PADA_INNER;
const R_NAVAMSA_INNER = 124;
const R_SIGN_OUTER = R_NAVAMSA_INNER;
const R_SIGN_INNER = 100;
const R_HOUSE_OUTER = R_SIGN_INNER;
const R_HOUSE_INNER = 76; // same 24px band thickness as the Nakshatra/Navamsa/Sign rings
const R_LAGNA_LABEL = R_NAKSHATRA_OUTER + 14;

const CURRENT_BORDER_COLOR = "#0EA5E9";
const R_CURRENT_BASE = R_PLANET_BASE + 2 * R_PLANET_STEP;
const MERGE_THRESHOLD_DEG = 2;

const HIGHLIGHT_SIGN = "#fed7aa"; // ascendant's sign wedge (ring 4), orange-ish
const HIGHLIGHT_HOUSE = "#fef08a"; // house-1 wedge (ring 5), yellow-ish
const HIGHLIGHT_NAVAMSA = "#fef08a"; // ascendant's navamsa wedge (ring 3), yellow-ish
const HIGHLIGHT_SELECTED = "#86efac"; // wedge containing a clicked planet/lagna, across all rings

/** True if `absDeg` falls within the wedge spanning [start, end) (both in absolute-degree space,
 *  end may exceed 360 to represent a wrap) — used to test whether a clicked planet/lagna degree
 *  lands inside a given ring wedge, for the click-to-highlight interaction. */
function degreeInWedge(absDeg: number, start: number, end: number): boolean {
    const normalized = ((absDeg % 360) + 360) % 360;
    if (end <= 360) return normalized >= start && normalized < end;
    return normalized >= start || normalized < end - 360;
}

const NAKSHATRA_SPAN = 360 / 27;
const PADA_SPAN = NAKSHATRA_SPAN / 4;
const NAVAMSA_SPAN = 30 / 9;

/** Converts an absolute ecliptic degree (0-360) to a screen point, anchored so `ascAbsDeg` sits
 *  at 12 o'clock and increasing degree runs counterclockwise (standard Vedic wheel convention,
 *  confirmed against the reference image). */
function polar(absDeg: number, ascAbsDeg: number, r: number): Point {
    const screenAngleDeg = ascAbsDeg - absDeg - 90;
    const rad = (screenAngleDeg * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

/** Builds an SVG path for one annulus-sector ("ring wedge") spanning absolute degrees
 *  `startAbsDeg` -> `endAbsDeg` (degree-increasing = counterclockwise on screen). Degrees are
 *  taken as-is (not modded), so callers must pass endAbsDeg > startAbsDeg (add 360 across a wrap)
 *  to sweep the short way round. */
function ringWedgePath(
    innerR: number,
    outerR: number,
    startAbsDeg: number,
    endAbsDeg: number,
    ascAbsDeg: number,
): string {
    const [ox1, oy1] = polar(startAbsDeg, ascAbsDeg, outerR);
    const [ox2, oy2] = polar(endAbsDeg, ascAbsDeg, outerR);
    const [ix1, iy1] = polar(startAbsDeg, ascAbsDeg, innerR);
    const [ix2, iy2] = polar(endAbsDeg, ascAbsDeg, innerR);
    const span = endAbsDeg - startAbsDeg;
    const largeArc = span > 180 ? 1 : 0;
    // Increasing absDeg sweeps counterclockwise on screen (see `polar`), which is sweep-flag 0
    // in SVG's y-down coordinate system for the outer arc, and 1 for the inner arc traversed
    // in the opposite direction to close the path without self-intersecting.
    return [
        `M ${ix1} ${iy1}`,
        `L ${ox1} ${oy1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 0 ${ox2} ${oy2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 1 ${ix1} ${iy1}`,
        "Z",
    ].join(" ");
}

/** Radial, mid-angle text label for a ring wedge — rotated so glyphs read outward along the
 *  wedge's bisector, matching the reference image's radially-angled ring text. */
function ringLabel(
    text: string,
    midAbsDeg: number,
    ascAbsDeg: number,
    radius: number,
    fontSize: number,
    key: string | number,
    fill = "#1f2937",
): ReactElement {
    const [x, y] = polar(midAbsDeg, ascAbsDeg, radius);
    const screenAngleDeg = ascAbsDeg - midAbsDeg - 90;
    // Baseline runs tangent to the ring (perpendicular to the radius). Test THIS tangent angle
    // (not the radial position angle) for whether it would render upside-down — i.e. whether its
    // "up" direction points into the lower half of the circle — and flip 180 so text always
    // reads left-to-right without requiring the reader to tilt their head.
    const tangentDeg = screenAngleDeg + 90;
    const tangentNorm = ((tangentDeg % 360) + 360) % 360;
    const upsideDown = tangentNorm > 90 && tangentNorm < 270;
    const rotate = tangentDeg + (upsideDown ? 180 : 0);
    return (
        <text
            key={key}
            x={x}
            y={y}
            fontSize={fontSize}
            fill={fill}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${rotate} ${x} ${y})`}
        >
            {text}
        </text>
    );
}

export function HouseChart({ planets, houses, ascendant, horoscopeId }: HouseChartProps) {
    const { t } = useI18n();
    const [zoom, setZoom] = useState(1);
    const [selectedAbsDeg, setSelectedAbsDeg] = useState<number | null>(null);
    const [showCurrentPlanets, setShowCurrentPlanets] = useState(false);
    const [currentPlanets, setCurrentPlanets] = useState<CurrentPlanetRecord[] | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(false);
    const [errorCurrent, setErrorCurrent] = useState<string | null>(null);
    const today = new Date();
    const defaultDate = today.toISOString().slice(0, 10);
    const defaultTime = today.toTimeString().slice(0, 5);
    const [selectedDate, setSelectedDate] = useState(defaultDate);
    const [selectedTime, setSelectedTime] = useState(defaultTime);
    const [tooltipContent, setTooltipContent] = useState<{
        lines: string[];
        x: number;
        y: number;
    } | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const ascAbsDeg = (ascendant.sign - 1) * 30 + ascendant.degree;
    const ascNavamsaNum = Math.floor(ascendant.degree / NAVAMSA_SPAN) + 1;
    const ascNavamsaSign = navamsaSign(ascendant.sign, ascNavamsaNum);

    const fetchCurrentPlanets = useCallback(
        async (date?: string, time?: string) => {
            if (!horoscopeId) return;
            setLoadingCurrent(true);
            setErrorCurrent(null);
            try {
                const params = new URLSearchParams();
                if (date) params.set("date", date);
                if (time) params.set("time", time);
                const qs = params.toString();
                const url = `/api/horoscope/${horoscopeId}/current-planets${qs ? `?${qs}` : ""}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to load current planets");
                const data = await res.json();
                setCurrentPlanets(data.currentPlanets);
            } catch {
                setErrorCurrent(t("currentPlanets.error"));
                setShowCurrentPlanets(false);
            } finally {
                setLoadingCurrent(false);
            }
        },
        [horoscopeId, t],
    );

    const handleDateChange = (date: string, time: string) => {
        setSelectedDate(date);
        setSelectedTime(time);
        if (showCurrentPlanets && horoscopeId) {
            fetchCurrentPlanets(date, time);
        }
    };

    const handleToggle = () => {
        if (loadingCurrent) return;
        if (!showCurrentPlanets) {
            setShowCurrentPlanets(true);
            if (!currentPlanets) {
                fetchCurrentPlanets(selectedDate, selectedTime);
            }
        } else {
            setShowCurrentPlanets(false);
        }
    };

    const mergedPlanetNames = new Set<number>();
    if (currentPlanets && showCurrentPlanets) {
        currentPlanets.forEach((cp) => {
            const birthPlanet = planets.find((p) => p.name === cp.name);
            if (birthPlanet) {
                const diff = Math.abs(birthPlanet.absoluteDegree - cp.absoluteDegree);
                const wrappedDiff = Math.min(diff, 360 - diff);
                if (wrappedDiff < MERGE_THRESHOLD_DEG && birthPlanet.house === cp.house) {
                    mergedPlanetNames.add(cp.name);
                }
            }
        });
    }

    const visibleBirthPlanets = showCurrentPlanets ? planets.filter((p) => !mergedPlanetNames.has(p.name)) : planets;

    const visibleCurrentPlanets =
        showCurrentPlanets && currentPlanets ? currentPlanets.filter((cp) => !mergedPlanetNames.has(cp.name)) : [];

    const mergedBirthPlanets = showCurrentPlanets ? planets.filter((p) => mergedPlanetNames.has(p.name)) : [];

    const currentPlanetLookup = new Map<number, CurrentPlanetRecord>();
    if (currentPlanets) {
        currentPlanets.forEach((cp) => currentPlanetLookup.set(cp.name, cp));
    }

    // Ring 1: Nakshatra (27 wedges, 13°20' each).
    const nakshatraWedges = Array.from({ length: 27 }, (_, i) => {
        const id = i + 1;
        const start = i * NAKSHATRA_SPAN;
        const end = start + NAKSHATRA_SPAN;
        const mid = start + NAKSHATRA_SPAN / 2;
        const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
        return (
            <g key={id}>
                <path
                    d={ringWedgePath(R_NAKSHATRA_INNER, R_NAKSHATRA_OUTER, start, end, ascAbsDeg)}
                    fill={isSelected ? HIGHLIGHT_SELECTED : "#ffffff"}
                    stroke="#9ca3af"
                    strokeWidth={0.5}
                />
                {ringLabel(
                    NAKSHATRA_SHORT_SI[id],
                    mid,
                    ascAbsDeg,
                    (R_NAKSHATRA_INNER + R_NAKSHATRA_OUTER) / 2,
                    8,
                    `nak-${id}`,
                )}
            </g>
        );
    });

    // Ring 2: Pada (108 wedges, 3°20' each) — numeric label only, matches reference density.
    const padaWedges = Array.from({ length: 108 }, (_, i) => {
        const padaNum = (i % 4) + 1;
        const start = i * PADA_SPAN;
        const end = start + PADA_SPAN;
        const mid = start + PADA_SPAN / 2;
        const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
        return (
            <g key={i}>
                <path
                    d={ringWedgePath(R_PADA_INNER, R_NAKSHATRA_INNER, start, end, ascAbsDeg)}
                    fill={isSelected ? HIGHLIGHT_SELECTED : i % 2 === 0 ? "#f3f4f6" : "#e5e7eb"}
                    stroke="#9ca3af"
                    strokeWidth={0.3}
                />
                {ringLabel(
                    String(padaNum),
                    mid,
                    ascAbsDeg,
                    (R_PADA_INNER + R_NAKSHATRA_INNER) / 2,
                    6.5,
                    `pada-${i}`,
                    "#374151",
                )}
            </g>
        );
    });

    // Ring 3: Navamsa (108 wedges, 3°20' each) — styled like the Pada ring (small alternating
    // cells with a short numeric label), wedge identity resolved via navamsaSign(), not naive
    // sequential counting (movable/fixed/dual offset differs per sign).
    const navamsaWedges: ReactElement[] = [];
    for (let sign = 1; sign <= 12; sign++) {
        for (let n = 1; n <= 9; n++) {
            const start = (sign - 1) * 30 + (n - 1) * NAVAMSA_SPAN;
            const end = start + NAVAMSA_SPAN;
            const mid = start + NAVAMSA_SPAN / 2;
            const resolvedSign = navamsaSign(sign, n);
            const isAscNavamsa = sign === ascendant.sign && n === ascNavamsaNum;
            const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
            navamsaWedges.push(
                <g key={`nav-${sign}-${n}`}>
                    <path
                        d={ringWedgePath(R_NAVAMSA_INNER, R_NAVAMSA_OUTER, start, end, ascAbsDeg)}
                        fill={
                            isSelected
                                ? HIGHLIGHT_SELECTED
                                : isAscNavamsa
                                    ? HIGHLIGHT_NAVAMSA
                                    : n % 2 === 0
                                        ? "#f3f4f6"
                                        : "#e5e7eb"
                        }
                        stroke="#9ca3af"
                        strokeWidth={0.3}
                    />
                    {ringLabel(
                        String(resolvedSign),
                        mid,
                        ascAbsDeg,
                        (R_NAVAMSA_INNER + R_NAVAMSA_OUTER) / 2,
                        6.5,
                        `nav-label-${sign}-${n}`,
                        "#374151",
                    )}
                </g>,
            );
        }
    }

    // Ring 4: Sign (12 wedges, 30° each).
    const signWedges = Array.from({ length: 12 }, (_, i) => {
        const sign = i + 1;
        const start = i * 30;
        const end = start + 30;
        const mid = start + 15;
        const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
        return (
            <g key={sign}>
                <path
                    d={ringWedgePath(R_SIGN_INNER, R_SIGN_OUTER, start, end, ascAbsDeg)}
                    fill={isSelected ? HIGHLIGHT_SELECTED : sign === ascendant.sign ? HIGHLIGHT_SIGN : "#dbeafe"}
                    stroke="#9ca3af"
                    strokeWidth={0.5}
                />
                {ringLabel(SIGN_SHORT_SI[sign], mid, ascAbsDeg, (R_SIGN_INNER + R_SIGN_OUTER) / 2, 11, `sign-${sign}`)}
            </g>
        );
    });

    // Ring 5: House (12 unequal wedges from real cusps).
    const houseWedges = houses.map((h) => {
        let start = (h.startSign - 1) * 30 + h.startDegree;
        let end = (h.endSign - 1) * 30 + h.endDegree;
        if (end <= start) end += 360;
        const mid = (h.middleSign - 1) * 30 + h.middleDegree;
        const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
        const [midInnerX, midInnerY] = polar(mid, ascAbsDeg, R_HOUSE_INNER);
        const [midOuterX, midOuterY] = polar(mid, ascAbsDeg, R_HOUSE_OUTER);
        return (
            <g key={h.houseNumber}>
                <path
                    d={ringWedgePath(R_HOUSE_INNER, R_HOUSE_OUTER, start, end, ascAbsDeg)}
                    fill={isSelected ? HIGHLIGHT_SELECTED : h.houseNumber === 1 ? HIGHLIGHT_HOUSE : "#ffffff"}
                    stroke="#9ca3af"
                    strokeWidth={0.5}
                />
                <line x1={midInnerX} y1={midInnerY} x2={midOuterX} y2={midOuterY} stroke="#6b7280" strokeWidth={1} />
                {ringLabel(
                    String(h.houseNumber),
                    mid,
                    ascAbsDeg,
                    (R_HOUSE_INNER + R_HOUSE_OUTER) / 2,
                    11,
                    `house-${h.houseNumber}`,
                    "#dc2626",
                )}
            </g>
        );
    });

    // Lagna + planet markers share ONE collision-avoidance pass: the lagna label is a fixed point
    // at `ascAbsDeg` just like a planet is fixed at its own absoluteDegree, and planets frequently
    // cluster right around the ascendant's own degree (it sits inside some house/sign planets can
    // also occupy) — so the lagna must participate in the same radius-stagger system or it
    // collides with whichever planet lands nearest it, regardless of how well-spaced the planets
    // are from each other.
    type MarkerEntry = { kind: "lagna" } | { kind: "planet"; planet: Planet };
    const markerEntries: { entry: MarkerEntry; absDeg: number }[] = [
        { entry: { kind: "lagna" }, absDeg: ascAbsDeg },
        ...visibleBirthPlanets.map((planet) => ({
            entry: { kind: "planet" as const, planet },
            absDeg: planet.absoluteDegree,
        })),
    ];
    const sortedEntries = [...markerEntries].sort((a, b) => a.absDeg - b.absDeg);
    const ANGLE_THRESHOLD_DEG = 6;
    const entryPlacements: { entry: MarkerEntry; absDeg: number; radius: number }[] = [];
    sortedEntries.forEach((e, idx) => {
        let radius = R_PLANET_BASE;
        if (idx > 0) {
            const prev = entryPlacements[idx - 1];
            const gap = e.absDeg - prev.absDeg;
            if (gap < ANGLE_THRESHOLD_DEG) {
                radius = prev.radius + R_PLANET_STEP;
            }
        }
        entryPlacements.push({ entry: e.entry, absDeg: e.absDeg, radius });
    });
    // Circular wrap check: compare the last placement against the first.
    if (entryPlacements.length > 1) {
        const first = entryPlacements[0];
        const last = entryPlacements[entryPlacements.length - 1];
        const wrapGap = first.absDeg + 360 - last.absDeg;
        if (wrapGap < ANGLE_THRESHOLD_DEG && first.radius <= last.radius) {
            first.radius = last.radius + R_PLANET_STEP;
        }
    }

    const lagnaPlacement = entryPlacements.find((e) => e.entry.kind === "lagna")!;
    const lagnaRadius = R_LAGNA_LABEL + (lagnaPlacement.radius - R_PLANET_BASE);
    const placements = entryPlacements
        .filter(
            (e): e is { entry: { kind: "planet"; planet: Planet }; absDeg: number; radius: number } =>
                e.entry.kind === "planet",
        )
        .map((e) => ({ planet: e.entry.planet, radius: e.radius }));

    // Lagna line + label, spanning all 5 rings.
    const [lagnaOuterX, lagnaOuterY] = polar(ascAbsDeg, ascAbsDeg, R_NAKSHATRA_OUTER);
    const [lagnaLabelX, lagnaLabelY] = polar(ascAbsDeg, ascAbsDeg, lagnaRadius);

    // Current planet collision avoidance (separate from birth planets).
    type CurrentMarkerEntry = { kind: "current"; planet: CurrentPlanetRecord };
    const currentMarkerEntries: { entry: CurrentMarkerEntry; absDeg: number }[] = visibleCurrentPlanets.map((cp) => ({
        entry: { kind: "current" as const, planet: cp },
        absDeg: cp.absoluteDegree,
    }));
    const sortedCurrentEntries = [...currentMarkerEntries].sort((a, b) => a.absDeg - b.absDeg);
    const currentEntryPlacements: { entry: CurrentMarkerEntry; absDeg: number; radius: number }[] = [];
    sortedCurrentEntries.forEach((e, idx) => {
        let radius = R_CURRENT_BASE;
        if (idx > 0) {
            const prev = currentEntryPlacements[idx - 1];
            const gap = e.absDeg - prev.absDeg;
            if (gap < ANGLE_THRESHOLD_DEG) {
                radius = prev.radius + R_PLANET_STEP;
            }
        }
        currentEntryPlacements.push({ entry: e.entry, absDeg: e.absDeg, radius });
    });
    if (currentEntryPlacements.length > 1) {
        const first = currentEntryPlacements[0];
        const last = currentEntryPlacements[currentEntryPlacements.length - 1];
        const wrapGap = first.absDeg + 360 - last.absDeg;
        if (wrapGap < ANGLE_THRESHOLD_DEG && first.radius <= last.radius) {
            first.radius = last.radius + R_PLANET_STEP;
        }
    }

    const currentPlacements = currentEntryPlacements.map((e) => ({
        planet: e.entry.planet,
        radius: e.radius,
    }));

    // Crop the viewBox to what this chart actually draws.
    const MARKER_DRAW_RADIUS = 15;
    const CONTENT_PAD = 20;
    const allRadii = [lagnaRadius, ...placements.map((p) => p.radius), ...currentPlacements.map((p) => p.radius)];
    const maxMarkerRadius = Math.max(...allRadii) + MARKER_DRAW_RADIUS;
    const contentRadius = Math.min(SIZE / 2, Math.max(R_NAKSHATRA_OUTER, maxMarkerRadius) + CONTENT_PAD);
    const viewSize = contentRadius * 2;
    const viewOrigin = CX - contentRadius;

    // Helper to build a direction-arrow badge element.
    const renderArrow = (absDeg: number, radius: number, isBackward: boolean, keySuffix: string) => {
        const ARROW_STEP_DEG = 5;
        const arrowAbsDeg = isBackward ? absDeg - ARROW_STEP_DEG : absDeg + ARROW_STEP_DEG;
        const [ax, ay] = polar(arrowAbsDeg, ascAbsDeg, radius);
        const tangentDeg = ascAbsDeg - absDeg - 180;
        const arrowRotate = isBackward ? tangentDeg + 180 : tangentDeg;
        const arrowColor = isBackward ? "#dc2626" : "#16a34a";
        return (
            <g key={`arrow-${keySuffix}`} transform={`translate(${ax} ${ay}) rotate(${arrowRotate})`}>
                <path
                    d="M -4 0 L 4 0 M 1 -3 L 4 0 L 1 3"
                    fill="none"
                    stroke={arrowColor}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        );
    };

    const showTooltip = (
        name: number,
        degree: number,
        sign: number,
        houseNum: number | null,
        nakshatra: number,
        pada: number,
        retrograde: boolean,
        combustion: boolean,
        isCurrent: boolean,
        x: number,
        y: number,
    ) => {
        const lines: string[] = [];
        const planetName = t(`astrology.planetNames.${name}`);
        const suffix = isCurrent ? " (Current)" : " (Birth)";
        lines.push(`${planetName}${suffix}`);
        const signName = t(`astrology.signNames.${sign}`);
        const totalVikala = Math.round(degree * 3600);
        const anshaka = Math.floor(totalVikala / 3600);
        const kala = Math.floor((totalVikala % 3600) / 60);
        lines.push(`${signName} ${String(anshaka).padStart(2, "0")}:${String(kala).padStart(2, "0")}`);
        if (houseNum) lines.push(`House ${houseNum}`);
        const nakshatraName = t(`astrology.nakshatraNames.${nakshatra}`);
        lines.push(`Nakshatra: ${nakshatraName} (Pada ${pada})`);
        if (combustion) {
            lines.push("Combust");
        } else {
            lines.push(retrograde ? "Retrograde" : "Direct");
        }
        setTooltipContent({ lines, x, y });
    };

    const hideTooltip = () => setTooltipContent(null);

    const planetMarkers = placements.map(({ planet, radius }) => {
        const [mx, my] = polar(planet.absoluteDegree, ascAbsDeg, radius);
        const color = PLANET_COLORS[planet.name] || "#374151";
        const isSelected = selectedAbsDeg === planet.absoluteDegree;
        const isBackward = planet.retrograde || planet.name === 8 || planet.name === 9;
        return (
            <g
                key={`birth-${planet.name}`}
                onClick={() =>
                    setSelectedAbsDeg((prev) => (prev === planet.absoluteDegree ? null : planet.absoluteDegree))
                }
                onMouseEnter={() =>
                    showTooltip(
                        planet.name,
                        planet.degree,
                        planet.sign,
                        planet.house,
                        planet.nakshatra,
                        planet.pada,
                        planet.retrograde,
                        planet.combustion,
                        false,
                        mx,
                        my,
                    )
                }
                onMouseLeave={hideTooltip}
                className="cursor-pointer"
            >
                <line x1={CX} y1={CY} x2={mx} y2={my} stroke={color} strokeWidth={1} opacity={0.6} />
                <circle cx={mx} cy={my} r={11} fill={color} stroke={isSelected ? "#16a34a" : "none"} strokeWidth={2} />
                {renderArrow(planet.absoluteDegree, radius, isBackward, `birth-${planet.name}`)}
                <text
                    x={mx}
                    y={my}
                    fontSize={11}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight="bold"
                >
                    {PLANET_SHORT_SI[planet.name] || ""}
                </text>
            </g>
        );
    });

    const currentPlanetMarkers = currentPlacements.map(({ planet, radius }) => {
        const [mx, my] = polar(planet.absoluteDegree, ascAbsDeg, radius);
        const color = PLANET_COLORS[planet.name] || "#374151";
        const isSelected = selectedAbsDeg === planet.absoluteDegree;
        const isBackward = planet.retrograde || planet.name === 8 || planet.name === 9;
        const sinhalaLetter = PLANET_SHORT_SI[planet.name] || "";
        return (
            <g
                key={`current-${planet.name}`}
                onClick={() =>
                    setSelectedAbsDeg((prev) => (prev === planet.absoluteDegree ? null : planet.absoluteDegree))
                }
                onMouseEnter={() =>
                    showTooltip(
                        planet.name,
                        planet.degree,
                        planet.sign,
                        planet.house,
                        planet.nakshatra,
                        planet.pada,
                        planet.retrograde,
                        planet.combustion,
                        true,
                        mx,
                        my,
                    )
                }
                onMouseLeave={hideTooltip}
                className="cursor-pointer"
            >
                <line
                    x1={CX}
                    y1={CY}
                    x2={mx}
                    y2={my}
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.4}
                    strokeDasharray="3 2"
                />
                <circle
                    cx={mx}
                    cy={my}
                    r={13}
                    fill="#ffffff"
                    stroke={isSelected ? "#16a34a" : CURRENT_BORDER_COLOR}
                    strokeWidth={2.5}
                    opacity={0.85}
                />
                <circle cx={mx} cy={my} r={10} fill={color} stroke="none" opacity={0.85} />
                {renderArrow(planet.absoluteDegree, radius, isBackward, `current-${planet.name}`)}
                <text
                    x={mx}
                    y={my}
                    fontSize={11}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight="bold"
                >
                    {sinhalaLetter}
                </text>
            </g>
        );
    });

    const mergedSymbols = mergedBirthPlanets.map((birthPlanet) => {
        const currentPlanet = currentPlanetLookup.get(birthPlanet.name);
        // Find merged symbol's placement — reuse the birth planet's collision-avoidance radius.
        const placement = placements.find((p) => p.planet.name === birthPlanet.name);
        const radius = placement?.radius ?? R_PLANET_BASE;
        const [mx, my] = polar(birthPlanet.absoluteDegree, ascAbsDeg, radius);
        const color = PLANET_COLORS[birthPlanet.name] || "#374151";
        const isSelected = selectedAbsDeg === birthPlanet.absoluteDegree;
        const sinhalaLetter = currentPlanet ? PLANET_SHORT_SI[currentPlanet.name] || "" : "";
        const glyph = PLANET_SYMBOLS[birthPlanet.name] || "";
        return (
            <g
                key={`merged-${birthPlanet.name}`}
                onClick={() =>
                    setSelectedAbsDeg((prev) =>
                        prev === birthPlanet.absoluteDegree ? null : birthPlanet.absoluteDegree,
                    )
                }
                onMouseEnter={() => {
                    if (currentPlanet) {
                        showTooltip(
                            birthPlanet.name,
                            birthPlanet.degree,
                            birthPlanet.sign,
                            birthPlanet.house,
                            birthPlanet.nakshatra,
                            birthPlanet.pada,
                            birthPlanet.retrograde,
                            birthPlanet.combustion,
                            false,
                            mx,
                            my,
                        );
                    }
                }}
                onMouseLeave={hideTooltip}
                className="cursor-pointer"
            >
                <line x1={CX} y1={CY} x2={mx} y2={my} stroke={color} strokeWidth={1} opacity={0.6} />
                <circle
                    cx={mx}
                    cy={my}
                    r={16}
                    fill="#ffffff"
                    stroke={isSelected ? "#16a34a" : CURRENT_BORDER_COLOR}
                    strokeWidth={2.5}
                />
                <circle cx={mx} cy={my} r={13} fill={color} stroke="none" />
                <text
                    x={mx - 6}
                    y={my}
                    fontSize={11}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight="bold"
                >
                    {glyph}
                </text>
                <text
                    x={mx + 6}
                    y={my}
                    fontSize={11}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight="bold"
                >
                    {sinhalaLetter}
                </text>
            </g>
        );
    });

    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
    const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
    const zoomReset = () => setZoom(1);

    return (
        <div className="flex flex-col items-center gap-0.5" ref={chartRef}>
            <div className="flex items-center justify-between w-full gap-6">
                {horoscopeId && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showCurrentPlanets}
                            aria-label={t("currentPlanets.toggleLabel")}
                            onClick={handleToggle}
                            disabled={loadingCurrent}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showCurrentPlanets ? "bg-sky-500" : "bg-gray-300"
                                } ${loadingCurrent ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${showCurrentPlanets ? "translate-x-[22px]" : "translate-x-[2px]"
                                    }`}
                            />
                        </button>
                        <span className="text-sm text-gray-700 select-none">{t("currentPlanets.toggleLabel")}</span>
                        {errorCurrent && (
                            <span className="text-xs text-red-600 ml-1">
                                <button
                                    type="button"
                                    onClick={() => fetchCurrentPlanets(selectedDate, selectedTime)}
                                    className="underline"
                                >
                                    {t("currentPlanets.retry")}
                                </button>
                            </span>
                        )}
                        {showCurrentPlanets && (
                            <div className="flex items-center gap-1 text-xs ml-1">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => handleDateChange(e.target.value, selectedTime)}
                                    className="w-28 px-1 py-0.5 border rounded text-gray-700"
                                />
                                <input
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => handleDateChange(selectedDate, e.target.value)}
                                    className="w-20 px-1 py-0.5 border rounded text-gray-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(`${selectedDate}T12:00:00`);
                                        d.setDate(d.getDate() - 1);
                                        const nd = d.toISOString().slice(0, 10);
                                        setSelectedDate(nd);
                                        fetchCurrentPlanets(nd, selectedTime);
                                    }}
                                    className="px-1.5 py-0.5 border rounded hover:bg-gray-50 text-gray-500"
                                    title="Previous day"
                                >
                                    ◀
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(`${selectedDate}T12:00:00`);
                                        d.setDate(d.getDate() + 1);
                                        const nd = d.toISOString().slice(0, 10);
                                        setSelectedDate(nd);
                                        fetchCurrentPlanets(nd, selectedTime);
                                    }}
                                    className="px-1.5 py-0.5 border rounded hover:bg-gray-50 text-gray-500"
                                    title="Next day"
                                >
                                    ▶
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const n = new Date();
                                        const d = n.toISOString().slice(0, 10);
                                        const t = n.toTimeString().slice(0, 5);
                                        setSelectedDate(d);
                                        setSelectedTime(t);
                                        fetchCurrentPlanets(d, t);
                                    }}
                                    className="px-1.5 py-0.5 border rounded hover:bg-gray-50 text-gray-500"
                                    title="Reset to now"
                                >
                                    ↻
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        aria-label="Zoom out"
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white"
                    >
                        −
                    </button>
                    <button
                        type="button"
                        onClick={zoomReset}
                        aria-label="Reset zoom"
                        className="px-2 h-8 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600 text-xs tabular-nums"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= MAX_ZOOM}
                        aria-label="Zoom in"
                        className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white"
                    >
                        +
                    </button>
                </div>
            </div>
            <svg
                width={viewSize * zoom}
                height={viewSize * zoom}
                viewBox={`${viewOrigin} ${viewOrigin} ${viewSize} ${viewSize}`}
                className={zoom <= 1 ? "max-w-full h-auto" : undefined}
            >
                <circle cx={CX} cy={CY} r={R_NAKSHATRA_OUTER} fill="#ffffff" stroke="#d1d5db" strokeWidth={1} />
                {nakshatraWedges}
                {padaWedges}
                {navamsaWedges}
                {signWedges}
                {houseWedges}

                {planetMarkers}
                {currentPlanetMarkers}
                {mergedSymbols}

                <g
                    onClick={() => setSelectedAbsDeg((prev) => (prev === ascAbsDeg ? null : ascAbsDeg))}
                    className="cursor-pointer"
                >
                    <line x1={CX} y1={CY} x2={lagnaOuterX} y2={lagnaOuterY} stroke="#16a34a" strokeWidth={1.5} />
                    <circle
                        cx={lagnaLabelX}
                        cy={lagnaLabelY}
                        r={11}
                        fill="#ffffff"
                        stroke="#16a34a"
                        strokeWidth={selectedAbsDeg === ascAbsDeg ? 3 : 1.5}
                    />
                    <text
                        x={lagnaLabelX}
                        y={lagnaLabelY}
                        fontSize={13}
                        fontWeight="bold"
                        fill="#16a34a"
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        ල
                    </text>
                </g>
                {loadingCurrent && (
                    <g>
                        <circle cx={CX} cy={CY} r={28} fill="rgba(255,255,255,0.9)" stroke="#d1d5db" strokeWidth={1} />
                        <circle
                            cx={CX}
                            cy={CY}
                            r={16}
                            fill="none"
                            stroke="#0EA5E9"
                            strokeWidth={3}
                            strokeLinecap="round"
                            className="animate-spin"
                            style={{ strokeDasharray: 75, strokeDashoffset: 25, transformOrigin: `${CX}px ${CY}px` }}
                        />
                        <text
                            x={CX}
                            y={CY + 18}
                            fontSize={9}
                            fill="#6b7280"
                            textAnchor="middle"
                            dominantBaseline="central"
                        >
                            loading
                        </text>
                    </g>
                )}
            </svg>

            {tooltipContent && (
                <div
                    className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 pointer-events-none whitespace-nowrap"
                    style={{
                        left: tooltipContent.x + 12,
                        top: tooltipContent.y + 12,
                        maxWidth: 280,
                    }}
                >
                    {tooltipContent.lines.map((line, i) => (
                        <div key={i} className={i === 0 ? "font-semibold mb-0.5" : ""}>
                            {line}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
