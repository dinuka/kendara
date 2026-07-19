import { Ascendant, House, Planet, formatDegree } from "@/lib/astrology";
import { ChartType } from "@/lib/chartTypes";

const PLANET_SHORT_SI: Record<number, string> = {
    1: "රවි",
    2: "සඳු",
    3: "කුජ",
    4: "බුධ",
    5: "ගුරු",
    6: "සිකු",
    7: "ශනි",
    8: "රාහු",
    9: "කේතු",
};

const SIGN_SHORT_SI: Record<number, string> = {
    1: "මේෂ",
    2: "වෘෂභ",
    3: "මිථුන",
    4: "කටක",
    5: "සිංහ",
    6: "කන්‍යා",
    7: "තුලා",
    8: "වෘශ්චික",
    9: "ධනු",
    10: "මකර",
    11: "කුම්භ",
    12: "මීන",
};

const SIGN_GLYPHS: Record<number, string> = {
    1: "♈",
    2: "♉",
    3: "♊",
    4: "♋",
    5: "♌",
    6: "♍",
    7: "♎",
    8: "♏",
    9: "♐",
    10: "♑",
    11: "♒",
    12: "♓",
};

interface ChartInput {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
}

const UNIT = 140;
const W = UNIT * 3;
const H = UNIT * 3;

/** House 1 is fixed top-middle; houses run anticlockwise (1 -> top-left -> left -> bottom-left ->
 *  bottom -> bottom-right -> right -> top-right -> back to 1). The grid is a uniform 3x3 of equal
 *  squares: 4 edge-center cells hold one house each, 4 corner cells are split diagonally between
 *  two adjacent houses, and the middle cell holds the ascendant summary. */
const EDGE_HOUSES: Record<
    number,
    { x: number; y: number; w: number; h: number; labelSide: "top" | "left" | "bottom" | "right" }
> = {
    1: { x: UNIT, y: 0, w: UNIT, h: UNIT, labelSide: "top" },
    4: { x: 0, y: UNIT, w: UNIT, h: UNIT, labelSide: "left" },
    7: { x: UNIT, y: UNIT * 2, w: UNIT, h: UNIT, labelSide: "bottom" },
    10: { x: UNIT * 2, y: UNIT, w: UNIT, h: UNIT, labelSide: "right" },
};

interface CornerSpec {
    x: number;
    y: number;
    /** houseA occupies the triangle nearer `nearCorner`; houseB occupies the rest. */
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

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function planetLines(planets: Planet[], maxShow = 3): { label: string; overflow: number } {
    const show = planets.slice(0, maxShow);
    return {
        label: show
            .map((p) => `${PLANET_SHORT_SI[p.name] || ""}${p.retrograde && p.name !== 8 && p.name !== 9 ? "(ව)" : ""}`)
            .join(" "),
        overflow: Math.max(0, planets.length - maxShow),
    };
}

export function generateChartSvg(data: ChartInput, type: ChartType): string {
    const { planets, houses, ascendant } = data;

    const signByHouse: Record<number, number> = {};
    for (const h of houses) {
        signByHouse[h.houseNumber] = h.sign;
    }

    const planetsByHouse: Record<number, Planet[]> = {};
    for (const p of planets) {
        if (!planetsByHouse[p.house]) planetsByHouse[p.house] = [];
        planetsByHouse[p.house].push(p);
    }
    for (const hn of Object.keys(planetsByHouse)) {
        planetsByHouse[Number(hn)].sort((a, b) => a.degree - b.degree);
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 36}" viewBox="0 0 ${W} ${H + 36}">
  <defs>
    <style>
      .hnum { font-size: 12px; fill: #dc2626; font-weight: bold; }
      .sign-glyph { font-size: 18px; fill: #374151; text-anchor: middle; }
      .planet { font-size: 12px; fill: #1f2937; text-anchor: middle; }
      .center-time { font-size: 20px; fill: #1f2937; font-weight: bold; text-anchor: middle; }
      .center-glyph { font-size: 40px; fill: #db2777; text-anchor: middle; }
      .center-pill-text { font-size: 15px; fill: #ffffff; font-weight: bold; text-anchor: middle; }
      .title { font-size: 13px; fill: #374151; font-weight: bold; text-anchor: middle; }
      .sub { font-size: 9px; fill: #9ca3af; text-anchor: middle; }
    </style>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="#d1d5db" stroke-width="1.5" />`;

    // Edge-center houses: 1 (top), 4 (right), 7 (bottom), 10 (left)
    for (const houseNum of [1, 4, 7, 10]) {
        const spec = EDGE_HOUSES[houseNum];
        const sign = signByHouse[houseNum];
        const isAsc = ascendant.sign === sign;

        svg += `
    <rect x="${spec.x}" y="${spec.y}" width="${spec.w}" height="${spec.h}" fill="#ffffff" stroke="#d1d5db" stroke-width="${isAsc ? 2.5 : 1}" />`;

        const cx = spec.x + spec.w / 2;
        const cy = spec.y + spec.h / 2;

        const labelX = spec.labelSide === "right" ? spec.x + spec.w - 6 : spec.x + 6;
        const labelAnchor = spec.labelSide === "right" ? "end" : "start";
        const labelY = spec.labelSide === "bottom" ? spec.y + spec.h - 8 : spec.y + 16;

        svg += `
    <text x="${labelX}" y="${labelY}" class="hnum" text-anchor="${labelAnchor}">${houseNum}</text>
    <text x="${cx}" y="${cy - 6}" class="sign-glyph">${sign ? SIGN_GLYPHS[sign] : ""}</text>`;

        const housePlanets = planetsByHouse[houseNum] || [];
        if (housePlanets.length > 0) {
            const { label, overflow } = planetLines(housePlanets);
            svg += `
    <text x="${cx}" y="${cy + 16}" class="planet">${escapeXml(label)}${overflow > 0 ? ` +${overflow}` : ""}</text>`;
        }
    }

    // Corner cells, each split diagonally between two houses
    for (const corner of CORNERS) {
        const { x, y, houseA, houseB, nearCorner } = corner;
        const signA = signByHouse[houseA];
        const signB = signByHouse[houseB];
        const isAscA = ascendant.sign === signA;
        const isAscB = ascendant.sign === signB;

        svg += `
    <rect x="${x}" y="${y}" width="${UNIT}" height="${UNIT}" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />`;

        const corners = {
            tl: [x, y],
            tr: [x + UNIT, y],
            bl: [x, y + UNIT],
            br: [x + UNIT, y + UNIT],
        };
        const oppositeMap: Record<CornerSpec["nearCorner"], CornerSpec["nearCorner"]> = {
            tl: "br",
            tr: "bl",
            bl: "tr",
            br: "tl",
        };
        const far = corners[oppositeMap[nearCorner]];
        const adjacent1 = nearCorner === "tl" || nearCorner === "br" ? corners.tr : corners.tl;
        const adjacent2 = nearCorner === "tl" || nearCorner === "br" ? corners.bl : corners.br;
        const nearPt = corners[nearCorner];

        svg += `
    <line x1="${nearPt[0]}" y1="${nearPt[1]}" x2="${far[0]}" y2="${far[1]}" stroke="#d1d5db" stroke-width="1" />`;

        // Triangle A: the half containing `adjacent1`, bounded by the near<->far diagonal
        const aLabelX = adjacent1[0] + (adjacent1[0] === x ? 6 : -6);
        const aLabelY = adjacent1[1] + (adjacent1[1] === y ? 16 : -8);
        const aCenterX = (nearPt[0] + far[0] + adjacent1[0]) / 3;
        const aCenterY = (nearPt[1] + far[1] + adjacent1[1]) / 3;

        svg += `
    <text x="${aLabelX}" y="${aLabelY}" class="hnum" text-anchor="${adjacent1[0] === x ? "start" : "end"}">${houseA}</text>
    <text x="${aCenterX}" y="${aCenterY - 8}" class="sign-glyph" font-size="14">${signA ? SIGN_GLYPHS[signA] : ""}</text>`;
        if (isAscA) {
            svg += `
    <text x="${aCenterX}" y="${aCenterY + 8}" class="hnum" text-anchor="middle" font-size="9">ASC</text>`;
        }
        const planetsA = planetsByHouse[houseA] || [];
        if (planetsA.length > 0) {
            const { label, overflow } = planetLines(planetsA, 2);
            svg += `
    <text x="${aCenterX}" y="${aCenterY + (isAscA ? 20 : 10)}" class="planet" font-size="10">${escapeXml(label)}${overflow > 0 ? ` +${overflow}` : ""}</text>`;
        }

        // Triangle B: the half containing `adjacent2`, bounded by the near<->far diagonal
        const bLabelX = adjacent2[0] + (adjacent2[0] === x ? 6 : -6);
        const bLabelY = adjacent2[1] + (adjacent2[1] === y ? 16 : -8);
        const bCenterX = (nearPt[0] + far[0] + adjacent2[0]) / 3;
        const bCenterY = (nearPt[1] + far[1] + adjacent2[1]) / 3;

        svg += `
    <text x="${bLabelX}" y="${bLabelY}" class="hnum" text-anchor="${adjacent2[0] === x ? "start" : "end"}">${houseB}</text>
    <text x="${bCenterX}" y="${bCenterY - 8}" class="sign-glyph" font-size="14">${signB ? SIGN_GLYPHS[signB] : ""}</text>`;
        if (isAscB) {
            svg += `
    <text x="${bCenterX}" y="${bCenterY + 8}" class="hnum" text-anchor="middle" font-size="9">ASC</text>`;
        }
        const planetsB = planetsByHouse[houseB] || [];
        if (planetsB.length > 0) {
            const { label, overflow } = planetLines(planetsB, 2);
            svg += `
    <text x="${bCenterX}" y="${bCenterY + (isAscB ? 20 : 10)}" class="planet" font-size="10">${escapeXml(label)}${overflow > 0 ? ` +${overflow}` : ""}</text>`;
        }
    }

    // Center cell: ascendant degree, sign glyph, sign name pill
    const centerX = UNIT;
    const centerY = UNIT;
    const cx = centerX + UNIT / 2;

    svg += `
    <rect x="${centerX}" y="${centerY}" width="${UNIT}" height="${UNIT}" fill="#fdf4f0" stroke="#d1d5db" stroke-width="1" />
    <text x="${cx}" y="${centerY + 34}" class="center-time" font-size="14">${escapeXml(formatDegree(ascendant.degree))}</text>
    <text x="${cx}" y="${centerY + 78}" class="center-glyph" font-size="28">${SIGN_GLYPHS[ascendant.sign]}</text>
    <rect x="${cx - 42}" y="${centerY + 92}" width="84" height="24" rx="12" fill="#ec4899" />
    <text x="${cx}" y="${centerY + 108}" class="center-pill-text" font-size="12">${escapeXml(SIGN_SHORT_SI[ascendant.sign] || "")}</text>`;

    svg += `
  <text x="${W / 2}" y="${H + 18}" class="title">${escapeXml(type.replace(/-/g, " ").toUpperCase())}</text>
  <text x="${W / 2}" y="${H + 32}" class="sub">Vedic Astrology Chart</text>`;

    svg += `\n</svg>`;
    return svg;
}
