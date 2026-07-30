"use client";

import { useMemo, useState } from "react";

import type { Ascendant, House, Planet } from "@/lib/astrology";
import { formatDegree } from "@/lib/astrology";
import { PLANET_SHORT_SI, SIGN_SHORT_SI } from "@/lib/chartVisuals";

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
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
    showAscendantDegree?: boolean;
}

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
    houses: House[],
): { houseTiers: Map<number, HighlightTier>; lordPlanet: number | null } {
    if (selectedHouse === null) return { houseTiers: new Map(), lordPlanet: null };

    const houseByNumber: Record<number, House> = {};
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

export function BirthChart({ planets, houses, ascendant, showAscendantDegree = true }: BirthChartProps) {
    const [selectedHouse, setSelectedHouse] = useState<number | null>(null);

    const signByHouse: Record<number, number> = {};
    for (const h of houses) signByHouse[h.houseNumber] = h.sign;

    const planetsByHouse: Record<number, Planet[]> = {};
    for (const p of planets) {
        if (!planetsByHouse[p.house]) planetsByHouse[p.house] = [];
        planetsByHouse[p.house].push(p);
    }
    for (const hn of Object.keys(planetsByHouse)) {
        planetsByHouse[Number(hn)].sort((a, b) => a.degree - b.degree);
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
    const renderPlanetRow = (planetsToShow: Planet[], cx: number, cy: number, fontSize: number) => {
        if (planetsToShow.length === 0) return null;
        return (
            <text x={cx} y={cy} textAnchor="middle" fontSize={fontSize} fill="#1f2937">
                {planetsToShow.map((p, i) => {
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

    /** Splits a house's planets (already degree-sorted) into an upper row (above the sign icon)
     *  and a lower row (below it), so all planets show without a "+N" truncation — up to 6 total. */
    const renderPlanetsAroundIcon = (
        houseNum: number,
        cx: number,
        upperY: number,
        lowerY: number,
        fontSize: number,
        rowSize = 3,
    ) => {
        const housePlanets = planetsByHouse[houseNum] || [];
        const upper = housePlanets.slice(0, rowSize);
        const lower = housePlanets.slice(rowSize, rowSize * 2);
        return (
            <>
                {renderPlanetRow(upper, cx, upperY, fontSize)}
                {renderPlanetRow(lower, cx, lowerY, fontSize)}
            </>
        );
    };

    /** Splits a corner house's planets into two groups tucked into the triangle's two acute
     *  corners (the diagonal's endpoints: `nearPt` and `far`), leaving the icon centered at the
     *  triangle's third vertex (`ownCorner`) untouched — used for the "\" diagonal cells
     *  (houses 2, 3, 8, 9). */
    const renderPlanetsInTriangleCorners = (
        houseNum: number,
        nearPt: Point,
        far: Point,
        ownCorner: Point,
        fontSize: number,
        rowSize = 2,
    ) => {
        const housePlanets = planetsByHouse[houseNum] || [];
        const group1 = housePlanets.slice(0, rowSize);
        const group2 = housePlanets.slice(rowSize, rowSize * 2);
        const [nx, ny] = insetFromFarCorner(nearPt, far, ownCorner, 20);
        const [fx, fy] = insetFromFarCorner(far, nearPt, ownCorner, 20);
        return (
            <>
                {renderPlanetRow(group1, nx, ny, fontSize)}
                {renderPlanetRow(group2, fx, fy, fontSize)}
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
                const innerPos =
                    spec.labelSide === "top"
                        ? spec.y + UNIT - 22
                        : spec.labelSide === "bottom"
                          ? spec.y + 22
                          : spec.labelSide === "left"
                            ? spec.x + UNIT - 20
                            : spec.x + 20;

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
                                {renderPlanetRow((planetsByHouse[houseNum] || []).slice(0, 3), cx, cy - 6, 13)}
                                {renderPlanetRow((planetsByHouse[houseNum] || []).slice(3, 6), cx, cy + 18, 13)}
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
                                {renderPlanetsAroundIcon(houseNum, cx, cy + 12, cy + 32, 12)}
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
                                <>
                                    <text
                                        x={
                                            aLeftAlignSelected
                                                ? aLeftAlignX
                                                : aRightAlignSelected
                                                  ? x + UNIT - 6
                                                  : adjacent1[0] + (adjacent1[0] === x ? 22 : -22)
                                        }
                                        y={adjacent1[1] + (adjacent1[1] === y ? 22 : -22)}
                                        textAnchor={
                                            aLeftAlignSelected ? "start" : aRightAlignSelected ? "end" : "middle"
                                        }
                                        fontSize={11}
                                        fontWeight="bold"
                                        fill="#dc2626"
                                    >
                                        {houseA} {signA ? SIGN_SHORT_SI[signA] : ""}
                                    </text>
                                    {renderPlanetsAroundIcon(houseA, aCenterX, aCenterY - 11, aCenterY + 11, 10, 2)}
                                    {(() => {
                                        const [ix, iy] = insetFromFarCorner(far, nearPt, adjacent1, 28);
                                        return renderSignGlyph(signA, ix, iy, 16);
                                    })()}
                                </>
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
                                              aCenterY - 28,
                                              aCenterY + (isAscA ? 26 : 18),
                                              10,
                                              2,
                                          )}
                                </>
                            )}

                            {isSelectedB ? (
                                <>
                                    <text
                                        x={
                                            bLeftAlignSelected
                                                ? bLeftAlignX
                                                : bRightAlignSelected
                                                  ? x + UNIT - 6
                                                  : adjacent2[0] + (adjacent2[0] === x ? 22 : -22)
                                        }
                                        y={adjacent2[1] + (adjacent2[1] === y ? 22 : -22)}
                                        textAnchor={
                                            bLeftAlignSelected ? "start" : bRightAlignSelected ? "end" : "middle"
                                        }
                                        fontSize={11}
                                        fontWeight="bold"
                                        fill="#dc2626"
                                    >
                                        {houseB} {signB ? SIGN_SHORT_SI[signB] : ""}
                                    </text>
                                    {renderPlanetsAroundIcon(houseB, bCenterX, bCenterY - 11, bCenterY + 11, 10, 2)}
                                    {(() => {
                                        const [ix, iy] = insetFromFarCorner(far, nearPt, adjacent2, 28);
                                        return renderSignGlyph(signB, ix, iy, 16);
                                    })()}
                                </>
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
                                              bCenterY - 28,
                                              bCenterY + (isAscB ? 26 : 18),
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
                        {formatDegree(ascendant.degree)}
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
