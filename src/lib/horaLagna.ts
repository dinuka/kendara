/** Hora Lagna (හෝරා ලග්නය) per BPHS ch. 5 sl. 4–5 — see docs/hora-lagna.md.
 *
 *  It starts at the Sun's sidereal longitude at the sunrise preceding birth and advances one sign
 *  (30°) for every hour (2½ ghatikas) elapsed from that sunrise to the birth moment. */
export interface HoraLagna {
    /** Sidereal longitude 0-360. */
    absoluteDegree: number;
    /** Sign 1-12. */
    sign: number;
    /** Degree within the sign, 0-30. */
    degree: number;
    /** Sun's sidereal longitude at the sunrise preceding birth, 0-360. */
    sunriseSunLongitude: number;
    /** Minutes from that sunrise to birth (always >= 0). */
    elapsedMinutes: number;
}

const DEGREES_PER_HOUR = 30;

export const calculateHoraLagna = (sunriseSunLongitude: number, elapsedMinutes: number): HoraLagna => {
    if (elapsedMinutes < 0) {
        throw new Error("Birth must be at or after the sunrise Hora Lagna is counted from");
    }
    const longitude = (((sunriseSunLongitude + (elapsedMinutes / 60) * DEGREES_PER_HOUR) % 360) + 360) % 360;
    return {
        absoluteDegree: +longitude.toFixed(4),
        sign: Math.floor(longitude / 30) + 1,
        degree: +(longitude % 30).toFixed(4),
        sunriseSunLongitude: +sunriseSunLongitude.toFixed(4),
        elapsedMinutes: +elapsedMinutes.toFixed(2),
    };
};
