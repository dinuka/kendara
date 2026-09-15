/** Student Notepad — per-planet strength factors + Graha bala context tags (TODO #26, "planet
 *  section before parent tags").
 *  Pure derivation, no ephemeris, no I/O (same contract as `shadBalaya.ts` / `notepadObservations.ts`).
 *  For every planet present in the chart it derives an ordered list of strength FACTORS (the
 *  sub-tags that explain a planet's strength). Only PRESENT factors are emitted — absence NEVER
 *  produces a tag (user-confirmed 2026-08-19: "no need to show negative tags", e.g. no
 *  "මරණකාරක නොවේ"). A factor only emits when its source data exists (a missing list/flag is NOT a
 *  factor). The planet ratio counts ONLY the shown (emitted) factors: `{ green, green + red }` —
 *  green against every coloured tag; white/informational tags (Sama sign, retrograde) are shown but
 *  never affect the ratio. The student can cycle any factor's classification (green → red → white)
 *  and the effective classification persists per (student, horoscope) on
 *  `HoroscopeNote.planetFactorOverrides`.
 *
 *  Factor catalog (stable keys, display order — see `PLANET_STRENGTH_FACTORS` in notepadCatalogs):
 *  - `sign` / `navamsa` — sign / navamsa dignity (`classifyPlanetStrength`; green / red / white).
 *  - `dig` / `kala` / `cheshta` / `naisargika` — shadbalaya balas, emitted only when gained
 *                         (true) → green; `dig` never for Rahu/Ketu.
 *  - `retrograde`       — informational white tag, emitted only when retrograde.
 *  - `combust`          — emitted only when combust (true) → red.
 *  - karaka flags (`atmakaraka`/`yogakaraka` benefic green; `maranakaraka`/`maraka`/`badhaka`
 *                   malefic red) and varga flags (`wargoththama`/`pushkara` benefic green;
 *                   `gandantha`/`gandamula`/`ashtamansha`/`nidhanamsha` malefic red) — emitted only
 *                   when the planet is a member of the flag's source data.
 *
 *  Context tags (never counted toward the ratio, shown for information only — TODO #25/#26/#27):
 *  - `conjunctions` — warga D1 conjunctions (whole-sign) or stored same-sign fallback.
 *  - `receivedAspects` — aspects received on this planet (the aspecting planet's drishti).
 *  - `bhavaSuchika` — Navamsa sign's D1 house (1-12).
 *  - `ownedHouses` — houses this planet rules (whole-sign lordship), replacing the old `house`
 *                     factor chip.
 *  - `houseOwner` — lord of this planet's D1 house + its other owned houses.
 *  - `nakshatraOwner` — Vimshottari lord of the nakshatra this planet occupies.
 *
 *  The derivation never throws (per-planet try/catch degrades a broken planet to zero factors) and
 *  `calculatedDetails: null`/empty yields no entries. */
import { type Aspect, getNakshatraLord } from "@/lib/astrology";
import {
    type ObservationColor,
    PLANET_FACTOR_COLORS,
    PLANET_STRENGTH_FACTORS,
    type PlanetFactorColor,
    type PlanetStrengthFactorKey,
} from "@/lib/notepadCatalogs";
import { SIGN_LORD, classifyPlanetStrength, ownedHousesOf, wholeSignOf } from "@/lib/notepadObservations";
import type { CalculatedDetailsLike, PlanetLike } from "@/lib/notepadObservations";
import { resolveWargaKendara } from "@/lib/wargaKendara";

/** One derived strength factor (a sub-tag) for a planet. `color` is the EFFECTIVE classification
 *  after applying the student's stored override (derived colour when none is stored). */
export interface PlanetStrengthFactor {
    key: PlanetStrengthFactorKey;
    planet: number;
    color: PlanetFactorColor;
    /** Optional numeric params interpolated into the factor label message. */
    params?: Record<string, number>;
}

/** One conjunction: the other planet's enum + the true-degree orb when both stored absolute degrees
 *  exist (`|a - b|`; formatting done at render — "the conjunct difference as the calculation table
 *  shows", TODO #27). */
export interface PlanetConjunction {
    planet: number;
    orb?: number;
}

/** One received aspect: the ASPECTING planet + its angle. `aspect` carries the stored record (its
 *  `reasons`/`delta` power the "aspect difference as the calculation table shows" tooltip) when
 *  present on the page payload; null for the warga whole-sign fallback (no degree data). */
export interface ReceivedAspect {
    planet: number;
    aspectType: number;
    /** Whole-sign the aspecting planet occupies — feeds the rashi reason lines ("as the table
     *  shows"). */
    aspectingSign?: number;
    aspect: Aspect | null;
}

export interface PlanetStrengthEntry {
    planet: number;
    /** The emitted (present-only) factors in catalog order — the panel's sub-tags. */
    factors: PlanetStrengthFactor[];
    /** `{ green, total }` — green counts the effective-green SHOWN tags; total counts green + red
     *  shown tags. White (informational/neutral) tags are shown but never affect the ratio;
     *  absent factors are never emitted at all. */
    ratio: { green: number; total: number };
    /** Planets conjunct to this planet, enum order. Informational — never part of the ratio. */
    conjunctions: PlanetConjunction[];
    /** Aspects received (the aspecting planet's drishti on THIS planet), enum order.
     *  Informational — never part of the ratio. */
    receivedAspects: ReceivedAspect[];
    /** Bhava Suchika (භාව සුචික) for this planet — its Navamsa sign's D1 house. */
    bhavaSuchika?: number;
    /** Houses this planet rules (whole-sign lordship from the lagna) — replaces the old `house`
     *  factor chip (TODO #25). */
    ownedHouses: number[];
    /** Lord of this planet's D1 house — the planet house-owner tag (TODO #26). */
    houseOwner?: number;
    /** The other houses the house owner rules — its ownership context (TODO #26). */
    houseOwnerHouses: number[];
    /** Lord of the nakshatra this planet occupies (TODO #27). */
    nakshatraOwner?: number;
}

/** Stored student overrides: `Record<planet-enum-string, Record<factorKey, classification>>`.
 *  Only factors the student touched are present; the rest stay derived. */
export type PlanetFactorOverrides = Record<string, Partial<Record<PlanetStrengthFactorKey, PlanetFactorColor>>>;

/** The 5-band ratio colour rule (TODO #26): 0-25% dark red, 25-40% light red, 40-60% white, 60-80%
 *  light green, 80-100% dark green. A zero-total (no green/red shown tags) is neutral white. */
export function ratioColorOf(ratio: { green: number; total: number }): ObservationColor {
    if (ratio.total <= 0) return "white";
    const pct = (ratio.green / ratio.total) * 100;
    if (pct <= 25) return "darkRed";
    if (pct <= 40) return "lightRed";
    if (pct <= 60) return "white";
    if (pct <= 80) return "lightGreen";
    return "darkGreen";
}

/** The bhava (house-number) colour rule shared by the ownership / Bhava-Suchika context tags
 *  (user-confirmed): 6/8/12 red, 1/5/9 green, anything else gray (neutral white). */
export function bhavaColorOf(house: number): ObservationColor {
    if (house === 6 || house === 8 || house === 12) return "red";
    if (house === 1 || house === 5 || house === 9) return "green";
    return "white";
}

/** The student toggle cycle for a factor's classification: green → red → white → green. The derived
 *  colour is the starting point; every click advances one step (an override persists). */
export function nextPlanetFactorColor(current: PlanetFactorColor): PlanetFactorColor {
    const index = PLANET_FACTOR_COLORS.indexOf(current);
    return PLANET_FACTOR_COLORS[(index + 1) % PLANET_FACTOR_COLORS.length];
}

/** The planet's D1 house — `wargaKendara.d1` whole-sign houses are authoritative when present
 *  (same rule as `d1HousePlanets` in notepadObservations), else the stored `planets[].house`. */
function d1HouseOf(
    calculated: CalculatedDetailsLike,
    warga: ReturnType<typeof resolveWargaKendara>,
    planet: number,
    row: PlanetLike,
): number | undefined {
    const index = warga?.d1?.houses?.findIndex((h) => Array.isArray(h?.planets) && h.planets.includes(planet));
    if (index !== undefined && index >= 0) return index + 1;
    return row.house;
}

interface FactorCtx {
    calculated: CalculatedDetailsLike;
    warga: ReturnType<typeof resolveWargaKendara>;
    planet: number;
    row: PlanetLike;
    house: number | undefined;
}

type FactorBuilder = (ctx: FactorCtx) => PlanetStrengthFactor | null;

const factorSign: FactorBuilder = ({ planet, row }) => {
    if (typeof row.strength !== "number") return null;
    const color = classifyPlanetStrength({
        kind: "planet",
        color: "white",
        strength: row.strength,
    }) as PlanetFactorColor;
    return {
        key: "sign",
        planet,
        color,
        params: row.sign !== undefined ? { sign: row.sign, strength: row.strength } : undefined,
    };
};

const factorNavamsa: FactorBuilder = ({ planet, row }) => {
    if (typeof row.navamsaStrength !== "number") return null;
    const color = classifyPlanetStrength({
        kind: "planet",
        color: "white",
        strength: row.navamsaStrength,
    }) as PlanetFactorColor;
    return {
        key: "navamsa",
        planet,
        color,
        params: row.navamsaSign !== undefined ? { sign: row.navamsaSign, strength: row.navamsaStrength } : undefined,
    };
};

/** The shadbalaya bala key behind each bala factor (the stored keys use the `Bala` suffix). */
const SHADBALAYA_KEY_BY_FACTOR: Partial<
    Record<PlanetStrengthFactorKey, "digBala" | "kalaBala" | "cheshtaBala" | "naisargikaBala">
> = {
    dig: "digBala",
    kala: "kalaBala",
    cheshta: "cheshtaBala",
    naisargika: "naisargikaBala",
};

/** Shadbalaya balas — emitted only when the bala is gained (stored `value: true`) → green. A lost
 *  bala produces NO tag (negative tags are never shown). `dig` never for Rahu/Ketu. */
const factorBala =
    (key: PlanetStrengthFactorKey, neverForRahuKetu: boolean): FactorBuilder =>
    ({ calculated, planet }) => {
        if (neverForRahuKetu && (planet === 8 || planet === 9)) return null;
        const balaKey = SHADBALAYA_KEY_BY_FACTOR[key];
        if (!balaKey) return null;
        const value = calculated.shadbalaya?.[String(planet)]?.[balaKey]?.value;
        if (value !== true) return null;
        return { key, planet, color: "green" };
    };

const factorRetrograde: FactorBuilder = ({ planet, row }) =>
    row.retrograde === true ? { key: "retrograde", planet, color: "white" } : null;

/** Combust — emitted only when the flag is true → red. A non-combust planet shows no tag. */
const factorCombust: FactorBuilder = ({ planet, row }) =>
    row.combustion === true ? { key: "combust", planet, color: "red" } : null;

/** Membership helper for a list-backed flag (`wargoththamaPlanets`, `maranakaraka`, ...). Returns
 *  null when the source data is missing (so a missing list is never read as a factor). */
const listMember =
    (getList: (calculated: CalculatedDetailsLike) => number[] | null | undefined) =>
    (calculated: CalculatedDetailsLike, planet: number): boolean | null => {
        const list = getList(calculated);
        if (!Array.isArray(list)) return null;
        return list.includes(planet);
    };

/** Membership helper for a single-planet flag (`atmakaraka`). Null when the value is missing. */
const singleMember =
    (getValue: (calculated: CalculatedDetailsLike) => number | null | undefined) =>
    (calculated: CalculatedDetailsLike, planet: number): boolean | null => {
        const value = getValue(calculated);
        if (typeof value !== "number") return null;
        return value === planet;
    };

/** Presence flag — emitted only when the planet IS a member of the flag's source data (missing data
 *  is NOT a factor): benefic flags green, malefic flags red. Non-membership produces no tag. */
const factorFlag =
    (
        key: PlanetStrengthFactorKey,
        presentColor: PlanetFactorColor,
        member: (calculated: CalculatedDetailsLike, planet: number) => boolean | null,
    ): FactorBuilder =>
    ({ calculated, planet }) =>
        member(calculated, planet) === true ? { key, planet, color: presentColor } : null;

/** The ordered factor builders, aligned 1:1 with `PLANET_STRENGTH_FACTORS`. Partial because the
 *  `house` key stays in the VALIDATION catalog (the note route rejects unknown override keys) but is
 *  no longer EMITTED — the current-house chip is replaced by the ownership context tags. */
const FACTOR_BUILDERS: Partial<Record<PlanetStrengthFactorKey, FactorBuilder>> = {
    sign: factorSign,
    navamsa: factorNavamsa,
    dig: factorBala("dig", true),
    kala: factorBala("kala", false),
    cheshta: factorBala("cheshta", false),
    naisargika: factorBala("naisargika", false),
    retrograde: factorRetrograde,
    combust: factorCombust,
    atmakaraka: factorFlag(
        "atmakaraka",
        "green",
        singleMember((calculated) => calculated.atmakaraka),
    ),
    yogakaraka: factorFlag(
        "yogakaraka",
        "green",
        listMember((calculated) => calculated.yogakaraka),
    ),
    maranakaraka: factorFlag(
        "maranakaraka",
        "red",
        listMember((calculated) => calculated.maranakaraka),
    ),
    maraka: factorFlag(
        "maraka",
        "red",
        listMember((calculated) => calculated.marakaPlanets),
    ),
    badhaka: factorFlag(
        "badhaka",
        "red",
        listMember((calculated) => calculated.badhakaPlanet),
    ),
    wargoththama: factorFlag(
        "wargoththama",
        "green",
        listMember((calculated) => calculated.wargoththamaPlanets),
    ),
    pushkara: factorFlag(
        "pushkara",
        "green",
        listMember((calculated) => calculated.pushkaraPlanets),
    ),
    gandantha: factorFlag(
        "gandantha",
        "red",
        listMember((calculated) => calculated.gandanthaPlanets),
    ),
    gandamula: factorFlag(
        "gandamula",
        "red",
        listMember((calculated) => calculated.gandamulaPlanets),
    ),
    ashtamansha: factorFlag(
        "ashtamansha",
        "red",
        listMember((calculated) => calculated.ashtamanshaPlanets),
    ),
    nidhanamsha: factorFlag(
        "nidhanamsha",
        "red",
        listMember((calculated) => calculated.nidhanamshaPlanets),
    ),
};

function validPlanetRowsOf(calculated: CalculatedDetailsLike): PlanetLike[] {
    return Array.isArray(calculated.planets)
        ? calculated.planets.filter((p): p is PlanetLike => typeof p?.name === "number")
        : [];
}

/** The lord of the planet's D1 house, derived like the house-lord observation — whole-sign from the
 *  lagna (`SIGN_LORD` mirrors astrology.ts's private table). Undefined when placement is unknown. */
function houseOwnerOf(calculated: CalculatedDetailsLike, house: number | undefined): number | undefined {
    if (house === undefined) return undefined;
    const sign = wholeSignOf(calculated.ascendant?.sign, house);
    return sign !== undefined ? SIGN_LORD[sign] : undefined;
}

/** Whole-sign conjunction names, enum order: the warga D1 row's `conjunctions` are authoritative
 *  when present (the conjunction table the student sees — same preference as the lord-detail
 *  `conjuncts`); legacy/manual docs fall back to the stored same-sign rows (the D1 whole-sign model
 *  treats same-sign placements as conjunct). */
function conjunctionsOf(
    calculated: CalculatedDetailsLike,
    warga: ReturnType<typeof resolveWargaKendara>,
    planet: number,
    row: PlanetLike,
): PlanetConjunction[] {
    const wargaRow = warga?.d1?.planets.find((r) => r.name === planet);
    const names = Array.isArray(wargaRow?.conjunctions)
        ? wargaRow.conjunctions
        : typeof row.sign === "number"
          ? validPlanetRowsOf(calculated)
                .filter((p) => p.name !== planet && p.sign === row.sign)
                .map((p) => p.name as number)
                .sort((a, b) => a - b)
          : [];
    const rows = new Map(validPlanetRowsOf(calculated).map((p) => [p.name as number, p]));
    return names.map((name) => {
        const other = rows.get(name);
        const orb =
            typeof row.absoluteDegree === "number" && typeof other?.absoluteDegree === "number"
                ? +Math.abs(row.absoluteDegree - other.absoluteDegree).toFixed(2)
                : undefined;
        return orb !== undefined ? { planet: name, orb } : { planet: name };
    });
}

/** Aspects RECEIVED by `planet` (the aspecting planet's drishti on it), enum order. Stored
 *  `planets[].aspects` are authoritative when present — they carry the full `Aspect` records whose
 *  `reasons`/`delta` power the "aspect difference as the calculation table shows" tooltip — with
 *  the conjunction (aspectType ≤ 0) records excluded. Legacy/manual docs without stored aspects
 *  fall back to the warga D1 whole-sign `aspects` (no degree data → null record). */
function receivedAspectsOf(
    calculated: CalculatedDetailsLike,
    warga: ReturnType<typeof resolveWargaKendara>,
    planet: number,
): ReceivedAspect[] {
    const fromStored: ReceivedAspect[] = [];
    for (const p of validPlanetRowsOf(calculated)) {
        if (p.name === planet || !Array.isArray(p.aspects)) continue;
        for (const aspect of p.aspects) {
            if (aspect.planetName !== planet) continue;
            const aspectType = typeof aspect.aspectType === "number" ? aspect.aspectType : 0;
            if (aspectType <= 0) continue;
            fromStored.push({ planet: p.name as number, aspectType, aspect: aspect as Aspect, aspectingSign: p.sign });
        }
    }
    if (fromStored.length > 0) return fromStored.sort((a, b) => a.planet - b.planet);
    const wargaRow = warga?.d1?.planets.find((r) => r.name === planet);
    if (!warga?.d1 || !wargaRow) return [];
    return warga.d1.planets
        .filter((p) => p.name !== planet)
        .flatMap((p) =>
            (p.aspects ?? [])
                .filter((a) => a.planetName === planet)
                .map((a) => ({
                    planet: p.name,
                    aspectType: a.aspectType,
                    aspect: null as Aspect | null,
                    aspectingSign: p.sign,
                })),
        )
        .sort((a, b) => a.planet - b.planet);
}

function buildPlanetEntry(
    calculated: CalculatedDetailsLike,
    warga: ReturnType<typeof resolveWargaKendara>,
    row: PlanetLike,
    overrides: PlanetFactorOverrides | undefined,
): PlanetStrengthEntry {
    const planet = row.name as number;
    const ctx: FactorCtx = { calculated, warga, planet, row, house: d1HouseOf(calculated, warga, planet, row) };
    const factors: PlanetStrengthFactor[] = [];
    let green = 0;
    let red = 0;
    for (const key of PLANET_STRENGTH_FACTORS) {
        try {
            const builder = FACTOR_BUILDERS[key];
            if (!builder) continue;
            const factor = builder(ctx);
            if (!factor) continue;
            const color = overrides?.[String(planet)]?.[key] ?? factor.color;
            if (color === "green") green += 1;
            else if (color === "red") red += 1;
            factors.push({ ...factor, color });
        } catch (error) {
            // A broken factor never breaks the whole planet — skip just that factor (UT-PS-109).
            console.warn(`[planetStrength] ${key} factor failed for planet ${planet}`, error);
        }
    }
    const lagnaSign = calculated.ascendant?.sign;
    const houseOwner = houseOwnerOf(calculated, ctx.house);
    const bhavaSuchika = calculated.bhavaSuchika?.[String(planet)];
    const nakshatraOwner = typeof row.nakshatra === "number" ? getNakshatraLord(row.nakshatra) : undefined;
    return {
        planet,
        factors,
        ratio: { green, total: green + red },
        conjunctions: conjunctionsOf(calculated, warga, planet, row),
        receivedAspects: receivedAspectsOf(calculated, warga, planet),
        ...(typeof bhavaSuchika === "number" ? { bhavaSuchika } : {}),
        ownedHouses: ownedHousesOf(lagnaSign, planet),
        ...(houseOwner !== undefined ? { houseOwner } : {}),
        houseOwnerHouses: houseOwner !== undefined ? ownedHousesOf(lagnaSign, houseOwner) : [],
        ...(nakshatraOwner !== undefined ? { nakshatraOwner } : {}),
    };
}

/** Derive the strength factors + ratio for every planet present in the chart (enum order). Never
 *  throws; `calculatedDetails: null`/empty → no entries. `overrides` apply effective colours. */
export function computePlanetStrengths(
    calculated: CalculatedDetailsLike | null | undefined,
    overrides?: PlanetFactorOverrides,
): PlanetStrengthEntry[] {
    if (!calculated || !Array.isArray(calculated.planets)) return [];
    const warga = resolveWargaKendara(calculated);
    const rows = calculated.planets
        .filter((p): p is PlanetLike => typeof p?.name === "number")
        .sort((a, b) => (a.name as number) - (b.name as number));
    const entries: PlanetStrengthEntry[] = [];
    for (const row of rows) {
        try {
            entries.push(buildPlanetEntry(calculated, warga, row, overrides));
        } catch (error) {
            console.warn(`[planetStrength] derivation failed for planet ${row.name}`, error);
        }
    }
    return entries;
}

/** The strength entry for a single planet (undefined when the planet is absent from the chart). */
export function planetStrengthOf(
    calculated: CalculatedDetailsLike | null | undefined,
    planet: number,
    overrides?: PlanetFactorOverrides,
): PlanetStrengthEntry | undefined {
    return computePlanetStrengths(calculated, overrides).find((entry) => entry.planet === planet);
}
