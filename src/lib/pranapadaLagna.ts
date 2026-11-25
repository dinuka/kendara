/** Pranapada Lagna (ප්‍රාණපද ලග්නය) per BPHS ch. 3 sl. 71–72 — see docs/done/pranapada-lagna.md.
 *
 *  The time from the sunrise preceding birth to the birth moment, in palas (vighatis, 24 s each),
 *  divided by 15 gives signs: one sign (30°) per 15 palas = 6 minutes, i.e. 5° per minute. That arc
 *  is added to the Sun's sidereal longitude at birth, plus a start offset by the nature of the Sun's
 *  sign — movable (chara) 0°, fixed (sthira) 240° (9th from the Sun), dual (dwiswabhava) 120° (5th
 *  from the Sun) — and the total is reduced mod 360°. */
import { RASHI_CATEGORY, type RashiCategory } from "@/lib/rashiAspects";

export interface PranapadaLagna {
    /** Sidereal longitude 0-360. */
    absoluteDegree: number;
    /** Sign 1-12. */
    sign: number;
    /** Degree within the sign, 0-30. */
    degree: number;
    /** Sun's sidereal longitude at birth, 0-360. */
    sunLongitude: number;
    /** Minutes from the preceding sunrise to birth (always >= 0). */
    elapsedMinutes: number;
    /** Palas (vighatis) from the preceding sunrise to birth. */
    elapsedPalas: number;
    /** Offset for the nature of the Sun's sign: 0, 240 or 120. */
    signOffset: number;
}

const SECONDS_PER_PALA = 24;
const PALAS_PER_SIGN = 15;

const SIGN_OFFSET: Record<RashiCategory, number> = { chara: 0, thira: 240, ubaya: 120 };

export const calculatePranapadaLagna = (sunLongitude: number, elapsedMinutes: number): PranapadaLagna => {
    if (elapsedMinutes < 0) {
        throw new Error("Birth must be at or after the sunrise Pranapada Lagna is counted from");
    }
    const sun = ((sunLongitude % 360) + 360) % 360;
    const palas = (elapsedMinutes * 60) / SECONDS_PER_PALA;
    const timeArc = (palas / PALAS_PER_SIGN) * 30;
    const signOffset = SIGN_OFFSET[RASHI_CATEGORY[Math.floor(sun / 30) + 1]];
    const longitude = (sun + signOffset + timeArc) % 360;
    return {
        absoluteDegree: +longitude.toFixed(4),
        sign: Math.floor(longitude / 30) + 1,
        degree: +(longitude % 30).toFixed(4),
        sunLongitude: +sun.toFixed(4),
        elapsedMinutes: +elapsedMinutes.toFixed(2),
        elapsedPalas: +palas.toFixed(2),
        signOffset,
    };
};
