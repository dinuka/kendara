import { Ascendant, House, Planet } from "@/lib/astrology";
import { ChartType } from "@/lib/chartTypes";

const PLANET_SYMBOLS: Record<number, string> = {
    1: "\u2609",
    2: "\u263D",
    3: "\u2642",
    4: "\u263F",
    5: "\u2643",
    6: "\u2640",
    7: "\u2644",
    8: "\u260A",
    9: "\u260B",
};

const PLANET_SHORT: Record<number, string> = {
    1: "Sun",
    2: "Moo",
    3: "Mar",
    4: "Mer",
    5: "Jup",
    6: "Ven",
    7: "Sat",
    8: "Rah",
    9: "Ket",
};

const SIGN_NAMES: Record<number, string> = {
    1: "Mes",
    2: "Vrs",
    3: "Mth",
    4: "Ktk",
    5: "Sim",
    6: "Kan",
    7: "Tul",
    8: "Vsc",
    9: "Dhn",
    10: "Mkr",
    11: "Kmb",
    12: "Min",
};

const ELEMENT_COLORS: Record<number, string> = {
    1: "#fee2e2",
    2: "#d1fae5",
    3: "#dbeafe",
    4: "#e9d5ff",
    5: "#fee2e2",
    6: "#d1fae5",
    7: "#dbeafe",
    8: "#e9d5ff",
    9: "#fee2e2",
    10: "#d1fae5",
    11: "#dbeafe",
    12: "#e9d5ff",
};

const ELEMENT_BORDERS: Record<number, string> = {
    1: "#ef4444",
    2: "#10b981",
    3: "#3b82f6",
    4: "#8b5cf6",
    5: "#ef4444",
    6: "#10b981",
    7: "#3b82f6",
    8: "#8b5cf6",
    9: "#ef4444",
    10: "#10b981",
    11: "#3b82f6",
    12: "#8b5cf6",
};

interface ChartInput {
    planets: Planet[];
    houses: House[];
    ascendant: Ascendant;
}

const GRID = 120;

const LAYOUT: Record<number, { row: number; col: number }> = {
    1: { row: 0, col: 3 },
    2: { row: 0, col: 2 },
    3: { row: 0, col: 1 },
    4: { row: 0, col: 0 },
    5: { row: 1, col: 0 },
    6: { row: 2, col: 0 },
    7: { row: 3, col: 0 },
    8: { row: 3, col: 1 },
    9: { row: 3, col: 2 },
    10: { row: 3, col: 3 },
    11: { row: 2, col: 3 },
    12: { row: 1, col: 3 },
};

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateChartSvg(data: ChartInput, type: ChartType): string {
    const { planets, houses, ascendant } = data;
    const W = GRID * 4;
    const H = GRID * 4;

    const houseSignMap: Record<number, number> = {};
    for (const h of houses) {
        houseSignMap[h.houseNumber] = h.sign;
    }

    const planetsInHouse: Record<number, Planet[]> = {};
    for (const p of planets) {
        const h = p.house;
        if (!planetsInHouse[h]) planetsInHouse[h] = [];
        planetsInHouse[h].push(p);
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .hnum { font-size: 10px; fill: #666; }
      .sign { font-size: 11px; fill: #374151; font-weight: bold; }
      .planet { font-size: 18px; }
      .plabel { font-size: 8px; fill: #6b7280; }
      .title { font-size: 13px; fill: #374151; font-weight: bold; text-anchor: middle; }
      .sub { font-size: 9px; fill: #9ca3af; text-anchor: middle; }
      .as-flag { font-size: 8px; fill: #ef4444; font-weight: bold; }
    </style>
  </defs>`;

    for (let hn = 1; hn <= 12; hn++) {
        const { row, col } = LAYOUT[hn];
        const x = col * GRID;
        const y = row * GRID;
        const sign = houseSignMap[hn] || 0;
        const bg = sign ? ELEMENT_COLORS[sign] || "#ffffff" : "#ffffff";
        const border = sign ? ELEMENT_BORDERS[sign] || "#d1d5db" : "#d1d5db";
        const isAsc = ascendant.sign === sign;

        svg += `
    <rect x="${x}" y="${y}" width="${GRID}" height="${GRID}" fill="${bg}" stroke="${border}" stroke-width="${isAsc ? 2.5 : 1}" />`;

        svg += `
    <text x="${x + 4}" y="${y + 12}" class="hnum">${isAsc ? "ASC" : hn}</text>`;

        if (sign) {
            svg += `
    <text x="${x + GRID / 2}" y="${y + 30}" class="sign" text-anchor="middle">${escapeXml(SIGN_NAMES[sign] || "")}</text>`;
        }

        const housePlanets = planetsInHouse[hn] || [];
        if (housePlanets.length > 0) {
            const maxShow = 4;
            const show = housePlanets.slice(0, maxShow);
            show.forEach((p, i) => {
                const px = x + 10 + (i % 2) * 50;
                const py = y + 52 + Math.floor(i / 2) * 28;
                if (p.name === 8 || p.name === 9) {
                    svg += `
    <text x="${px}" y="${py - 2}" class="planet" font-size="14">${escapeXml(PLANET_SHORT[p.name] || "")}</text>`;
                } else {
                    const symbol = PLANET_SYMBOLS[p.name] || "";
                    svg += `
    <text x="${px}" y="${py}" class="planet">${escapeXml(symbol)}</text>`;
                    svg += `
    <text x="${px + 22}" y="${py - 2}" class="plabel">${escapeXml(PLANET_SHORT[p.name] || "")}</text>`;
                }
            });
            if (housePlanets.length > maxShow) {
                svg += `
    <text x="${x + GRID - 4}" y="${y + GRID - 4}" class="plabel" text-anchor="end">+${housePlanets.length - maxShow}</text>`;
            }
        }

        if (isAsc) {
            svg += `
    <text x="${x + GRID - 4}" y="${y + GRID - 4}" class="as-flag" text-anchor="end">ASC</text>`;
        }
    }

    svg += `
  <text x="${W / 2}" y="${H + 18}" class="title">${escapeXml(type.replace(/-/g, " ").toUpperCase())}</text>
  <text x="${W / 2}" y="${H + 32}" class="sub">Vedic Astrology Chart</text>`;

    svg += `\n</svg>`;
    return svg;
}
