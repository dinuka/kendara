/** The five Sun-based Upagrahas (උපග්‍රහ) per BPHS ch. 3 sl. 61–64 — see docs/upa-graha.md.
 *
 *  Each is derived from the previous one, starting from the Sun's sidereal longitude:
 *    Dhūma      = Sun + 133°20′
 *    Vyatipāta  = 360° − Dhūma
 *    Pariveṣa   = Vyatipāta + 180°
 *    Indrachāpa = 360° − Pariveṣa
 *    Upaketu    = Indrachāpa + 16°40′   (always Sun − 30°, sl. 64)
 *  All longitudes are kept in [0°, 360°). */
export type UpagrahaKey = "dhuma" | "vyatipata" | "parivesha" | "indrachapa" | "upaketu";

/** Display order, as listed in the slokas. */
export const UPAGRAHA_KEYS: readonly UpagrahaKey[] = ["dhuma", "vyatipata", "parivesha", "indrachapa", "upaketu"];

/** Birth chart markers. */
export const UPAGRAHA_MARKERS = {
    dhuma: "D",
    vyatipata: "V",
    parivesha: "P",
    indrachapa: "I",
    upaketu: "U",
} as const satisfies Record<UpagrahaKey, string>;

export interface UpagrahaPosition {
    key: UpagrahaKey;
    /** Absolute sidereal longitude, 0–360. */
    longitude: number;
    /** Sign 1-12. */
    sign: number;
    /** Degree within the sign, 0–30. */
    degree: number;
}

/** Rounding to 1e-9° keeps exact sign boundaries (e.g. 360° − 330° = 30°) from landing on the
 *  wrong side through floating-point noise. */
const normalize = (degree: number): number => {
    const value = Math.round((((degree % 360) + 360) % 360) * 1e9) / 1e9;
    return value === 360 ? 0 : value;
};

const DHUMA_OFFSET = 133 + 20 / 60;
const UPAKETU_OFFSET = 16 + 40 / 60;

export const calculateUpagrahaLongitudes = (sunLongitude: number): Record<UpagrahaKey, number> => {
    if (!Number.isFinite(sunLongitude)) throw new Error("Sun longitude must be a finite number");
    const dhuma = normalize(sunLongitude + DHUMA_OFFSET);
    const vyatipata = normalize(360 - dhuma);
    const parivesha = normalize(vyatipata + 180);
    const indrachapa = normalize(360 - parivesha);
    const upaketu = normalize(indrachapa + UPAKETU_OFFSET);
    return { dhuma, vyatipata, parivesha, indrachapa, upaketu };
};

/** The five Upagrahas in display order, each with its sign and in-sign degree. */
export const calculateUpagrahas = (sunLongitude: number): UpagrahaPosition[] => {
    const longitudes = calculateUpagrahaLongitudes(sunLongitude);
    return UPAGRAHA_KEYS.map((key) => {
        const longitude = longitudes[key];
        const signIndex = Math.floor(longitude / 30);
        return { key, longitude, sign: signIndex + 1, degree: longitude - signIndex * 30 };
    });
};
