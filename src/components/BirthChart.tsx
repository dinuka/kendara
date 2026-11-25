"use client";

import { useMemo, useState } from "react";

import { formatDegree } from "@/lib/astrology";
import type { ChartAscendant, ChartHouse, ChartPlanet } from "@/lib/chartDataTransform";
import { PLANET_SHORT_SI, SIGN_SHORT_SI } from "@/lib/chartVisuals";
import { calculateInduLagna } from "@/lib/induLagna";
import { calculateVarnadaLagna } from "@/lib/varnadaLagna";

/** Cropped icon images (public/zodiac/*.png), silhouette on transparent background, aspect 404x275. */
const SIGN_IMAGE_NAMES: Record<number, string> = {
    1: "aries",
    2: "taurus",
    3: "gemini",
    4: "cancer",
    5: "leo",
    6: "virgo",
    7: "libra",
    8: "scorpio",
    9: "sagittarius",
    10: "capricorn",
    11: "aquarius",
    12: "pisces",
};
const SIGN_IMAGE_ASPECT = 404 / 275;

/** Per-sign gradient stops and badge tint, matched to the reference zodiac icon palette. */
const SIGN_COLORS: Record<number, { from: string; to: string; badge: string }> = {
    1: { from: "#8bc34a", to: "#2e7d32", badge: "#e8f5e9" }, // Aries - green ram
    2: { from: "#4a148c", to: "#1a0033", badge: "#ede7f6" }, // Taurus - dark purple bull
    3: { from: "#26c6da", to: "#01579b", badge: "#e0f7fa" }, // Gemini - twin fish blue
    4: { from: "#ad1457", to: "#4a0d2e", badge: "#fce4ec" }, // Cancer - magenta crab
    5: { from: "#ff9800", to: "#d32f2f", badge: "#fff3e0" }, // Leo - flame red-orange-yellow
    6: { from: "#43a047", to: "#1b3d1f", badge: "#e8f5e9" }, // Virgo (reused as maiden green)
    7: { from: "#fb8c00", to: "#e53935", badge: "#fff3e0" }, // Libra - orange/red scales
    8: { from: "#1b3d1f", to: "#0d1f10", badge: "#e8f0e9" }, // Scorpio - dark green/black
    9: { from: "#c62828", to: "#4a0d0d", badge: "#ffebee" }, // Sagittarius - deep red archer
    10: { from: "#5c6bc0", to: "#1a1a4d", badge: "#e8eaf6" }, // Capricorn - indigo goat-fish
    11: { from: "#0288d1", to: "#01579b", badge: "#e1f5fe" }, // Aquarius - blue water bearer
    12: { from: "#0097a7", to: "#01579b", badge: "#e0f7fa" }, // Pisces - blue fish
};

interface BirthChartProps {
    planets: ChartPlanet[];
    houses: ChartHouse[];
    ascendant: ChartAscendant;
    showAscendantDegree?: boolean;
    ascendantDegreeLabel?: string;
    /** Marks the Indu Lagna sign's house with "IL" — D1 birth chart only. */
    showInduLagna?: boolean;
    /** Sign (1-12) of the Hora Lagna, marked with "HL" — D1 birth chart only. The Varnada Lagna
     *  ("VL") is derived from it and the ascendant sign. */
    horaLagnaSign?: number;
}

/** Special lagna markers, rendered after a house's planets in the same rows. */
const INDU_LAGNA = "IL";
const HORA_LAGNA = "HL";
const VARNADA_LAGNA = "VL";
type LagnaMarker = typeof INDU_LAGNA | typeof HORA_LAGNA | typeof VARNADA_LAGNA;

const LAGNA_MARKER_COLORS: Record<LagnaMarker, string> = {
    [INDU_LAGNA]: "#7c3aed",
    [HORA_LAGNA]: "#0f766e",
    [VARNADA_LAGNA]: "#b45309",
};

type ChartEntry = ChartPlanet | LagnaMarker;

const isLagnaMarker = (entry: ChartEntry): entry is LagnaMarker => typeof entry === "string";

const UNIT = 140;
const W = UNIT * 3;
const H = UNIT * 3;

const EDGE_HOUSES: Record<number, { x: number; y: number; labelSide: "top" | "left" | "bottom" | "right" }> = {
    1: { x: UNIT, y: 0, labelSide: "top" },
    4: { x: 0, y: UNIT, labelSide: "left" },
    7: { x: UNIT, y: UNIT * 2, labelSide: "bottom" },
    10: { x: UNIT * 2, y: UNIT, labelSide: "right" },
};

type Point = [number, number];

interface CornerSpec {
    x: number;
    y: number;
    houseA: number;
    houseB: number;
    nearCorner: "tl" | "tr" | "bl" | "br";
}

const CORNERS: CornerSpec[] = [
    { x: 0, y: 0, houseA: 2, houseB: 3, nearCorner: "tl" },
    { x: 0, y: UNIT * 2, houseA: 5, houseB: 6, nearCorner: "bl" },
    { x: UNIT * 2, y: UNIT * 2, houseA: 9, houseB: 8, nearCorner: "br" },
    { x: UNIT * 2, y: 0, houseA: 12, houseB: 11, nearCorner: "tr" },
];

const OPPOSITE: Record<CornerSpec["nearCorner"], CornerSpec["nearCorner"]> = {
    tl: "br",
    tr: "bl",
    bl: "tr",
    br: "tl",
};

/** Point inside a corner triangle, inset from the center-facing vertex `far` by `inset` px along
 *  both edges that meet there (toward `nearPt` down the diagonal, toward `adjacent` down the cell
 *  border) — lands in the middle of the triangle's wedge, clear of both edges by ~inset/sqrt(2). */
function insetFromFarCorner(far: Point, nearPt: Point, adjacent: Point, inset: number): Point {
    const toNear = Math.hypot(nearPt[0] - far[0], nearPt[1] - far[1]);
    const toAdjacent = Math.hypot(adjacent[0] - far[0], adjacent[1] - far[1]);
    return [
        far[0] + (inset * (nearPt[0] - far[0])) / toNear + (inset * (adjacent[0] - far[0])) / toAdjacent,
        far[1] + (inset * (nearPt[1] - far[1])) / toNear + (inset * (adjacent[1] - far[1])) / toAdjacent,
    ];
}

interface Box {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/** Horizontal extent of convex polygon `poly` along the line at height `y`, or null outside it. */
function polygonSpanAtY(poly: Point[], y: number): [number, number] | null {
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        if (y < Math.min(ay, by) || y > Math.max(ay, by)) continue;
        if (ay === by) xs.push(ax, bx);
        else xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    return xs.length === 0 ? null : [Math.min(...xs), Math.max(...xs)];
}

/** Widest horizontal run inside `poly` across the whole band [top, bottom], kept `pad` px clear of
 *  the polygon's edges and of every obstacle box overlapping the band. */
function widestFreeSegment(poly: Point[], top: number, bottom: number, obstacles: Box[], pad: number) {
    const atTop = polygonSpanAtY(poly, top);
    const atBottom = polygonSpanAtY(poly, bottom);
    if (!atTop || !atBottom) return null;
    let segments: [number, number][] = [[Math.max(atTop[0], atBottom[0]) + pad, Math.min(atTop[1], atBottom[1]) - pad]];
    for (const o of obstacles) {
        if (o.y2 <= top || o.y1 >= bottom) continue;
        segments = segments.flatMap(([l, r]) => {
            const out: [number, number][] = [];
            if (o.x1 - pad > l) out.push([l, Math.min(r, o.x1 - pad)]);
            if (o.x2 + pad < r) out.push([Math.max(l, o.x2 + pad), r]);
            return out;
        });
    }
    let best: [number, number] | null = null;
    for (const s of segments) if (s[1] > s[0] && (!best || s[1] - s[0] > best[1] - best[0])) best = s;
    return best;
}

const ENTRY_GAP = 4;

/** Rough rendered width of a planet row (Sinhala short names are one glyph cluster each). */
function estimateRowWidth(entries: ChartEntry[], fontSize: number, lordPlanet: number | null): number {
    let width = 0;
    entries.forEach((p, i) => {
        if (i > 0) width += ENTRY_GAP;
        if (isLagnaMarker(p)) {
            width += fontSize * 1.3;
            return;
        }
        const fs = p.name === lordPlanet ? fontSize + 4 : fontSize;
        const isRetrograde = p.retrograde && p.name !== 8 && p.name !== 9;
        width += fs * 1.1 + (isRetrograde ? fs * 0.8 : 0);
    });
    return width;
}

/** Places each row of planets top-down inside `poly`, at the first height where the row's
 *  estimated width fits clear of the edges and obstacles. Returns null if any row doesn't fit. */
function layoutRowsInPolygon(
    rows: ChartEntry[][],
    poly: Point[],
    obstacles: Box[],
    fontSize: number,
    lordPlanet: number | null,
): Point[] | null {
    const ys = poly.map((p) => p[1]);
    const maxY = Math.max(...ys);
    const lineHeight = fontSize * 2;
    const placements: Point[] = [];
    let y = Math.min(...ys) + fontSize + 2;
    for (const row of rows) {
        const hasLord = row.some((p) => !isLagnaMarker(p) && p.name === lordPlanet);
        const fs = hasLord ? fontSize + 4 : fontSize;
        const needed = estimateRowWidth(row, fontSize, lordPlanet);
        let placed = false;
        for (; y + fs * 0.4 <= maxY; y++) {
            const seg = widestFreeSegment(poly, y - fs, y + fs * 0.4, obstacles, 3);
            if (seg && seg[1] - seg[0] >= needed) {
                placements.push([(seg[0] + seg[1]) / 2, y]);
                y += lineHeight;
                placed = true;
                break;
            }
        }
        if (!placed) return null;
    }
    return placements;
}

/** Rough box of a single-line label for obstacle avoidance. */
function labelBox(x: number, y: number, anchor: "start" | "middle" | "end", width: number, fontSize: number): Box {
    const x1 = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
    return { x1, y1: y - fontSize, x2: x1 + width, y2: y + fontSize * 0.4 };
}

type HighlightTier = "selected" | "trine" | "lordHouse";

const TIER_COLORS: Record<HighlightTier, string> = {
    selected: "#facc15",
    trine: "#fde68a",
    lordHouse: "#fef9c3",
};

/** 5th and 9th from `house` (inclusive counting), plus the other house ruled by the same lord.
 *  Tiers are assigned by priority so a house in multiple categories keeps the strongest one:
 *  selected > 5th/9th (trine) > lord's other house. */
function computeHighlights(
    selectedHouse: number | null,
    houses: ChartHouse[],
): { houseTiers: Map<number, HighlightTier>; lordPlanet: number | null } {
    if (selectedHouse === null) return { houseTiers: new Map(), lordPlanet: null };

    const houseByNumber: Record<number, ChartHouse> = {};
    for (const h of houses) houseByNumber[h.houseNumber] = h;

    const selected = houseByNumber[selectedHouse];
    if (!selected) return { houseTiers: new Map(), lordPlanet: null };

    const lordPlanet = selected.lord;
    const fifth = ((selectedHouse - 1 + 4) % 12) + 1;
    const ninth = ((selectedHouse - 1 + 8) % 12) + 1;

    const houseTiers = new Map<number, HighlightTier>();
    for (const h of houses) {
        if (h.lord === lordPlanet) houseTiers.set(h.houseNumber, "lordHouse");
    }
    houseTiers.set(fifth, "trine");
    houseTiers.set(ninth, "trine");
    houseTiers.set(selectedHouse, "selected");

    return { houseTiers, lordPlanet };
}

export function BirthChart({
    planets,
    houses,
    ascendant,
    showAscendantDegree = true,
    ascendantDegreeLabel,
    showInduLagna = false,
    horaLagnaSign,
}: BirthChartProps) {
    const [selectedHouse, setSelectedHouse] = useState<number | null>(null);

    const signByHouse: Record<number, number> = {};
    for (const h of houses) signByHouse[h.houseNumber] = h.sign;

    const planetsByHouse: Record<number, ChartEntry[]> = {};
    for (const p of [...planets].sort((a, b) => a.degree - b.degree)) {
        if (!planetsByHouse[p.house]) planetsByHouse[p.house] = [];
        planetsByHouse[p.house].push(p);
    }

    const addMarker = (sign: number, marker: LagnaMarker) => {
        const house = houses.find((h) => h.sign === sign);
        if (!house) return;
        if (!planetsByHouse[house.houseNumber]) planetsByHouse[house.houseNumber] = [];
        planetsByHouse[house.houseNumber].push(marker);
    };

    // The Moon's sign is read from its house so lean persisted chart data (no planet signs) works.
    const moon = planets.find((p) => p.name === 2);
    if (showInduLagna && moon && signByHouse[moon.house]) {
        addMarker(calculateInduLagna(ascendant.sign, signByHouse[moon.house]).sign, INDU_LAGNA);
    }
    if (horaLagnaSign) {
        addMarker(horaLagnaSign, HORA_LAGNA);
        addMarker(calculateVarnadaLagna(ascendant.sign, horaLagnaSign).sign, VARNADA_LAGNA);
    }

    const { houseTiers, lordPlanet } = useMemo(() => computeHighlights(selectedHouse, houses), [selectedHouse, houses]);

    const toggleHouse = (houseNum: number) => {
        setSelectedHouse((prev) => (prev === houseNum ? null : houseNum));
    };

    const cellFill = (houseNum: number, base: string) => {
        const tier = houseTiers.get(houseNum);
        return tier ? TIER_COLORS[tier] : base;
    };

    const renderSignGlyph = (sign: number | undefined, cx: number, cy: number, size: number) => {
        if (!sign) return null;
        const colors = SIGN_COLORS[sign];
        const badgeRadius = size * 0.85;
        const iconW = size * 1.7;
        const iconH = iconW / SIGN_IMAGE_ASPECT;
        const imgName = SIGN_IMAGE_NAMES[sign];
        return (
            <g>
                <circle cx={cx} cy={cy} r={badgeRadius} fill={colors.badge} />
                <mask
                    id={`sign-mask-${sign}-${cx}-${cy}`}
                    maskUnits="userSpaceOnUse"
                    maskContentUnits="userSpaceOnUse"
                    // eslint-disable-next-line react/no-unknown-property
                    mask-type="alpha"
                >
                    <image
                        href={`/zodiac/${imgName}.png`}
                        x={cx - iconW / 2}
                        y={cy - iconH / 2}
                        width={iconW}
                        height={iconH}
                    />
                </mask>
                <rect
                    x={cx - iconW / 2}
                    y={cy - iconH / 2}
                    width={iconW}
                    height={iconH}
                    fill={`url(#sign-grad-${sign})`}
                    mask={`url(#sign-mask-${sign}-${cx}-${cy})`}
                />
            </g>
        );
    };

    /** Renders one row of planet labels (no truncation) at the given position. */
    const renderPlanetRow = (planetsToShow: ChartEntry[], cx: number, cy: number, fontSize: number) => {
        if (planetsToShow.length === 0) return null;
        return (
            <text x={cx} y={cy} textAnchor="middle" fontSize={fontSize} fill="#1f2937">
                {planetsToShow.map((p, i) => {
                    if (isLagnaMarker(p)) {
                        return (
                            <tspan key={p} dx={i === 0 ? 0 : 4} fontWeight="bold" fill={LAGNA_MARKER_COLORS[p]}>
                                {p}
                            </tspan>
                        );
                    }
                    const isLord = p.name === lordPlanet;
                    const isRetrograde = p.retrograde && p.name !== 8 && p.name !== 9;
                    const label = PLANET_SHORT_SI[p.name] || "";
                    return (
                        <tspan
                            key={p.name}
                            dx={i === 0 ? 0 : 4}
                            fontSize={isLord ? fontSize + 4 : fontSize}
                            fontWeight={isLord ? "bold" : "normal"}
                            fill={isLord ? "#db2777" : "#1f2937"}
                        >
                            {isRetrograde ? `(${label})` : label}
                        </tspan>
                    );
                })}
            </text>
        );
    };

    /** Renders a house's planets (already degree-sorted) in rows stacked in the available space
     *  around the sign icon, so all planets show without a "+N" truncation. `rowYs` holds one
     *  baseline y per row; the first `rowSize` planets go in the first row, and so on. */
    const renderPlanetsAroundIcon = (houseNum: number, cx: number, rowYs: number[], fontSize: number, rowSize = 3) => {
        const housePlanets = planetsByHouse[houseNum] || [];
        return (
            <>
                {rowYs.map((y, i) => (
                    <g key={i}>
                        {renderPlanetRow(housePlanets.slice(i * rowSize, (i + 1) * rowSize), cx, y, fontSize)}
                    </g>
                ))}
            </>
        );
    };

    /** Renders a corner house's planets (already degree-sorted) in groups tucked into the two acute
     *  corners of its triangle (the diagonal's endpoints: `nearPt` and `far`), two groups per corner
     *  so up to 8 planets show. The sign icon stays centered at the triangle's third vertex
     *  (`ownCorner`). */
    const renderPlanetsInTriangleCorners = (
        houseNum: number,
        nearPt: Point,
        far: Point,
        ownCorner: Point,
        fontSize: number,
        rowSize = 2,
    ) => {
        const housePlanets = planetsByHouse[houseNum] || [];
        const groupPositions: Point[] = [
            insetFromFarCorner(nearPt, far, ownCorner, 20),
            insetFromFarCorner(far, nearPt, ownCorner, 20),
            insetFromFarCorner(nearPt, far, ownCorner, 36),
            insetFromFarCorner(far, nearPt, ownCorner, 36),
        ];
        return (
            <>
                {groupPositions.map(([gx, gy], i) => (
                    <g key={i}>
                        {renderPlanetRow(housePlanets.slice(i * rowSize, (i + 1) * rowSize), gx, gy, fontSize)}
                    </g>
                ))}
            </>
        );
    };

    /** Selected corner house: number+sign label, sign icon at the center-facing apex, and planets
     *  laid out row by row where the triangle is wide enough, clear of the label and icon. */
    const renderSelectedCornerHouse = (
        houseNum: number,
        sign: number | undefined,
        tri: Point[],
        label: { x: number; y: number; anchor: "start" | "middle" | "end" },
        glyph: Point,
    ) => {
        const fontSize = 10;
        const glyphSize = 16;
        const glyphHalf = glyphSize * 0.85;
        const obstacles: Box[] = [
            labelBox(label.x, label.y, label.anchor, 64, 11),
            { x1: glyph[0] - glyphHalf, y1: glyph[1] - glyphHalf, x2: glyph[0] + glyphHalf, y2: glyph[1] + glyphHalf },
        ];
        const housePlanets = planetsByHouse[houseNum] || [];
        const chunk = (size: number) => {
            const rows: ChartEntry[][] = [];
            for (let i = 0; i < housePlanets.length; i += size) rows.push(housePlanets.slice(i, i + size));
            return rows;
        };

        let rows: ChartEntry[][] = [];
        let positions: Point[] | null = null;
        for (const size of [2, 1, 3]) {
            rows = chunk(size);
            positions = layoutRowsInPolygon(rows, tri, obstacles, fontSize, lordPlanet);
            if (positions) break;
        }
        if (!positions) {
            // Nothing fits cleanly (very crowded house): stack 2-per-row around the centroid.
            rows = chunk(2);
            const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
            const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            positions = rows.map((_, i) => [cx, cy + (i - (rows.length - 1) / 2) * 20]);
        }

        return (
            <>
                <text
                    x={label.x}
                    y={label.y}
                    textAnchor={label.anchor}
                    fontSize={11}
                    fontWeight="bold"
                    fill="#dc2626"
                >
                    {houseNum} {sign ? SIGN_SHORT_SI[sign] : ""}
                </text>
                {rows.map((row, i) => (
                    <g key={i}>{renderPlanetRow(row, positions[i][0], positions[i][1], fontSize)}</g>
                ))}
                {renderSignGlyph(sign, glyph[0], glyph[1], glyphSize)}
            </>
        );
    };

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full h-auto">
            <defs>
                {Object.entries(SIGN_COLORS).map(([sign, colors]) => (
                    <linearGradient key={sign} id={`sign-grad-${sign}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colors.from} />
                        <stop offset="100%" stopColor={colors.to} />
                    </linearGradient>
                ))}
            </defs>
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" stroke="#d1d5db" strokeWidth={1.5} />

            {/* Edge-center houses: 1 (top), 4 (left), 7 (bottom), 10 (right) */}
            {([1, 4, 7, 10] as const).map((houseNum) => {
                const spec = EDGE_HOUSES[houseNum];
                const sign = signByHouse[houseNum];
                const isAsc = ascendant.sign === sign;
                const cx = spec.x + UNIT / 2;
                const cy = spec.y + UNIT / 2;
                const isVertical = spec.labelSide === "top" || spec.labelSide === "bottom";
                const labelX = spec.labelSide === "right" ? spec.x + UNIT - 6 : spec.x + 6;
                const labelAnchor = spec.labelSide === "right" ? "end" : "start";
                const labelY = spec.labelSide === "bottom" ? spec.y + UNIT - 8 : spec.y + 16;

                const isSelected = selectedHouse === houseNum;

                // When selected, the number+sign-name label stays on the cell's outer edge (the
                // chart border) and the sign icon moves to the inner edge (touching the center
                // square), with planets stacked in between.
                const outerPos =
                    spec.labelSide === "top"
                        ? spec.y + 18
                        : spec.labelSide === "bottom"
                          ? spec.y + UNIT - 18
                          : spec.labelSide === "left"
                            ? spec.x + 20
                            : spec.x + UNIT - 20;
                // Icon center sits SELECTED_GLYPH_INSET from the inner edge: the badge radius
                // (24 * 0.85 ≈ 20) plus a ~10px gap, matching the corner houses' breathing room.
                const SELECTED_GLYPH_INSET = 30;
                const SELECTED_GLYPH_RADIUS = 24 * 0.85;
                const innerPos =
                    spec.labelSide === "top"
                        ? spec.y + UNIT - SELECTED_GLYPH_INSET
                        : spec.labelSide === "bottom"
                          ? spec.y + SELECTED_GLYPH_INSET
                          : spec.labelSide === "left"
                            ? spec.x + UNIT - SELECTED_GLYPH_INSET
                            : spec.x + SELECTED_GLYPH_INSET;
                // Left/right houses: center planet rows in the space between the outer border and
                // the icon, so wide rows don't run under it.
                const selectedRowsX =
                    spec.labelSide === "left"
                        ? (spec.x + innerPos - SELECTED_GLYPH_RADIUS) / 2
                        : spec.labelSide === "right"
                          ? (innerPos + SELECTED_GLYPH_RADIUS + spec.x + UNIT) / 2
                          : cx;

                return (
                    <g key={houseNum} onClick={() => toggleHouse(houseNum)} className="cursor-pointer">
                        <rect
                            x={spec.x}
                            y={spec.y}
                            width={UNIT}
                            height={UNIT}
                            fill={cellFill(houseNum, "#ffffff")}
                            stroke="#d1d5db"
                            strokeWidth={isAsc ? 2.5 : 1}
                            className="transition-colors"
                        />
                        {isSelected ? (
                            <>
                                <text
                                    x={spec.x + 6}
                                    y={isVertical ? outerPos : cy - 34}
                                    textAnchor="start"
                                    fontSize={13}
                                    fontWeight="bold"
                                    fill="#dc2626"
                                >
                                    {houseNum} {sign ? SIGN_SHORT_SI[sign] : ""}
                                </text>
                                {renderPlanetsAroundIcon(
                                    houseNum,
                                    selectedRowsX,
                                    spec.labelSide === "top"
                                        ? [cy - 30, cy - 10, cy + 12]
                                        : spec.labelSide === "bottom"
                                          ? [cy, cy + 19, cy + 38]
                                          : [cy - 6, cy + 18, cy + 42],
                                    13,
                                )}
                                {renderSignGlyph(sign, isVertical ? cx : innerPos, isVertical ? innerPos : cy, 24)}
                            </>
                        ) : (
                            <>
                                <text
                                    x={labelX}
                                    y={labelY}
                                    textAnchor={labelAnchor}
                                    fontSize={12}
                                    fontWeight="bold"
                                    fill="#dc2626"
                                >
                                    {houseNum}
                                </text>
                                {renderSignGlyph(sign, cx, cy - 16, 20)}
                                {renderPlanetsAroundIcon(houseNum, cx, [cy + 12, cy + 32, cy + 52], 12)}
                            </>
                        )}
                    </g>
                );
            })}

            {/* Corner cells, split diagonally between two houses */}
            {CORNERS.map((corner) => {
                const { x, y, houseA, houseB, nearCorner } = corner;
                const signA = signByHouse[houseA];
                const signB = signByHouse[houseB];
                const isAscA = ascendant.sign === signA;
                const isAscB = ascendant.sign === signB;

                const corners: Record<CornerSpec["nearCorner"], Point> = {
                    tl: [x, y],
                    tr: [x + UNIT, y],
                    bl: [x, y + UNIT],
                    br: [x + UNIT, y + UNIT],
                };
                const nearPt = corners[nearCorner];
                const far = corners[OPPOSITE[nearCorner]];
                const adjacent1 = nearCorner === "tl" || nearCorner === "br" ? corners.tr : corners.tl;
                const adjacent2 = nearCorner === "tl" || nearCorner === "br" ? corners.bl : corners.br;

                const aCenterX = (nearPt[0] + far[0] + adjacent1[0]) / 3;
                const aCenterY = (nearPt[1] + far[1] + adjacent1[1]) / 3;
                const aLabelX = adjacent1[0] + (adjacent1[0] === x ? 6 : -6);
                const aLabelY = adjacent1[1] + (adjacent1[1] === y ? 16 : -8);

                const bCenterX = (nearPt[0] + far[0] + adjacent2[0]) / 3;
                const bCenterY = (nearPt[1] + far[1] + adjacent2[1]) / 3;
                const bLabelX = adjacent2[0] + (adjacent2[0] === x ? 6 : -6);
                const bLabelY = adjacent2[1] + (adjacent2[1] === y ? 16 : -8);

                // Houses 2, 3, 5, 6, 8, 9, 12 left-align their selected label at the triangle
                // centroid (guaranteed inside the triangle) instead of centering it. Houses 3, 5, 8,
                // 12 instead pin to the same "6px from its own cell's left edge" rule used by the
                // default (non-selected) number labels, since their centroid sits too close to (or
                // past) the board border for a long sign name. House 11's sign name is long enough
                // that left-aligning from its centroid runs past the board's right edge, so it
                // right-aligns instead.
                const LEFT_ALIGN_HOUSES = new Set([2, 3, 5, 6, 8, 9, 12]);
                const RIGHT_ALIGN_HOUSES = new Set([11]);
                // Corner-cell triangles tuck planets into their two acute corners (the diagonal's
                // endpoints) instead of stacking them above/below the icon.
                const DIAGONAL_CORNER_HOUSES = new Set([2, 3, 5, 6, 8, 9, 11, 12]);
                const aLeftAlignSelected = LEFT_ALIGN_HOUSES.has(houseA);
                const bLeftAlignSelected = LEFT_ALIGN_HOUSES.has(houseB);
                const aRightAlignSelected = RIGHT_ALIGN_HOUSES.has(houseA);
                const bRightAlignSelected = RIGHT_ALIGN_HOUSES.has(houseB);
                const CELL_EDGE_ALIGN_HOUSES = new Set([3, 5, 8, 12]);
                const aLeftAlignX = CELL_EDGE_ALIGN_HOUSES.has(houseA) ? x + 6 : aCenterX - 8;
                const bLeftAlignX = CELL_EDGE_ALIGN_HOUSES.has(houseB) ? x + 6 : bCenterX - 8;

                const isSelectedA = selectedHouse === houseA;
                const isSelectedB = selectedHouse === houseB;

                return (
                    <g key={`${houseA}-${houseB}`}>
                        <rect x={x} y={y} width={UNIT} height={UNIT} fill="#ffffff" stroke="#d1d5db" strokeWidth={1} />

                        <polygon
                            points={`${nearPt.join(",")} ${far.join(",")} ${adjacent1.join(",")}`}
                            fill={cellFill(houseA, "transparent")}
                            onClick={() => toggleHouse(houseA)}
                            className="cursor-pointer transition-colors"
                        />
                        <polygon
                            points={`${nearPt.join(",")} ${far.join(",")} ${adjacent2.join(",")}`}
                            fill={cellFill(houseB, "transparent")}
                            onClick={() => toggleHouse(houseB)}
                            className="cursor-pointer transition-colors"
                        />

                        <line x1={nearPt[0]} y1={nearPt[1]} x2={far[0]} y2={far[1]} stroke="#d1d5db" strokeWidth={1} />

                        <g className="pointer-events-none">
                            {isSelectedA ? (
                                renderSelectedCornerHouse(
                                    houseA,
                                    signA,
                                    [nearPt, far, adjacent1],
                                    {
                                        x: aLeftAlignSelected
                                            ? aLeftAlignX
                                            : aRightAlignSelected
                                              ? x + UNIT - 6
                                              : adjacent1[0] + (adjacent1[0] === x ? 22 : -22),
                                        y: adjacent1[1] + (adjacent1[1] === y ? 22 : -22),
                                        anchor: aLeftAlignSelected ? "start" : aRightAlignSelected ? "end" : "middle",
                                    },
                                    insetFromFarCorner(far, nearPt, adjacent1, 28),
                                )
                            ) : (
                                <>
                                    <text
                                        x={aLabelX}
                                        y={aLabelY}
                                        textAnchor={adjacent1[0] === x ? "start" : "end"}
                                        fontSize={12}
                                        fontWeight="bold"
                                        fill="#dc2626"
                                    >
                                        {houseA}
                                    </text>
                                    {renderSignGlyph(signA, aCenterX, aCenterY - 10, 18)}
                                    {isAscA && (
                                        <text
                                            x={aCenterX}
                                            y={aCenterY + 14}
                                            textAnchor="middle"
                                            fontSize={9}
                                            fontWeight="bold"
                                            fill="#dc2626"
                                        >
                                            ASC
                                        </text>
                                    )}
                                    {DIAGONAL_CORNER_HOUSES.has(houseA)
                                        ? renderPlanetsInTriangleCorners(houseA, nearPt, far, adjacent1, 10, 2)
                                        : renderPlanetsAroundIcon(
                                              houseA,
                                              aCenterX,
                                              [aCenterY - 28, aCenterY + 18, aCenterY + 38],
                                              10,
                                              2,
                                          )}
                                </>
                            )}

                            {isSelectedB ? (
                                renderSelectedCornerHouse(
                                    houseB,
                                    signB,
                                    [nearPt, far, adjacent2],
                                    {
                                        x: bLeftAlignSelected
                                            ? bLeftAlignX
                                            : bRightAlignSelected
                                              ? x + UNIT - 6
                                              : adjacent2[0] + (adjacent2[0] === x ? 22 : -22),
                                        y: adjacent2[1] + (adjacent2[1] === y ? 22 : -22),
                                        anchor: bLeftAlignSelected ? "start" : bRightAlignSelected ? "end" : "middle",
                                    },
                                    insetFromFarCorner(far, nearPt, adjacent2, 28),
                                )
                            ) : (
                                <>
                                    <text
                                        x={bLabelX}
                                        y={bLabelY}
                                        textAnchor={adjacent2[0] === x ? "start" : "end"}
                                        fontSize={12}
                                        fontWeight="bold"
                                        fill="#dc2626"
                                    >
                                        {houseB}
                                    </text>
                                    {renderSignGlyph(signB, bCenterX, bCenterY - 10, 18)}
                                    {isAscB && (
                                        <text
                                            x={bCenterX}
                                            y={bCenterY + 14}
                                            textAnchor="middle"
                                            fontSize={9}
                                            fontWeight="bold"
                                            fill="#dc2626"
                                        >
                                            ASC
                                        </text>
                                    )}
                                    {DIAGONAL_CORNER_HOUSES.has(houseB)
                                        ? renderPlanetsInTriangleCorners(houseB, nearPt, far, adjacent2, 10, 2)
                                        : renderPlanetsAroundIcon(
                                              houseB,
                                              bCenterX,
                                              [bCenterY - 28, bCenterY + 18, bCenterY + 38],
                                              10,
                                              2,
                                          )}
                                </>
                            )}
                        </g>
                    </g>
                );
            })}

            {/* Center cell: ascendant degree (optional), sign glyph, sign name pill */}
            <g>
                <rect x={UNIT} y={UNIT} width={UNIT} height={UNIT} fill="#fdf4f0" stroke="#d1d5db" strokeWidth={1} />
                {showAscendantDegree && (
                    <text
                        x={UNIT * 1.5}
                        y={UNIT + 34}
                        textAnchor="middle"
                        fontSize={14}
                        fontWeight="bold"
                        fill="#1f2937"
                    >
                        {ascendantDegreeLabel ?? formatDegree(ascendant.degree)}
                    </text>
                )}
                {renderSignGlyph(ascendant.sign, UNIT * 1.5, UNIT + (showAscendantDegree ? 70 : 58), 26)}
                <rect
                    x={UNIT * 1.5 - 42}
                    y={UNIT + (showAscendantDegree ? 92 : 80)}
                    width={84}
                    height={24}
                    rx={12}
                    fill="#ec4899"
                />
                <text
                    x={UNIT * 1.5}
                    y={UNIT + (showAscendantDegree ? 108 : 96)}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight="bold"
                    fill="#ffffff"
                >
                    {SIGN_SHORT_SI[ascendant.sign] || ""}
                </text>
            </g>
        </svg>
    );
}
