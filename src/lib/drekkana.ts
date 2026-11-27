/** Drekkana (ද්‍රේක්කාණ, D3) — Parāśara drekkana: each 30° sign is split into three 10° parts.
 *    - 0–10°  → the same sign
 *    - 10–20° → the 5th sign from it
 *    - 20–30° → the 9th sign from it
 *  Lower boundaries are inclusive, upper boundaries exclusive. Only the D3 sign is derived — no
 *  D3 degree longitude. */
import { ZodiacSign } from "@/lib/astrologyEnums";
import type { ChartInput } from "@/lib/chartDataTransform";
import { buildDivisionalChart, normalizeDegreeInSign } from "@/lib/divisionalChart";

const DREKKANA_OFFSETS = [0, 4, 8] as const;

/** D3 sign (1-12) for a D1 sign (1-12) and the degree within that sign. */
const drekkanaSign = (sign: number, degreeInSign: number | undefined): ZodiacSign => {
    const part = Math.min(Math.floor(normalizeDegreeInSign(degreeInSign) / 10), 2);
    return (((sign - 1 + DREKKANA_OFFSETS[part]) % 12) + 1) as ZodiacSign;
};

/** D3 chart from a D1 chart with real in-sign degrees (see buildDivisionalChart). */
const buildDrekkanaChart = (chart: Pick<ChartInput, "planets" | "ascendant">): ChartInput =>
    buildDivisionalChart(chart, drekkanaSign);

export { buildDrekkanaChart, drekkanaSign };
