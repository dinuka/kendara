/**
 * Parivartana Yoga (docs/pariwarthana yoga.md) — two classical planets in each other's signs,
 * typed by the exchanged houses: 6/8/12 → Dainya, otherwise 3 → Khala, otherwise Maha.
 */
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { computeYogaDoshas } from "@/lib/yogaDosha/ruleEngine";
import { ChartFacts, PlanetFact, YogaEvaluation } from "@/lib/yogaDosha/types";

const planet = (planetName: number, sign: number, ascendantSign: number): PlanetFact => ({
    planetName,
    sign,
    house: ((sign - ascendantSign + 12) % 12) + 1,
    degree: 10,
    absoluteDegree: (sign - 1) * 30 + 10,
    strength: PlanetaryStrength.SAMA,
    navamsaSign: sign,
    navamsaStrength: PlanetaryStrength.SAMA,
    nakshatra: 1,
    aspects: [],
});

// Every classical planet not placed explicitly sits in its own sign, so it exchanges with no one.
const OWN_SIGNS: Record<number, number> = { 1: 5, 2: 4, 3: 1, 4: 3, 5: 9, 6: 2, 7: 10 };

const chart = (ascendantSign: number, placed: Record<number, number>): ChartFacts => ({
    ascendantSign,
    source: "auto",
    tradition: "MAIN_STREAM",
    planets: Object.keys(OWN_SIGNS).map((name) =>
        planet(Number(name), placed[Number(name)] ?? OWN_SIGNS[Number(name)], ascendantSign),
    ),
});

const parivartana = (facts: ChartFacts) =>
    Object.fromEntries(
        computeYogaDoshas(facts)
            .yogas.filter(({ id }) => id.endsWith("Parivartana"))
            .map((yoga) => [yoga.id, yoga]),
    ) as Record<string, YogaEvaluation>;

describe("Parivartana Yoga", () => {
    test("the doc's example: Mithuna lagna, Mercury in Kumbha, Saturn in Kanya is a 4-9 Maha Parivartana", () => {
        const yogas = parivartana(chart(3, { 4: 11, 7: 6 }));

        expect(yogas.mahaParivartana.isPresent).toBe(true);
        expect(yogas.mahaParivartana.formation.reasons).toEqual([
            {
                rule: "mahaParivartana.pv01",
                reasonKey: "rule.pv01",
                params: { house1: 4, house2: 9, lord1: 4, lord2: 7 },
            },
        ]);
        expect(yogas.mahaParivartana.formation.planets).toEqual([4, 7]);
        expect(yogas.mahaParivartana.context.houseImpact).toEqual([4, 9]);
        expect(yogas.khalaParivartana.isPresent).toBe(false);
        expect(yogas.dainyaParivartana.isPresent).toBe(false);
    });

    test("a planet in its own sign or a one-way placement is not an exchange", () => {
        const yogas = parivartana(chart(1, { 6: 1 }));
        expect(Object.values(yogas).some(({ isPresent }) => isPresent)).toBe(false);
    });

    test("an exchange touching the 3rd (and no dusthana) is Khala", () => {
        // Mesha lagna: Mars (1st/8th lord) and Mercury (3rd/6th lord) — Mars in Mithuna (3), Mercury in Mesha (1).
        const yogas = parivartana(chart(1, { 3: 3, 4: 1 }));
        expect(yogas.khalaParivartana.isPresent).toBe(true);
        expect(yogas.khalaParivartana.formation.reasons[0].params).toEqual({
            house1: 1,
            house2: 3,
            lord1: 3,
            lord2: 4,
        });
    });

    test("6, 8 or 12 wins over the 3rd: a 3-6 style exchange is Dainya", () => {
        // Mesha lagna: Mercury in Kumbha (11) owned by Saturn, Saturn in Kanya (6) owned by Mercury → 6-11.
        const yogas = parivartana(chart(1, { 4: 11, 7: 6 }));
        expect(yogas.dainyaParivartana.isPresent).toBe(true);
        expect(yogas.dainyaParivartana.formation.reasons[0].params).toEqual({
            house1: 6,
            house2: 11,
            lord1: 4,
            lord2: 7,
        });

        // Mesha lagna: Mars in Mithuna (3), Mercury in Vrishchika (8) → 3-8, Dainya not Khala.
        const mixed = parivartana(chart(1, { 3: 3, 4: 8 }));
        expect(mixed.dainyaParivartana.isPresent).toBe(true);
        expect(mixed.khalaParivartana.isPresent).toBe(false);
    });

    test("two exchanges of different types each show under their own yoga", () => {
        // Mithuna lagna: Mercury↔Saturn 4-9 (Maha) and Sun↔Moon (Kataka 2 / Simha 3) → 2-3 Khala.
        const yogas = parivartana(chart(3, { 4: 11, 7: 6, 1: 4, 2: 5 }));
        expect(yogas.mahaParivartana.isPresent).toBe(true);
        expect(yogas.khalaParivartana.isPresent).toBe(true);
        expect(yogas.khalaParivartana.formation.reasons[0].params).toEqual({
            house1: 2,
            house2: 3,
            lord1: 2,
            lord2: 1,
        });
    });

    test("Rahu and Ketu never form a Parivartana", () => {
        const facts = chart(1, {});
        facts.planets.push(planet(8, 5, 1), planet(9, 11, 1));
        expect(Object.values(parivartana(facts)).some(({ isPresent }) => isPresent)).toBe(false);
    });
});
