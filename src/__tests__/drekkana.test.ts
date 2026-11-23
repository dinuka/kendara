/**
 * Drekkana (ද්‍රේක්කාණ, D3) — unit tests for the sign lookup, the D3 chart and the Warga Kendara
 * D3 entry.
 */
import type { Ascendant, Planet as PlanetRow } from "@/lib/astrology";
import { Planet, ZodiacSign } from "@/lib/astrologyEnums";
import { getChartData, isLeanChartType } from "@/lib/chartDataTransform";
import { ChartType } from "@/lib/chartTypes";
import { buildDrekkanaChart, drekkanaSign } from "@/lib/drekkana";
import { computeWargaDegreeVargaEntry, computeWargaKendara } from "@/lib/wargaKendara";

const planetAt = (name: Planet, sign: ZodiacSign, degree: number): PlanetRow =>
    ({
        name,
        sign,
        degree,
        absoluteDegree: (sign - 1) * 30 + degree,
        house: 1,
        nakshatra: 1,
        pada: 1,
        retrograde: false,
        combustion: false,
        strength: 0,
        aspects: [],
    }) as unknown as PlanetRow;

describe("drekkanaSign", () => {
    it.each([
        [ZodiacSign.ARIES, 0, ZodiacSign.ARIES],
        [ZodiacSign.ARIES, 9.99, ZodiacSign.ARIES],
        [ZodiacSign.ARIES, 10, ZodiacSign.LEO],
        [ZodiacSign.ARIES, 19.99, ZodiacSign.LEO],
        [ZodiacSign.ARIES, 20, ZodiacSign.SAGITTARIUS],
        [ZodiacSign.ARIES, 29.99, ZodiacSign.SAGITTARIUS],
        [ZodiacSign.TAURUS, 15, ZodiacSign.VIRGO],
        [ZodiacSign.SAGITTARIUS, 25, ZodiacSign.LEO],
        [ZodiacSign.PISCES, 12, ZodiacSign.CANCER],
        [ZodiacSign.PISCES, 28, ZodiacSign.SCORPIO],
    ])("sign %i at %f° → %i", (sign, degree, expected) => {
        expect(drekkanaSign(sign, degree)).toBe(expected);
    });

    it("normalizes absolute longitudes and missing degrees", () => {
        expect(drekkanaSign(ZodiacSign.ARIES, 45)).toBe(ZodiacSign.LEO);
        expect(drekkanaSign(ZodiacSign.LEO, undefined)).toBe(ZodiacSign.LEO);
    });
});

describe("buildDrekkanaChart", () => {
    const ascendant: Ascendant = {
        sign: ZodiacSign.ARIES,
        degree: 12,
        lord: Planet.MARS,
    };
    const planets = [planetAt(Planet.MARS, ZodiacSign.ARIES, 25), planetAt(Planet.VENUS, ZodiacSign.TAURUS, 5)];

    it("moves the lagna and planets to their D3 signs with whole-sign houses", () => {
        const chart = buildDrekkanaChart({ planets, ascendant });
        expect(chart.ascendant.sign).toBe(ZodiacSign.LEO);
        expect(chart.houses).toHaveLength(12);
        expect(chart.houses[0].sign).toBe(ZodiacSign.LEO);
        const [mars, venus] = chart.planets;
        expect(mars.sign).toBe(ZodiacSign.SAGITTARIUS);
        expect(mars.house).toBe(5);
        expect(venus.sign).toBe(ZodiacSign.TAURUS);
        expect(venus.house).toBe(10);
    });

    it("builds the Warga D3 entry tables from the D3 chart", () => {
        const entry = computeWargaDegreeVargaEntry("d3", { planets, ascendant });
        expect(entry?.lagnaSign).toBe(ZodiacSign.LEO);
        expect(entry?.houses.find((h) => h.houseNumber === 5)?.planets).toEqual([Planet.MARS]);
        expect(entry?.planets.map(({ name, sign }) => [name, sign])).toEqual([
            [Planet.MARS, ZodiacSign.SAGITTARIUS],
            [Planet.VENUS, ZodiacSign.TAURUS],
        ]);
    });

    it("returns no entry for a chart without planets", () => {
        expect(computeWargaDegreeVargaEntry("d3", { planets: [], ascendant })).toBeNull();
    });

    it("is part of the computed Warga Kendara for auto horoscopes", () => {
        const result = { planets, ascendant, houses: [] } as unknown as Parameters<typeof computeWargaKendara>[0];
        const wk = computeWargaKendara(result, { source: "auto" });
        expect(wk.d3?.lagnaSign).toBe(ZodiacSign.LEO);
    });
});

describe("stored D3 chart", () => {
    it("getChartData returns the lean D3 chart for the drekkana type", () => {
        const ascendant: Ascendant = {
            sign: ZodiacSign.ARIES,
            degree: 2,
            lord: Planet.MARS,
        };
        const result = {
            planets: [planetAt(Planet.MARS, ZodiacSign.ARIES, 14)],
            ascendant,
            houses: [],
        } as unknown as Parameters<typeof getChartData>[0];
        const chart = getChartData(result, ChartType.DREKKANA_D3);
        expect(chart.planets[0].sign).toBe(ZodiacSign.LEO);
        expect(chart.houses).toHaveLength(12);
        expect(isLeanChartType(ChartType.DREKKANA_D3)).toBe(true);
    });
});
