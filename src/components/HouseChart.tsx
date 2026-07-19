"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import type { Ascendant, House, Planet } from "@/lib/astrology";
import { PLANET_COLORS, navamsaSign } from "@/lib/astrology";
import { NAKSHATRA_SHORT_SI, PLANET_SHORT_SI, SIGN_SHORT_SI } from "@/lib/chartVisuals";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.2;

interface HouseChartProps {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
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

export function HouseChart({ planets, houses, ascendant }: HouseChartProps) {
    const [zoom, setZoom] = useState(1);
    const [selectedAbsDeg, setSelectedAbsDeg] = useState<number | null>(null);
    const ascAbsDeg = (ascendant.sign - 1) * 30 + ascendant.degree;
    const ascNavamsaNum = Math.floor(ascendant.degree / NAVAMSA_SPAN) + 1;
    const ascNavamsaSign = navamsaSign(ascendant.sign, ascNavamsaNum);

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
        const mid = start + (end - start) / 2;
        const isSelected = selectedAbsDeg !== null && degreeInWedge(selectedAbsDeg, start, end);
        return (
            <g key={h.houseNumber}>
                <path
                    d={ringWedgePath(R_HOUSE_INNER, R_HOUSE_OUTER, start, end, ascAbsDeg)}
                    fill={isSelected ? HIGHLIGHT_SELECTED : h.houseNumber === 1 ? HIGHLIGHT_HOUSE : "#ffffff"}
                    stroke="#9ca3af"
                    strokeWidth={0.5}
                />
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
        ...planets.map((planet) => ({ entry: { kind: "planet" as const, planet }, absDeg: planet.absoluteDegree })),
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

    // Crop the viewBox to what this chart actually draws (planet/lagna markers can stagger
    // outward when clustered) instead of the full SIZE canvas, so there's no dead margin around
    // charts where markers don't spread out.
    const MARKER_DRAW_RADIUS = 15; // marker circle + direction-arrow badge extent
    const CONTENT_PAD = 20;
    const maxMarkerRadius = Math.max(lagnaRadius, ...placements.map((p) => p.radius)) + MARKER_DRAW_RADIUS;
    const contentRadius = Math.min(SIZE / 2, Math.max(R_NAKSHATRA_OUTER, maxMarkerRadius) + CONTENT_PAD);
    const viewSize = contentRadius * 2;
    const viewOrigin = CX - contentRadius;

    const planetMarkers = placements.map(({ planet, radius }) => {
        const [mx, my] = polar(planet.absoluteDegree, ascAbsDeg, radius);
        const color = PLANET_COLORS[planet.name] || "#374151";
        const isSelected = selectedAbsDeg === planet.absoluteDegree;
        // Rahu/Ketu (lunar nodes) always move backward (clockwise) through the zodiac — they
        // have no direct motion, unlike the other 7 grahas which are direct unless flagged vakra
        // (retrograde). Both cases render the same backward-pointing arrow.
        const isBackward = planet.retrograde || planet.name === 8 || planet.name === 9;
        // Direction arrow sits ahead of the marker along the ring for direct planets (the
        // anticlockwise direction they're actually travelling toward) or behind it for
        // retrograde/nodes (the clockwise direction they travel toward) — a few degrees further
        // around the same radius, not a fixed screen-space corner, so "front"/"back" always means
        // relative to that planet's own motion regardless of where it sits on the wheel.
        const ARROW_STEP_DEG = 5;
        const arrowAbsDeg = isBackward
            ? planet.absoluteDegree - ARROW_STEP_DEG
            : planet.absoluteDegree + ARROW_STEP_DEG;
        const [arrowBadgeX, arrowBadgeY] = polar(arrowAbsDeg, ascAbsDeg, radius);
        const tangentDeg = ascAbsDeg - planet.absoluteDegree - 180; // CCW-increasing tangent direction
        const arrowRotate = isBackward ? tangentDeg + 180 : tangentDeg;
        const arrowColor = isBackward ? "#dc2626" : "#16a34a";
        return (
            <g
                key={planet.name}
                onClick={() =>
                    setSelectedAbsDeg((prev) => (prev === planet.absoluteDegree ? null : planet.absoluteDegree))
                }
                className="cursor-pointer"
            >
                <line x1={CX} y1={CY} x2={mx} y2={my} stroke={color} strokeWidth={1} opacity={0.6} />
                <circle cx={mx} cy={my} r={11} fill={color} stroke={isSelected ? "#16a34a" : "none"} strokeWidth={2} />
                <g transform={`translate(${arrowBadgeX} ${arrowBadgeY}) rotate(${arrowRotate})`}>
                    {/* Small arrow drawn pointing along +x before rotation, centered at a fixed
                        up-left offset from the marker so it never drifts far away. */}
                    <path
                        d="M -4 0 L 4 0 M 1 -3 L 4 0 L 1 3"
                        fill="none"
                        stroke={arrowColor}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
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

    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
    const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
    const zoomReset = () => setZoom(1);

    return (
        <div className="flex flex-col items-center gap-0.5">
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
            </svg>
        </div>
    );
}
