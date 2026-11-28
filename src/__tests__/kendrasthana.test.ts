import { composeAspectTooltip } from "@/lib/aspectTooltip";
import { computeKendrasthana } from "@/lib/kendrasthana";

// Whole-sign houses from Aries lagna: house N = sign N, middle at 15°.
const HOUSES = Array.from({ length: 12 }, (_, i) => ({ houseNumber: i + 1, middleSign: i + 1, middleDegree: 15 }));
const planet = (name: number, absoluteDegree: number) => ({
    name,
    absoluteDegree,
    house: Math.floor(absoluteDegree / 30) + 1,
});

describe("computeKendrasthana — houses", () => {
    it("lists every planet in houses 4/7/10 from the house (not the house itself), with the house-middle difference", () => {
        const sun = planet(1, 10); // house 1
        const mars = planet(3, 100); // house 4
        const jupiter = planet(5, 200); // house 7
        const venus = planet(6, 40); // house 2 — not a kendra of house 1
        const res = computeKendrasthana([sun, mars, jupiter, venus], HOUSES);

        const h1 = res.byHouse[1];
        // Sun sits in house 1 itself — not a kendra (1st house excluded).
        expect(h1.map((a) => a.planetName)).toEqual([3, 5]);
        // Mars from house 4 → house 1 is its 10th (270°): point 100+270=370→10, middle 15 → +5.
        expect(h1[0]).toMatchObject({ aspectType: 270, delta: 5 });
        // Jupiter from house 7 → 7th (180°): point 20, middle 15 → −5.
        expect(h1[1]).toMatchObject({ aspectType: 180, delta: -5 });
        expect(h1[1].reasons).toEqual([{ type: "kendra", angle: 180, delta: -5 }]);
    });
});

describe("computeKendrasthana — planets", () => {
    it("lists kendra planets only within the kendra planet's orb, never same-house planets", () => {
        const sun = planet(1, 10); // orb 15
        const mars = planet(3, 100); // orb 8, house 4
        const saturn = planet(7, 280); // orb 9, house 10
        const res = computeKendrasthana([sun, mars, saturn], HOUSES);

        // Sun ← Mars (point 10, Δ 0 < 8) ✓; Sun ← Saturn (point 280+90=10, Δ 0) ✓.
        expect(res.byPlanet[1].map((a) => a.planetName)).toEqual([3, 7]);
        // Mars ← Sun: point 100, Δ 0 < 15 ✓; Mars ← Saturn: 280+180=100 ✓.
        expect(res.byPlanet[3].map((a) => a.planetName)).toEqual([1, 7]);

        const sameHouse = computeKendrasthana([sun, planet(5, 12)], HOUSES);
        expect(sameHouse.byPlanet[1]).toEqual([]);

        const far = computeKendrasthana([sun, planet(3, 120)], HOUSES);
        // Mars at 120 (house 5) is not a kendra of house 1 at all.
        expect(far.byPlanet[1]).toEqual([]);
        const outsideOrb = computeKendrasthana([sun, planet(3, 119)], HOUSES); // house 4, point 109 → Δ −9 ≥ 8
        expect(outsideOrb.byPlanet[1]).toEqual([]);
        // Mars ← Sun: point 100, Δ +19 ≥ Sun orb 15.
        expect(outsideOrb.byPlanet[3]).toEqual([]);
    });

    it("never lists a planet through Rahu/Ketu (orb 0)", () => {
        const res = computeKendrasthana([planet(1, 10), planet(8, 190)], HOUSES);
        expect(res.byPlanet[1]).toEqual([]);
        expect(res.byPlanet[8].map((a) => a.planetName)).toEqual([1]);
    });

    it("honours configured orbs", () => {
        const res = computeKendrasthana([planet(1, 10), planet(8, 192)], HOUSES, { "8": 5 });
        expect(res.byPlanet[1].map((a) => a.planetName)).toEqual([8]);
    });
});

describe("kendra tooltip", () => {
    const tokens = {
        label: "Planet drishti",
        rashiLabel: "Rashi drishti",
        kendraLabel: "Kendrasthana",
        arrow: "→",
        getSignName: (s: number) => `S${s}`,
    };
    it("renders the kendra house, angle and delta", () => {
        const [rec7] = computeKendrasthana([planet(1, 10)], HOUSES).byHouse[7];
        expect(composeAspectTooltip(tokens, { aspect: rec7 }).title).toBe("Kendrasthana 7 (180) (+05:00:00)");
    });
});
