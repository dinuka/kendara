/** Trimshamsha (ත්‍රිංශාංශකය, D30) — Parāśara-style division of each 30° sign into five unequal
 *  bands whose D30 sign depends on the parity of the D1 sign (docs/thinshashankaya.md):
 *    - odd signs (Aries, Gemini, ...):    0–5 Aries, 5–10 Aquarius, 10–18 Sagittarius, 18–25 Gemini, 25–30 Libra
 *    - even signs (Taurus, Cancer, ...):  0–5 Taurus, 5–12 Virgo, 12–20 Pisces, 20–25 Capricorn, 25–30 Scorpio
 *  Lower boundaries are inclusive, upper boundaries exclusive. Only the D30 sign is derived — no
 *  D30 degree longitude. */
import { ZodiacSign } from "@/lib/astrologyEnums";
import type { ChartInput } from "@/lib/chartDataTransform";
import { buildDivisionalChart, normalizeDegreeInSign } from "@/lib/divisionalChart";

interface TrimshamshaBand {
    end: number;
    sign: ZodiacSign;
}

const ODD_SIGN_BANDS: TrimshamshaBand[] = [
    { end: 5, sign: ZodiacSign.ARIES },
    { end: 10, sign: ZodiacSign.AQUARIUS },
    { end: 18, sign: ZodiacSign.SAGITTARIUS },
    { end: 25, sign: ZodiacSign.GEMINI },
    { end: 30, sign: ZodiacSign.LIBRA },
];

const EVEN_SIGN_BANDS: TrimshamshaBand[] = [
    { end: 5, sign: ZodiacSign.TAURUS },
    { end: 12, sign: ZodiacSign.VIRGO },
    { end: 20, sign: ZodiacSign.PISCES },
    { end: 25, sign: ZodiacSign.CAPRICORN },
    { end: 30, sign: ZodiacSign.SCORPIO },
];

/** D30 sign (1-12) for a D1 sign (1-12) and the degree within that sign. The degree is normalized
 *  into [0, 30) so absolute longitudes and missing values degrade gracefully. */
const trimshamshaSign = (sign: number, degreeInSign: number | undefined): ZodiacSign => {
    const degree = normalizeDegreeInSign(degreeInSign);
    const bands = sign % 2 === 1 ? ODD_SIGN_BANDS : EVEN_SIGN_BANDS;
    return (bands.find(({ end }) => degree < end) ?? bands[bands.length - 1]).sign;
};

/** D30 chart from a D1 chart with real in-sign degrees (auto calculations only — manual charts
 *  carry synthetic degrees). Every planet and the lagna move to their D30 sign; houses are
 *  whole-sign from the D30 lagna and strengths are re-derived from the D30 sign. */
const buildTrimshamshaChart = (chart: Pick<ChartInput, "planets" | "ascendant">): ChartInput =>
    buildDivisionalChart(chart, trimshamshaSign);

export { buildTrimshamshaChart, trimshamshaSign };
