import type { House, Planet } from "@/lib/astrology";
import {
    computeChartAspects,
    hasStoredHouseAspects,
    receivedPlanetAspects,
    resolveDisplayAspects,
} from "@/lib/chartAspects";

// Aries lagna, whole-sign houses: house N holds sign N, house middle at 15°.
const HOUSES = Array.from({ length: 12 }, (_, i) => ({
    houseNumber: i + 1,
    sign: i + 1,
    middleSign: i + 1,
    middleDegree: 15,
}));

const planet = (name: number, absoluteDegree: number) => {
    const sign = Math.floor(absoluteDegree / 30) + 1;
    return { name, sign, house: sign, absoluteDegree };
};

const NO_RASHI = { rashiAspects: { enabled: false, overrides: {} } };
const RASHI = { rashiAspects: { enabled: true, overrides: {} } };

const aspectedBy = (records: Array<{ planetName: number }>) => records.map(({ planetName }) => planetName);

describe("computeChartAspects — planet aspect (ග්‍රහ දෘෂ්ඨි)", () => {
    // Kuja (Mars, orb 8) at 10° Gemini — house 3. Settings 4, 5, 7, 8, 9 → houses 6, 7, 9, 10, 11.
    const mars = planet(3, 70);
    const moon = planet(2, 100); // house 4 — not an aspect house of Mars
    const jupiter = planet(5, 185); // house 7, 5° Libra
    const venus = planet(6, 250); // house 9, 10° Sagittarius
    const saturn = planet(7, 290); // house 10, 20° Capricorn
    const chart = computeChartAspects([mars, moon, jupiter, venus, saturn], HOUSES, NO_RASHI);

    test("Kuja in house 3 aspects houses 6, 7, 9, 10, 11 (setting houses counted from its own house)", () => {
        const houses = HOUSES.filter(({ houseNumber }) => aspectedBy(chart.byHouse[houseNumber]).includes(3));
        expect(houses.map(({ houseNumber }) => houseNumber)).toEqual([6, 7, 9, 10, 11]);
    });

    test("house records carry the difference from the house middle, with no orb check", () => {
        // House 6 middle 165° vs point 70 + 90 = 160° → +5. House 10 middle 285° vs point 280° → +5.
        const sixth = chart.byHouse[6].find(({ planetName }) => planetName === 3);
        expect(sixth).toMatchObject({
            aspectType: 90,
            delta: 5,
            reasons: [{ type: "planetary", angle: 90, delta: 5 }],
        });
        expect(chart.byHouse[10].find(({ planetName }) => planetName === 3)?.delta).toBe(5);
    });

    test("a planet in an aspected house is aspected when the difference is within Kuja's orb", () => {
        // Jupiter 185° vs point 70 + 120 = 190° → −5; Venus 250° vs point 250° → 0.
        const marsAspects = chart.byPlanet[3].filter(({ aspectType }) => aspectType > 0);
        expect(marsAspects.map(({ planetName, aspectType, delta }) => [planetName, aspectType, delta])).toEqual([
            [5, 120, -5],
            [6, 180, 0],
        ]);
    });

    test("difference at or beyond the orb → no planet aspect (house still aspected)", () => {
        // Saturn 290° vs point 70 + 210 = 280° → +10 ≥ 8.
        expect(aspectedBy(chart.byPlanet[3])).not.toContain(7);
        const edge = computeChartAspects([mars, planet(5, 198)], HOUSES, NO_RASHI); // exactly +8
        expect(aspectedBy(edge.byPlanet[3])).not.toContain(5);
    });

    test("planets outside the aspect houses are never aspected", () => {
        expect(aspectedBy(chart.byPlanet[3])).not.toContain(2);
    });

    test("only the aspecting planet's orb counts — Rahu (orb 0) aspects houses but no planets", () => {
        const rahu = planet(8, 10); // house 1 → houses 5, 7, 9
        const res = computeChartAspects([rahu, planet(5, 190)], HOUSES, NO_RASHI);
        expect(aspectedBy(res.byPlanet[8])).toEqual([]);
        expect(aspectedBy(res.byHouse[7])).toEqual([8]);
    });

    test("configured houses override the defaults and are counted from the planet's house", () => {
        const res = computeChartAspects([mars], HOUSES, {
            ...NO_RASHI,
            planetAspects: { "3": { houses: [7], degrees: [180] } },
        });
        const aspected = HOUSES.filter(({ houseNumber }) => res.byHouse[houseNumber].length > 0);
        expect(aspected.map(({ houseNumber }) => houseNumber)).toEqual([9]);
    });
});

describe("computeChartAspects — rashi aspect (රාශි දෘෂ්ඨි)", () => {
    // Kuja at 10° Aries (Chara) → rashi aspects Leo (5), Scorpio (8), Aquarius (11).
    const mars = planet(3, 10);

    test("rashi-only house target: angle is the forward sign gap and the difference is from the middle", () => {
        const res = computeChartAspects([mars], HOUSES, RASHI);
        // Aquarius is 10 signs ahead → 300°; middle 315° vs point 310° → +5. Not a planetary house.
        expect(res.byHouse[11][0]).toMatchObject({
            planetName: 3,
            aspectType: 300,
            delta: 5,
            reasons: [{ type: "rashi", angle: 300, delta: 5, aspectedSign: 11 }],
        });
    });

    test("target reached by both arms keeps one record with both reasons (planetary first)", () => {
        // Scorpio planet at 12° — Mars house 1 + 8th house (210°) and rashi Aries → Scorpio (210°).
        const res = computeChartAspects([mars, planet(5, 222)], HOUSES, RASHI);
        const aspect = res.byPlanet[3].find(({ planetName }) => planetName === 5);
        expect(aspect?.reasons).toEqual([
            { type: "planetary", angle: 210, delta: 2 },
            { type: "rashi", angle: 210, delta: 2, aspectedSign: 8 },
        ]);
    });

    test("rashi planet targets use the aspecting planet's orb", () => {
        // Aquarius planet at 20° → point 310°, target 320° → +10 ≥ Mars orb 8.
        const res = computeChartAspects([mars, planet(2, 320)], HOUSES, RASHI);
        expect(aspectedBy(res.byPlanet[3])).not.toContain(2);
        expect(aspectedBy(res.byHouse[11])).toEqual([3]);
    });

    test("per-target override removes that sign's house and planets", () => {
        const res = computeChartAspects([mars], HOUSES, {
            rashiAspects: { enabled: true, overrides: { "1": { targets: { "11": false } } } },
        });
        expect(res.byHouse[11]).toEqual([]);
    });

    test("rashi disabled → no rashi reasons", () => {
        const res = computeChartAspects([mars], HOUSES, NO_RASHI);
        expect(res.byHouse[11]).toEqual([]);
    });
});

describe("conjunction records and received aspects", () => {
    test("stored planet lists lead with conjunction records; received aspects skip them", () => {
        const sun = planet(1, 5);
        const mercury = planet(4, 10);
        const jupiter = planet(5, 125); // Sun house 1 → 5th house (120°), 125 vs 125 → 0
        const res = computeChartAspects([sun, mercury, jupiter], HOUSES, NO_RASHI);
        expect(res.byPlanet[1][0]).toMatchObject({ planetName: 4, aspectType: 0 });

        const received = receivedPlanetAspects(
            [sun, mercury, jupiter].map((p) => ({ ...p, aspects: res.byPlanet[p.name] })),
        );
        expect(received[4].some(({ aspectType }) => aspectType === 0)).toBe(false);
        expect(received[5].find(({ planetName }) => planetName === 1)).toMatchObject({
            aspectType: 120,
            delta: 0,
            planetAbsoluteDegree: 5,
        });
    });
});

describe("resolveDisplayAspects — one set of records for every view", () => {
    const planets = [planet(3, 70), planet(5, 185)];
    const fresh = computeChartAspects(planets, HOUSES);
    const storedPlanets = planets.map((p) => ({ ...p, aspects: fresh.byPlanet[p.name] })) as unknown as Planet[];
    const storedHouses = HOUSES.map((h) => ({ ...h, aspects: fresh.byHouse[h.houseNumber] })) as unknown as House[];

    test("stored records are rendered as-is", () => {
        expect(hasStoredHouseAspects(storedHouses)).toBe(true);
        const display = resolveDisplayAspects({ planets: storedPlanets, houses: storedHouses });
        expect(display.byHouse).toEqual(fresh.byHouse);
        expect(display.receivedByPlanet).toEqual(receivedPlanetAspects(storedPlanets));
    });

    test("legacy documents (no house records) are re-derived with the same engine", () => {
        const legacyPlanets = planets.map((p) => ({ ...p, aspects: [] })) as unknown as Planet[];
        const legacyHouses = HOUSES as unknown as House[];
        expect(hasStoredHouseAspects(legacyHouses)).toBe(false);
        const display = resolveDisplayAspects({ planets: legacyPlanets, houses: legacyHouses });
        expect(display.byHouse).toEqual(fresh.byHouse);
        expect(display.receivedByPlanet).toEqual(receivedPlanetAspects(storedPlanets));
    });
});
