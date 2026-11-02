/**
 * Trimshamsha (ත්‍රිංශාංශකය, D30) — unit tests for the sign lookup, the D30 chart and the
 * Warga Kendara D30 entry (docs/thinshashankaya.md).
 */
import type { Ascendant, Planet as PlanetRow } from "@/lib/astrology";
import { Planet, ZodiacSign } from "@/lib/astrologyEnums";
import { getChartData, isLeanChartType } from "@/lib/chartDataTransform";
import { ALL_CHART_TYPES, ChartType } from "@/lib/chartTypes";
import { buildTrimshamshaChart, trimshamshaSign } from "@/lib/trimshamsha";
import { computeWargaD30Entry } from "@/lib/wargaKendara";

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

describe("trimshamshaSign", () => {
    it("maps the doc's worked examples", () => {
        expect(trimshamshaSign(ZodiacSign.ARIES, 14)).toBe(ZodiacSign.SAGITTARIUS);
        expect(trimshamshaSign(ZodiacSign.TAURUS, 14)).toBe(ZodiacSign.PISCES);
    });

    it.each([
        [0, ZodiacSign.ARIES],
        [4.99, ZodiacSign.ARIES],
        [5, ZodiacSign.AQUARIUS],
        [9.99, ZodiacSign.AQUARIUS],
        [10, ZodiacSign.SAGITTARIUS],
        [17.99, ZodiacSign.SAGITTARIUS],
        [18, ZodiacSign.GEMINI],
        [24.99, ZodiacSign.GEMINI],
        [25, ZodiacSign.LIBRA],
        [29.99, ZodiacSign.LIBRA],
    ])("odd sign (Leo) at %d° → %d", (degree: number, expected: ZodiacSign) => {
        expect(trimshamshaSign(ZodiacSign.LEO, degree)).toBe(expected);
    });

    it.each([
        [0, ZodiacSign.TAURUS],
        [4.99, ZodiacSign.TAURUS],
        [5, ZodiacSign.VIRGO],
        [11.99, ZodiacSign.VIRGO],
        [12, ZodiacSign.PISCES],
        [19.99, ZodiacSign.PISCES],
        [20, ZodiacSign.CAPRICORN],
        [24.99, ZodiacSign.CAPRICORN],
        [25, ZodiacSign.SCORPIO],
        [29.99, ZodiacSign.SCORPIO],
    ])("even sign (Scorpio) at %d° → %d", (degree: number, expected: ZodiacSign) => {
        expect(trimshamshaSign(ZodiacSign.SCORPIO, degree)).toBe(expected);
    });

    it("uses the odd column for every odd sign and the even column for every even sign", () => {
        for (let sign = 1; sign <= 12; sign++) {
            expect(trimshamshaSign(sign, 7)).toBe(sign % 2 === 1 ? ZodiacSign.AQUARIUS : ZodiacSign.VIRGO);
        }
    });

    it("normalizes absolute longitudes into the sign", () => {
        expect(trimshamshaSign(ZodiacSign.ARIES, 44)).toBe(ZodiacSign.SAGITTARIUS);
    });
});

describe("buildTrimshamshaChart", () => {
    const ascendant: Ascendant = { sign: ZodiacSign.ARIES, degree: 2, lord: Planet.MARS };
    const planets = [planetAt(Planet.MARS, ZodiacSign.ARIES, 14), planetAt(Planet.VENUS, ZodiacSign.TAURUS, 14)];

    it("moves the lagna and planets to their D30 signs with whole-sign houses", () => {
        const chart = buildTrimshamshaChart({ planets, ascendant });
        expect(chart.ascendant.sign).toBe(ZodiacSign.ARIES);
        expect(chart.houses).toHaveLength(12);
        expect(chart.houses[0].sign).toBe(ZodiacSign.ARIES);
        const [mars, venus] = chart.planets;
        expect(mars.sign).toBe(ZodiacSign.SAGITTARIUS);
        expect(mars.house).toBe(9);
        expect(venus.sign).toBe(ZodiacSign.PISCES);
        expect(venus.house).toBe(12);
    });

    it("builds the Warga D30 entry tables from the D30 chart", () => {
        const entry = computeWargaD30Entry({ planets, ascendant });
        expect(entry?.lagnaSign).toBe(ZodiacSign.ARIES);
        expect(entry?.houses.find((h) => h.houseNumber === 9)?.planets).toEqual([Planet.MARS]);
        expect(entry?.planets.map(({ name, sign }) => [name, sign])).toEqual([
            [Planet.MARS, ZodiacSign.SAGITTARIUS],
            [Planet.VENUS, ZodiacSign.PISCES],
        ]);
    });

    it("returns no entry for a chart without planets", () => {
        expect(computeWargaD30Entry({ planets: [], ascendant })).toBeNull();
    });
});

describe("stored D30 chart", () => {
    const ascendant: Ascendant = { sign: ZodiacSign.ARIES, degree: 2, lord: Planet.MARS };
    const planets = [planetAt(Planet.MARS, ZodiacSign.ARIES, 14)];

    it("is one of the chart types saved when a horoscope is added", () => {
        expect(ALL_CHART_TYPES).toContain(ChartType.TRIMSHAMSHA_D30);
        expect(isLeanChartType(ChartType.TRIMSHAMSHA_D30)).toBe(true);
    });

    it("getChartData returns the D30 chart for the trimshamsha type", () => {
        const result = { planets, ascendant, houses: [] } as unknown as Parameters<typeof getChartData>[0];
        const chart = getChartData(result, ChartType.TRIMSHAMSHA_D30);
        expect(chart.planets[0].sign).toBe(ZodiacSign.SAGITTARIUS);
        expect(chart.houses).toHaveLength(12);
    });
});
