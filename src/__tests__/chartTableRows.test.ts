import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { buildWargaHouseData, buildWargaPlanetData, wargaPlanetTags } from "@/lib/chartTableRows";
import type { WargaChartEntry } from "@/lib/wargaKendara";

const t = (key: string) => key;

const entry: WargaChartEntry = {
    lagnaSign: 1,
    houses: Array.from({ length: 12 }, (_, i) => ({
        houseNumber: i + 1,
        sign: i + 1,
        planets: i === 0 ? [1, 3] : [],
        aspects: i === 6 ? [{ planetName: 1, aspectType: 180 }] : [],
    })),
    planets: [
        { name: 1, sign: 1, strength: PlanetaryStrength.UCHCHA, house: 1, conjunctions: [3], aspects: [{ planetName: 3, aspectType: 0 }] },
        { name: 3, sign: 1, strength: PlanetaryStrength.OWN_SIGN, house: 1, conjunctions: [1], aspects: [] },
    ],
    marakaPlanets: [3],
    maranakaraka: [],
    digBalaPlanets: [1],
    wargoththamaPlanets: [1],
    gandanthaPlanets: [1],
};

describe("buildWargaHouseData", () => {
    it("maps houses with whole-sign aspects and only the core columns", () => {
        const data = buildWargaHouseData(entry, { degreeBased: false, t });
        expect(data.rows[0].planets).toEqual([{ name: 1 }, { name: 3 }]);
        expect(data.rows[6].aspects[0]).toMatchObject({ planetName: 1, aspectType: 180, delta: 0 });
        expect(data.available.has("start")).toBe(false);
        expect(data.available.has("aspects")).toBe(true);
    });

    it("prefers degree-based house aspects when given", () => {
        const custom = [{ planetName: 7 }] as never;
        const data = buildWargaHouseData(entry, { degreeBased: true, houseAspects: { 7: custom }, t });
        expect(data.rows[6].aspects).toBe(custom);
    });
});

describe("buildWargaPlanetData", () => {
    const data = buildWargaPlanetData(entry, { degreeBased: false, t });

    it("derives ownership and received aspects", () => {
        const sun = data.rows.find((r) => r.name === 1)!;
        const mars = data.rows.find((r) => r.name === 3)!;
        expect(sun.ownership).toEqual([5]);
        expect(mars.ownership).toEqual([1, 8]);
        // Sun aspects Mars → Mars receives it.
        expect(mars.aspects.map((a) => a.planetName)).toEqual([1]);
        expect(sun.aspects).toEqual([]);
        expect(data.showAspectDelta).toBe(false);
    });

    it("has no nakshatra column without nakshatra data", () => {
        expect(data.available.has("nakshatra")).toBe(false);
        expect(data.available.has("subaAsuba")).toBe(false);
    });

    it("maps flag lists to the same tag keys as the D1 tags", () => {
        expect(wargaPlanetTags(entry, 1, t)).toEqual([
            { key: "wargoththama", text: "astrology.wargoththamaLabel", strikethrough: true },
            { key: "gandanta", text: "astrology.gandantaLabel" },
            { key: "digBala", text: "astrology.digBalaLabel" },
        ]);
        expect(wargaPlanetTags(entry, 3, t).map((tag) => tag.key)).toEqual(["maraka"]);
    });
});
