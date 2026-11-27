import { resolveWargaDisplayAspects } from "@/lib/wargaKendara";
import type { WargaChartEntry } from "@/lib/wargaKendara";

/** Lagna Aries; Sun (1) in Aries (house 1), Moon (2) in Leo (house 5), Mars (3) in Cancer (house 4). */
const entry: Pick<WargaChartEntry, "houses" | "planets"> = {
    houses: Array.from({ length: 12 }, (_, i) => ({
        houseNumber: i + 1,
        sign: i + 1,
        planets: [],
        aspects: i + 1 === 7 ? [{ planetName: 1, aspectType: 180 }] : [],
    })),
    planets: [
        { name: 1, sign: 1, house: 1, strength: 0, conjunctions: [], aspects: [] },
        { name: 2, sign: 5, house: 5, strength: 0, conjunctions: [], aspects: [] },
        { name: 3, sign: 4, house: 4, strength: 0, conjunctions: [], aspects: [] },
    ],
};

describe("resolveWargaDisplayAspects", () => {
    it("adds whole-sign rashi aspects to houses and planets", () => {
        const { byHouse, receivedByPlanet } = resolveWargaDisplayAspects(entry);
        // Aries (chara) aspects Leo, Scorpio, Aquarius (Taurus excluded as nearest).
        const sunOnLeo = byHouse[5].find(({ planetName }) => planetName === 1);
        expect(sunOnLeo?.reasons).toEqual([{ type: "rashi", angle: 120, delta: 0, aspectedSign: 5 }]);
        expect(byHouse[2].some(({ planetName }) => planetName === 1)).toBe(false);
        expect(receivedByPlanet[2].map(({ planetName }) => planetName)).toContain(1);
        // Leo (thira) aspects Aries, Cancer... Moon aspects Mars in Cancer? Leo → chara signs except nearest (Cancer).
        expect(receivedByPlanet[3].some(({ planetName }) => planetName === 2)).toBe(false);
        expect(receivedByPlanet[1].some(({ planetName }) => planetName === 2)).toBe(true);
    });

    it("keeps stored planetary aspects", () => {
        const { byHouse } = resolveWargaDisplayAspects(entry);
        expect(byHouse[7][0].reasons?.[0]).toEqual({
            type: "planetary",
            angle: 180,
            delta: 0,
        });
    });

    it("respects the disabled rashi setting", () => {
        const { byHouse, receivedByPlanet } = resolveWargaDisplayAspects(entry, {
            enabled: false,
        });
        expect(byHouse[5]).toEqual([]);
        expect(receivedByPlanet[2]).toEqual([]);
    });
});
