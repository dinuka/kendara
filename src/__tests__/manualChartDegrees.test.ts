import { Planet } from "@/lib/astrologyEnums";
import {
    applyDegreeNavamsaPlacements,
    compute,
    degreeFromAmshaKala,
    deriveNavamsaSignFromDegree,
    manualAscAbsDeg,
    manualPlacementsToInput,
    manualTrimshamshaSource,
    navamsaWedgeForDegree,
    nodePartner,
    oppositeHouse,
    placePlanetWithNode,
    splitAmshaKala,
} from "@/lib/manualChart";
import { buildTrimshamshaChart } from "@/lib/trimshamsha";
import {
    parseManualChartBody,
    sanitizeManualHousePlacements,
    synthesizeCalculation,
    synthesizePlanets,
} from "@/lib/manualChartDetails";

describe("amsha / kala helpers", () => {
    it("combines amsha and kala into a degree", () => {
        expect(degreeFromAmshaKala(23, 20)).toBeCloseTo(23 + 20 / 60, 10);
        expect(degreeFromAmshaKala(0, 0)).toBe(0);
        expect(degreeFromAmshaKala(29, 59)).toBeCloseTo(29 + 59 / 60, 10);
    });

    it("rejects out-of-range or fractional parts", () => {
        expect(degreeFromAmshaKala(30, 0)).toBeNull();
        expect(degreeFromAmshaKala(-1, 0)).toBeNull();
        expect(degreeFromAmshaKala(10, 60)).toBeNull();
        expect(degreeFromAmshaKala(10.5, 0)).toBeNull();
    });

    it("splits a degree back into amsha and kala", () => {
        expect(splitAmshaKala(23 + 20 / 60)).toEqual({ amsha: 23, kala: 20 });
        expect(splitAmshaKala(29.9999)).toEqual({ amsha: 29, kala: 59 });
    });
});

describe("navamsaWedgeForDegree", () => {
    it("puts exact wedge boundaries in the later wedge (23° 20' → 8th)", () => {
        expect(navamsaWedgeForDegree(degreeFromAmshaKala(23, 20)!)).toBe(8);
        expect(navamsaWedgeForDegree(degreeFromAmshaKala(23, 19)!)).toBe(7);
        expect(navamsaWedgeForDegree(degreeFromAmshaKala(3, 20)!)).toBe(2);
        expect(navamsaWedgeForDegree(0)).toBe(1);
        expect(navamsaWedgeForDegree(degreeFromAmshaKala(29, 59)!)).toBe(9);
    });

    it("derives the navamsa sign (Mesha 23° 20' → Vrischika)", () => {
        expect(deriveNavamsaSignFromDegree(1, degreeFromAmshaKala(23, 20)!)).toBe(8);
        expect(deriveNavamsaSignFromDegree(1, degreeFromAmshaKala(23, 19)!)).toBe(7);
    });
});

describe("applyDegreeNavamsaPlacements", () => {
    const houses = { 1: [Planet.SUN], 4: [Planet.MOON] };

    it("places degree planets relative to the navamsa lagna and keeps manual ones", () => {
        const result = applyDegreeNavamsaPlacements(
            1,
            houses,
            1,
            { 3: [Planet.MOON], 5: [Planet.SUN] },
            {
                [Planet.SUN]: degreeFromAmshaKala(23, 20)!,
            },
        );
        // Sun: Mesha 23° 20' → Vrischika, 8th from a Mesha navamsa lagna. Moon untouched.
        expect(result).toEqual({ 3: [Planet.MOON], 8: [Planet.SUN] });
    });

    it("is a no-op without a navamsa lagna", () => {
        const nav = { 3: [Planet.MOON] };
        expect(
            applyDegreeNavamsaPlacements(1, houses, undefined, nav, {
                [Planet.SUN]: 10,
            }),
        ).toBe(nav);
    });

    it("ignores degrees for planets not placed in the birth chart", () => {
        expect(applyDegreeNavamsaPlacements(1, houses, 1, {}, { [Planet.MARS]: 10 })).toEqual({});
    });
});

describe("compute with planet degrees", () => {
    const input = {
        lagna: 1,
        navamsaLagna: 1,
        houses: { 1: [Planet.SUN], 2: [Planet.MOON] },
        planetDegrees: {
            [Planet.SUN]: degreeFromAmshaKala(23, 20)!,
            [Planet.MOON]: 10,
        },
    };

    it("auto-builds the navamsa chart from the degrees", () => {
        const result = compute(input);
        const nav = result.manualHousePlacements.navamsaHouses!;
        expect(nav.find((h) => h.houseNumber === 8)?.planets).toEqual([Planet.SUN]);
        // Moon: Vrishabha 10° → 4th wedge; Vrishabha (earth) starts at Makara → Mesha, 1st house.
        expect(nav.find((h) => h.houseNumber === 1)?.planets).toEqual([Planet.MOON]);
        expect(result.manualHousePlacements.planetDegrees).toEqual(input.planetDegrees);
    });

    it("uses the exact degree for nakshatra / pada and the planets table", () => {
        const result = compute(input);
        const sun = result.planetsTable.find((r) => r.planet === Planet.SUN)!;
        expect(sun.degree).toBeCloseTo(23.3333, 3);
        // 23° 20′ Mesha = Bharani (2) pada 4 (Bharani spans 13° 20′–26° 40′).
        expect(sun.navamsa?.nakshatra).toBe(2);
        expect(sun.navamsa?.pada).toBe(4);
        const planets = synthesizePlanets(result);
        const sunPlanet = planets.find((p) => p.name === Planet.SUN)!;
        expect(sunPlanet.degree).toBeCloseTo(23.3333, 3);
        expect(sunPlanet.navamsaSign).toBe(8);
    });

    it("round-trips planet degrees through stored placements", () => {
        const stored = sanitizeManualHousePlacements(compute(input).manualHousePlacements);
        expect(manualPlacementsToInput(stored).planetDegrees).toEqual(input.planetDegrees);
    });

    it("omits planetDegrees from storage when none were entered", () => {
        const stored = sanitizeManualHousePlacements(
            compute({ ...input, planetDegrees: undefined }).manualHousePlacements,
        );
        expect("planetDegrees" in stored).toBe(false);
    });
});

describe("parseManualChartBody planetDegrees", () => {
    const base = { lagna: 1, houses: { 1: [Planet.SUN] } };

    it("accepts degrees for placed planets", () => {
        const parsed = parseManualChartBody({
            ...base,
            planetDegrees: { "1": 23.5 },
        });
        expect(parsed.ok && parsed.value.planetDegrees).toEqual({ 1: 23.5 });
    });

    it("rejects out-of-range degrees and unplaced planets", () => {
        expect(parseManualChartBody({ ...base, planetDegrees: { "1": 30 } }).ok).toBe(false);
        expect(parseManualChartBody({ ...base, planetDegrees: { "2": 10 } }).ok).toBe(false);
        expect(parseManualChartBody({ ...base, planetDegrees: [1] }).ok).toBe(false);
    });
});

describe("Rahu / Ketu pairing", () => {
    it("pairs the nodes and nothing else", () => {
        expect(nodePartner(Planet.RAHU)).toBe(Planet.KETU);
        expect(nodePartner(Planet.KETU)).toBe(Planet.RAHU);
        expect(nodePartner(Planet.SUN)).toBeNull();
    });

    it("finds the opposite house", () => {
        expect(oppositeHouse(3)).toBe(9);
        expect(oppositeHouse(9)).toBe(3);
        expect(oppositeHouse(6)).toBe(12);
        expect(oppositeHouse(12)).toBe(6);
    });

    it("adding Rahu to the 3rd house puts Ketu in the 9th", () => {
        expect(placePlanetWithNode({ 1: [Planet.SUN] }, 3, Planet.RAHU)).toEqual({
            1: [Planet.SUN],
            3: [Planet.RAHU],
            9: [Planet.KETU],
        });
    });

    it("moving Ketu moves Rahu with it", () => {
        const start = { 3: [Planet.RAHU], 9: [Planet.KETU] };
        expect(placePlanetWithNode(start, 5, Planet.KETU)).toEqual({ 5: [Planet.KETU], 11: [Planet.RAHU] });
    });

    it("leaves other planets alone", () => {
        expect(placePlanetWithNode({ 3: [Planet.RAHU], 9: [Planet.KETU] }, 2, Planet.MARS)).toEqual({
            2: [Planet.MARS],
            3: [Planet.RAHU],
            9: [Planet.KETU],
        });
    });

    it("the same degree on both nodes keeps them opposite in the Navamsa too", () => {
        const degree = degreeFromAmshaKala(23, 45)!;
        const result = compute({
            lagna: 1,
            navamsaLagna: 1,
            houses: { 3: [Planet.RAHU], 9: [Planet.KETU] },
            planetDegrees: { [Planet.RAHU]: degree, [Planet.KETU]: degree },
        });
        const nav = result.manualHousePlacements.navamsaHouses!;
        const rahuHouse = nav.find((h) => h.planets.includes(Planet.RAHU))!.houseNumber;
        const ketuHouse = nav.find((h) => h.planets.includes(Planet.KETU))!.houseNumber;
        expect(oppositeHouse(rahuHouse)).toBe(ketuHouse);
    });
});

describe("entered lagna degree acts like a birth-time ascendant", () => {
    it("anchors the ascendant at the exact degree", () => {
        expect(manualAscAbsDeg({ lagna: 2, lagnaDegree: degreeFromAmshaKala(12, 30)! })).toBeCloseTo(42.5, 10);
    });

    it("keeps the navamsa-wedge centre without a degree", () => {
        // Mesha, navamsa lagna Mesha → wedge 1, centre 1° 40'.
        expect(manualAscAbsDeg({ lagna: 1, navamsaLagna: 1 })).toBeCloseTo(30 / 18, 10);
    });

    it("stores the entered degree on the synthesized ascendant", () => {
        const result = compute({ lagna: 1, lagnaDegree: 12.5, houses: { 1: [Planet.SUN] } });
        expect(synthesizeCalculation(result).ascendant.degree).toBe(12.5);
    });
});

describe("manual Trimshamsha (D30) from entered degrees", () => {
    // Mesha lagna 12° → odd sign, 10–18 band → Dhanu D30 lagna.
    const input = {
        lagna: 1,
        lagnaDegree: 12,
        navamsaLagna: deriveNavamsaSignFromDegree(1, 12),
        houses: { 1: [Planet.SUN], 2: [Planet.MOON], 5: [Planet.MARS] },
        // Sun Mesha 3° → Mesha; Moon Vrishabha 23° 45' → even sign, 20–25 band → Makara.
        planetDegrees: { [Planet.SUN]: 3, [Planet.MOON]: degreeFromAmshaKala(23, 45)! },
    };

    it("needs the lagna degree", () => {
        const synth = synthesizeCalculation(compute({ ...input, lagnaDegree: undefined }));
        expect(manualTrimshamshaSource(synth.planets, { lagna: 1, planetDegrees: input.planetDegrees })).toBeNull();
        expect(synth.wargaKendara?.d30).toBeNull();
    });

    it("needs at least one planet degree", () => {
        const synth = synthesizeCalculation(compute({ ...input, planetDegrees: undefined }));
        expect(synth.wargaKendara?.d30).toBeNull();
    });

    it("places the lagna and only the planets with an entered degree", () => {
        const result = compute(input);
        const synth = synthesizeCalculation(result);
        const source = manualTrimshamshaSource(synth.planets, result.manualHousePlacements)!;
        const chart = buildTrimshamshaChart(source);
        expect(chart.ascendant.sign).toBe(9);
        expect(chart.planets.map((p) => [p.name, p.sign])).toEqual([
            [Planet.SUN, 1],
            [Planet.MOON, 10],
        ]);
        const d30 = synth.wargaKendara?.d30;
        expect(d30?.lagnaSign).toBe(9);
        expect(d30?.planets.map((p) => p.name).sort()).toEqual([Planet.SUN, Planet.MOON]);
    });
});
