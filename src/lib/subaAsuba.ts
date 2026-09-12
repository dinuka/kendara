import { computeThithiFromPlanets } from "@/lib/astrology";
import { Planet } from "@/lib/astrologyEnums";

// Suba Asuba (සුබ / අසුබ) — the per-planet Naisargika (natural) benefic/malefic verdict (පාපී
// ග්‍රහයන්), computed once at calculation time so new CalculatedDetails docs carry the verdict and
// its reasons; legacy docs are lazily recomputed at render (see docs/papi-grahayan.md):
//
//     suba  (auspicious):  Guru (Jupiter), Shukra (Venus); Budha (Mercury) alone or with a
//                          benefic; a waxing (Shukla Paksha) Moon.
//     asuba (inauspicious): Ravi (Sun), Kuja (Mars), Shani (Saturn), Rahu, Ketu; Budha with a
//                          malefic; a waning (Krishna Paksha) Moon.
//
// Kendra exception: a suba-classified planet that OWNS a Kendra house (1, 4, 7 or 10 — i.e. it is
// the sign-lord of the sign occupying that house in the D1 chart) is deemed asuba, with the kendra
// reason appended to the natural association reason.
//
// Values are always numeric enum values; display labels are resolved per-locale at render time via
// i18n messages (astrology.papiGrahayan.*).

export enum SubaAsuba {
    SUBA = 1,
    ASUBA = 2,
}

/** Human-readable reason for a verdict. `key` is a nested key under `astrology.papiGrahayan.reason`
 *  (e.g. "papiGrahayan.reason.kendra"); `params` hold numeric or comma-joined-numeric values that
 *  the caller substitutes with localized names at render time. */
export interface SubaAsubaReason {
    key: string;
    params?: Record<string, string | number>;
}

/** Verdict for a single planet plus every reason that produced it (natural kind, Budha/Moon
 *  association, kendra lordship override). */
export interface SubaAsubaEntry {
    value: SubaAsuba;
    reasons: SubaAsubaReason[];
}

/** All planets' verdicts, keyed by the numeric Planet enum ("1".."9"). */
export type SubaAsubaByPlanet = Record<string, SubaAsubaEntry>;

export const NATURAL_BENEFICS: ReadonlySet<Planet> = new Set([Planet.JUPITER, Planet.VENUS]);

export const NATURAL_MALEFICS: ReadonlySet<Planet> = new Set([
    Planet.SUN,
    Planet.MARS,
    Planet.SATURN,
    Planet.RAHU,
    Planet.KETU,
]);

/** Kendras (1/4/7/10): a suba-classified planet that owns one of these houses is deemed asuba
 *  (kendra lordship exception). */
export const KENDRA_HOUSES: ReadonlySet<number> = new Set([1, 4, 7, 10]);

/** Minimal planet shape consumed by computeSubaAsuba (whole-sign house + numeric enum name). */
export interface SubaAsubaPlanet {
    name: number;
    house: number;
}

/** Minimal house shape consumed by computeSubaAsuba — enough to resolve which planet is the
 *  sign-lord of each Kendra house. */
export interface SubaAsubaHouse {
    houseNumber: number;
    lord: number;
}

/** Sign lords by sign (1-12): Aries→Mars, Taurus→Venus, Gemini→Mercury, Cancer→Moon, Leo→Sun,
 *  Virgo→Mercury, Libra→Venus, Scorpio→Mars, Sagittarius→Jupiter, Capricorn→Saturn, Aquarius→Saturn,
 *  Pisces→Jupiter. Local copy — the module cannot import manualChart.ts's (that module is wired into
 *  the native/bundling exclusions), and astrology.ts's copy is private (circular import). */
const SIGN_LORD: Record<number, number> = {
    1: 3,
    2: 6,
    3: 4,
    4: 2,
    5: 1,
    6: 4,
    7: 6,
    8: 3,
    9: 5,
    10: 7,
    11: 7,
    12: 5,
};

const classifyPlanet = (
    p: SubaAsubaPlanet,
    thithi: number,
    companions: SubaAsubaPlanet[],
    ownedKendraHouses: number[],
): SubaAsubaEntry => {
    let value: SubaAsuba;
    const reasons: SubaAsubaReason[] = [];

    if (p.name === Planet.MOON) {
        const waxing = thithi >= 1 && thithi <= 15;
        value = waxing ? SubaAsuba.SUBA : SubaAsuba.ASUBA;
        reasons.push({
            key: waxing ? "papiGrahayan.reason.moonWaxing" : "papiGrahayan.reason.moonWaning",
            params: { thithi },
        });
    } else if (p.name === Planet.MERCURY) {
        const others = companions.filter((q) => q.name !== p.name);
        if (others.length === 0) {
            value = SubaAsuba.SUBA;
            reasons.push({ key: "papiGrahayan.reason.budhaAlone" });
        } else {
            const malefics = others.filter((q) => NATURAL_MALEFICS.has(q.name));
            if (malefics.length > 0) {
                value = SubaAsuba.ASUBA;
                reasons.push({
                    key: "papiGrahayan.reason.budhaWithMalefic",
                    params: { planets: malefics.map((q) => q.name).join(",") },
                });
            } else {
                value = SubaAsuba.SUBA;
                reasons.push({
                    key: "papiGrahayan.reason.budhaWithBenefic",
                    params: { planets: others.map((q) => q.name).join(",") },
                });
            }
        }
    } else if (NATURAL_BENEFICS.has(p.name)) {
        value = SubaAsuba.SUBA;
        reasons.push({ key: "papiGrahayan.reason.naturalBenefic", params: { planet: p.name } });
    } else {
        value = SubaAsuba.ASUBA;
        reasons.push({ key: "papiGrahayan.reason.naturalMalefic", params: { planet: p.name } });
    }

    if (value === SubaAsuba.SUBA && ownedKendraHouses.length > 0) {
        value = SubaAsuba.ASUBA;
        reasons.push({
            key: "papiGrahayan.reason.kendra",
            params: { planet: p.name, houses: ownedKendraHouses.join(",") },
        });
    }

    return { value, reasons };
};

/** Compute the per-planet Suba/Asuba verdicts for a set of planets (normally all 9). `houses` is the
 *  D1 whole-sign house list (houseNumber + its sign-lord) used for the Kendra-lordship exception. The
 *  returned object is keyed by the numeric Planet enum value as a string ("1".."9"). */
export const computeSubaAsuba = (
    planets: SubaAsubaPlanet[],
    houses: SubaAsubaHouse[],
    thithi: number,
): SubaAsubaByPlanet => {
    const byHouse = new Map<number, SubaAsubaPlanet[]>();
    for (const p of planets) {
        const list = byHouse.get(p.house) ?? [];
        list.push(p);
        byHouse.set(p.house, list);
    }
    const kendraByLord = new Map<number, number[]>();
    for (const h of houses) {
        if (!KENDRA_HOUSES.has(h.houseNumber)) continue;
        const list = kendraByLord.get(h.lord) ?? [];
        list.push(h.houseNumber);
        kendraByLord.set(h.lord, list);
    }
    const result: SubaAsubaByPlanet = {};
    for (const p of planets) {
        result[String(p.name)] = classifyPlanet(
            p,
            thithi,
            byHouse.get(p.house) ?? [],
            (kendraByLord.get(p.name) ?? []).sort((a, b) => a - b),
        );
    }
    return result;
};

// ---------------------------------------------------------------------------
// Resolution helpers shared by the render path (horoscope page, search). The
// persisted CalculatedDetails doc is treated as an opaque record:
//
//   - stored record with valid entries wins;
//   - stored corrupt record → undefined + console.warn (never guessed);
//   - stored empty/sparse record → falls through to the pure-function fallback;
//   - absent field → pure-function fallback from stored planets + thithi.
// ---------------------------------------------------------------------------

type CalcLike = Record<string, unknown>;

const isSubaAsubaValue = (value: unknown): value is SubaAsuba => value === SubaAsuba.SUBA || value === SubaAsuba.ASUBA;

const isValidReason = (value: unknown): value is SubaAsubaReason => {
    if (!value || typeof value !== "object") return false;
    const key = (value as CalcLike).key;
    return typeof key === "string" && key.length > 0;
};

const isValidEntry = (value: unknown): value is SubaAsubaEntry => {
    if (!value || typeof value !== "object") return false;
    const raw = value as CalcLike;
    if (!isSubaAsubaValue(raw.value)) return false;
    const reasons = raw.reasons;
    if (reasons === undefined || reasons === null) return true;
    if (!Array.isArray(reasons)) return false;
    return reasons.every(isValidReason);
};

const normalizeThithi = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 30 ? value : undefined;

const normalizePlanets = (value: unknown): SubaAsubaPlanet[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const planets: SubaAsubaPlanet[] = [];
    for (const p of value) {
        if (!p || typeof p !== "object") continue;
        const { name, house } = p as CalcLike;
        if (
            typeof name === "number" &&
            Number.isInteger(name) &&
            name >= 1 &&
            name <= 9 &&
            typeof house === "number" &&
            Number.isInteger(house) &&
            house >= 1 &&
            house <= 12
        ) {
            planets.push({ name, house });
        }
    }
    return planets.length > 0 ? planets : undefined;
};

/** Normalize a stored Houses array (each house carries `houseNumber` + whole-sign `lord`) into the
 *  minimal shape computeSubaAsuba needs. Undefined when the doc holds no usable house rows. */
const normalizeHouses = (value: unknown): SubaAsubaHouse[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const houses: SubaAsubaHouse[] = [];
    for (const h of value) {
        if (!h || typeof h !== "object") continue;
        const { houseNumber, lord } = h as CalcLike;
        if (
            typeof houseNumber === "number" &&
            Number.isInteger(houseNumber) &&
            houseNumber >= 1 &&
            houseNumber <= 12 &&
            typeof lord === "number" &&
            Number.isInteger(lord) &&
            lord >= 1 &&
            lord <= 9
        ) {
            houses.push({ houseNumber, lord });
        }
    }
    return houses.length > 0 ? houses : undefined;
};

/** Fallback ownership derivation for legacy docs without a Houses array: whole-sign lordship straight
 *  from the stored ascendant sign (house N's sign is `((asc - 1 + N - 1) % 12) + 1`). */
const housesFromAscendant = (doc: CalcLike): SubaAsubaHouse[] => {
    const ascendant = doc.ascendant;
    const ascSign = ascendant && typeof ascendant === "object" ? (ascendant as CalcLike).sign : undefined;
    if (typeof ascSign !== "number" || !Number.isInteger(ascSign) || ascSign < 1 || ascSign > 12) return [];
    return Array.from({ length: 12 }, (_, i) => {
        const sign = ((ascSign - 1 + i) % 12) + 1;
        return { houseNumber: i + 1, lord: SIGN_LORD[sign] };
    });
};

/** Resolves the Suba/Asuba verdicts for a persisted CalculatedDetails doc (may be null/undefined).
 *  Stored entries win; legacy docs without the field are recomputed from the stored planets, thithi
 *  and Houses (or ascendant-derived lordship). Returns undefined only when the doc holds no usable
 *  planets. */
export const resolveSubaAsuba = (calculatedDetails: unknown): SubaAsubaByPlanet | undefined => {
    if (!calculatedDetails || typeof calculatedDetails !== "object") return undefined;
    const doc = calculatedDetails as CalcLike;

    const stored = doc.subaAsuba;
    if (stored !== undefined && stored !== null) {
        if (!stored || typeof stored !== "object") {
            console.warn("Invalid stored subaAsuba record:", stored);
            return undefined;
        }
        const record: SubaAsubaByPlanet = {};
        for (const [key, entry] of Object.entries(stored as CalcLike)) {
            const planet = Number(key);
            if (!Number.isInteger(planet) || planet < 1 || planet > 9) continue;
            if (isValidEntry(entry)) record[key] = entry;
        }
        if (Object.keys(record).length > 0) return record;
    }

    const planets = normalizePlanets(doc.planets);
    if (!planets) return undefined;

    let effectiveThithi = normalizeThithi(doc.thithi);
    if (effectiveThithi === undefined) {
        const positions = Array.isArray(doc.planets)
            ? doc.planets.filter(
                  (p): p is { name: number; absoluteDegree: number } =>
                      !!p &&
                      typeof p === "object" &&
                      typeof (p as CalcLike).name === "number" &&
                      typeof (p as CalcLike).absoluteDegree === "number",
              )
            : [];
        effectiveThithi = computeThithiFromPlanets(positions);
    }
    const houses = normalizeHouses(doc.houses) ?? housesFromAscendant(doc);
    return computeSubaAsuba(planets, houses, effectiveThithi);
};
