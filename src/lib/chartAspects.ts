/** Chart aspects (දෘෂ්ඨි) — the single aspect engine. Every view (calculation tab, chart tab, search,
 *  notepad) renders the records produced here, so the same planet/house pair always shows the same
 *  aspect and the same degree difference.
 *
 *  Planet aspect (ග්‍රහ දෘෂ්ඨි), for an aspecting planet P in whole-sign house H:
 *    - each configured aspect house N (an OFFSET from H — Kuja 4, 5, 7, 8, 9 from house 3 → houses
 *      6, 7, 9, 10, 11) has the aspect point `P.absoluteDegree + (N − 1) × 30`.
 *    - a planet sitting in that house is aspected when its degree difference from the aspect point
 *      is lower than P's orb (Rāśmi).
 *    - the house itself is always aspected; its record carries the difference from the house middle
 *      (no orb check).
 *
 *  Rashi aspect (රාශි දෘෂ්ඨි), for P in sign S (see `computeRashiAspectSigns`):
 *    - each aspected sign T has the aspect point `P.absoluteDegree + ((T − S) mod 12) × 30`.
 *    - planets in T use the same orb check; the house holding T is always aspected.
 *
 *  A target aspected by both arms keeps one record with both reasons (planetary first).
 *
 *  Each planet's stored list also leads with its conjunction (0°) records from
 *  `computePlanetConjunctions` — the yoga/dosha rules read yuti from them; every aspects column skips
 *  them (conjunctions render in their own column). */
import type { Aspect, AspectReason, House, Planet } from "@/lib/astrology";
import {
    BENEFICIAL_ASPECT_ANGLES,
    computePlanetConjunctions,
    resolveAspectHouses,
    resolveOrb,
} from "@/lib/planetAspects";
import type { PlanetAspectsMap } from "@/lib/planetAspects";
import {
    DEFAULT_RASHI_ASPECTS,
    computeRashiAspectSigns,
    isRashiEnabledForSign,
    isRashiTargetEnabled,
} from "@/lib/rashiAspects";
import type { RashiAspectsSetting } from "@/lib/rashiAspects";

export interface AspectSettings {
    planetAspects?: PlanetAspectsMap;
    planetaryOrbs?: Record<string, number>;
    rashiAspects?: RashiAspectsSetting;
}

export type AspectPlanet = Pick<Planet, "name" | "sign" | "house" | "absoluteDegree">;

export type AspectHouse = Pick<House, "houseNumber" | "sign" | "middleSign" | "middleDegree">;

export interface ChartAspects {
    /** Aspecting planet → its conjunction (0°) records, then the planets it aspects
     *  (`planetName` = aspected / conjunct planet). */
    byPlanet: Record<number, Aspect[]>;
    /** House number → the planets aspecting it (`planetName` = aspecting planet). */
    byHouse: Record<number, Aspect[]>;
}

const wrap360 = (x: number): number => ((x % 360) + 360) % 360;

/** Signed shortest difference of a target from an aspect point, in (−180, 180]. Positive when the
 *  target is ahead (east) of the point. */
const signedDelta = (targetAbs: number, pointAbs: number): number => ((targetAbs - pointAbs + 540) % 360) - 180;

/** The Nth house counted from `house` (the house itself is the 1st). */
const houseFrom = (house: number, n: number): number => ((house + n - 2) % 12) + 1;

const houseMiddleAbs = ({ middleSign, middleDegree }: AspectHouse): number => (middleSign - 1) * 30 + middleDegree;

const addReason = (records: Map<number, Aspect>, name: number, absoluteDegree: number, reason: AspectReason) => {
    const existing = records.get(name);
    if (existing) {
        existing.reasons?.push(reason);
        return;
    }
    records.set(name, {
        planetName: name,
        aspectType: reason.angle,
        planetAbsoluteDegree: absoluteDegree,
        degreeGap: Math.abs(reason.delta),
        exactAspectDegree: reason.angle,
        isBeneficial: reason.type === "planetary" && BENEFICIAL_ASPECT_ANGLES.has(reason.angle),
        delta: reason.delta,
        reasons: [reason],
    });
};

const sortedRecords = (records: Map<number, Aspect>): Aspect[] =>
    [...records.values()].sort((a, b) => a.planetName - b.planetName);

export const computeChartAspects = (
    planets: AspectPlanet[],
    houses: AspectHouse[],
    settings: AspectSettings = {},
): ChartAspects => {
    const rashiSetting = settings.rashiAspects ?? DEFAULT_RASHI_ASPECTS;
    const houseRecords = new Map<number, Map<number, Aspect>>();
    houses.forEach(({ houseNumber }) => houseRecords.set(houseNumber, new Map()));
    const conjunctions = computePlanetConjunctions(planets, settings.planetaryOrbs);
    const byPlanet: Record<number, Aspect[]> = {};

    planets.forEach((aspecter) => {
        const orb = resolveOrb(aspecter.name, settings.planetaryOrbs);
        const planetRecords = new Map<number, Aspect>();

        const aspectTargets = (
            reason: Pick<AspectReason, "type" | "angle" | "aspectedSign">,
            isTargetHouse: (house: AspectHouse) => boolean,
            isTargetPlanet: (planet: AspectPlanet) => boolean,
        ) => {
            const point = wrap360(aspecter.absoluteDegree + reason.angle);
            houses.forEach((house) => {
                const records = houseRecords.get(house.houseNumber);
                if (!records || !isTargetHouse(house)) return;
                const delta = signedDelta(houseMiddleAbs(house), point);
                addReason(records, aspecter.name, aspecter.absoluteDegree, { ...reason, delta });
            });
            planets.forEach((target) => {
                if (target.name === aspecter.name || !isTargetPlanet(target)) return;
                const delta = signedDelta(target.absoluteDegree, point);
                if (Math.abs(delta) >= orb) return;
                addReason(planetRecords, target.name, target.absoluteDegree, { ...reason, delta });
            });
        };

        // Planet aspect — house 1 is the planet's own house (conjunction), never an aspect.
        resolveAspectHouses(aspecter.name, settings.planetAspects)
            .filter((n) => n > 1)
            .forEach((n) => {
                const targetHouse = houseFrom(aspecter.house, n);
                aspectTargets(
                    { type: "planetary", angle: (n - 1) * 30 },
                    ({ houseNumber }) => houseNumber === targetHouse,
                    ({ house }) => house === targetHouse,
                );
            });

        if (isRashiEnabledForSign(aspecter.sign, rashiSetting)) {
            computeRashiAspectSigns(aspecter.sign)
                .filter((sign) => isRashiTargetEnabled(aspecter.sign, sign, rashiSetting))
                .forEach((aspectedSign) => {
                    aspectTargets(
                        { type: "rashi", angle: ((aspectedSign - aspecter.sign + 12) % 12) * 30, aspectedSign },
                        ({ sign }) => sign === aspectedSign,
                        ({ sign }) => sign === aspectedSign,
                    );
                });
        }

        byPlanet[aspecter.name] = [...(conjunctions[aspecter.name] ?? []), ...sortedRecords(planetRecords)];
    });

    const byHouse: Record<number, Aspect[]> = {};
    houseRecords.forEach((records, houseNumber) => {
        byHouse[houseNumber] = sortedRecords(records);
    });
    return { byPlanet, byHouse };
};

/** Aspects RECEIVED by each planet, from the stored outgoing `planets[].aspects` records. Each record
 *  is re-keyed so `planetName` is the aspecting planet (the chip label); the reasons and delta are
 *  unchanged. Conjunction records (aspectType 0) are skipped. */
export const receivedPlanetAspects = (
    planets: Array<Pick<Planet, "name" | "absoluteDegree" | "aspects">>,
): Record<number, Aspect[]> => {
    const result: Record<number, Aspect[]> = {};
    planets.forEach(({ name }) => {
        result[name] = [];
    });
    planets.forEach((aspecter) => {
        (aspecter.aspects ?? []).forEach((aspect) => {
            if (aspect.aspectType <= 0) return;
            (result[aspect.planetName] ??= []).push({
                ...aspect,
                planetName: aspecter.name,
                planetAbsoluteDegree: aspecter.absoluteDegree,
            });
        });
    });
    return result;
};

/** Whether the stored calculation already carries engine-produced house aspect records. Documents
 *  written before this engine lack them and are re-derived at render time. */
export const hasStoredHouseAspects = (houses: Array<Pick<House, "aspects">> | undefined): boolean =>
    Array.isArray(houses) && houses.length > 0 && houses.every(({ aspects }) => Array.isArray(aspects));

export interface DisplayAspects {
    /** Planet → the planets aspecting it (`planetName` = aspecting planet). */
    receivedByPlanet: Record<number, Aspect[]>;
    /** House number → the planets aspecting it (`planetName` = aspecting planet). */
    byHouse: Record<number, Aspect[]>;
}

/** The aspect records every view renders. Stored records win; documents calculated before this
 *  engine are re-derived with the same engine so every table still shows one consistent set. */
export const resolveDisplayAspects = (
    details: { planets?: Planet[]; houses?: House[] } | null | undefined,
    settings: AspectSettings = {},
): DisplayAspects => {
    const planets = details?.planets ?? [];
    const houses = details?.houses ?? [];
    if (hasStoredHouseAspects(houses)) {
        const byHouse: Record<number, Aspect[]> = {};
        houses.forEach(({ houseNumber, aspects }) => {
            byHouse[houseNumber] = aspects ?? [];
        });
        return { receivedByPlanet: receivedPlanetAspects(planets), byHouse };
    }
    const { byPlanet, byHouse } = computeChartAspects(planets, houses, settings);
    const receivedByPlanet = receivedPlanetAspects(
        planets.map((planet) => ({ ...planet, aspects: byPlanet[planet.name] ?? [] })),
    );
    return { receivedByPlanet, byHouse };
};
