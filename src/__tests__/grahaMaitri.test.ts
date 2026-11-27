import { Planet } from "@/lib/astrologyEnums";
import { type PlanetTableData, withGrahaMaitri } from "@/lib/chartTableRows";
import {
    CompoundRelationship,
    NATURAL_RELATIONSHIP,
    Relationship,
    compoundRelationship,
    computeGrahaMaitri,
    temporaryRelationship,
} from "@/lib/grahaMaitri";
import { MAITRI_COLUMN_IDS } from "@/lib/tableColumns";

// docs/mithuru-sathuru.md example chart (signs 1–12): Sun Leo, Moon Libra, Mars Taurus,
// Mercury Virgo, Jupiter Sagittarius, Venus Aquarius, Saturn Capricorn.
const SIGNS: Record<number, number> = {
    [Planet.SUN]: 5,
    [Planet.MOON]: 7,
    [Planet.MARS]: 2,
    [Planet.MERCURY]: 6,
    [Planet.JUPITER]: 9,
    [Planet.VENUS]: 11,
    [Planet.SATURN]: 10,
};

describe("natural relationship matrix", () => {
    it("matches BPHS for the Sun", () => {
        const sun = NATURAL_RELATIONSHIP[Planet.SUN];
        expect(sun[Planet.MOON]).toBe(Relationship.FRIEND);
        expect(sun[Planet.MARS]).toBe(Relationship.FRIEND);
        expect(sun[Planet.JUPITER]).toBe(Relationship.FRIEND);
        expect(sun[Planet.MERCURY]).toBe(Relationship.NEUTRAL);
        expect(sun[Planet.VENUS]).toBe(Relationship.ENEMY);
        expect(sun[Planet.SATURN]).toBe(Relationship.ENEMY);
    });

    it("gives the Moon no enemies", () => {
        expect(Object.values(NATURAL_RELATIONSHIP[Planet.MOON])).not.toContain(Relationship.ENEMY);
    });

    it("covers every other classical planet and excludes Rahu/Ketu", () => {
        Object.values(NATURAL_RELATIONSHIP).forEach((row) => expect(Object.keys(row)).toHaveLength(6));
        expect(NATURAL_RELATIONSHIP[Planet.RAHU]).toBeUndefined();
    });
});

describe("temporaryRelationship", () => {
    it.each([
        [2, Relationship.FRIEND],
        [3, Relationship.FRIEND],
        [4, Relationship.FRIEND],
        [10, Relationship.FRIEND],
        [11, Relationship.FRIEND],
        [12, Relationship.FRIEND],
        [1, Relationship.ENEMY],
        [5, Relationship.ENEMY],
        [6, Relationship.ENEMY],
        [7, Relationship.ENEMY],
        [8, Relationship.ENEMY],
        [9, Relationship.ENEMY],
    ])("the %ith sign from A is %s", (house, expected) => {
        const signA = 5;
        const signB = ((signA - 1 + house - 1) % 12) + 1;
        expect(temporaryRelationship(signA, signB)).toBe(expected);
    });

    it("Sun in Leo → Jupiter in Sagittarius is the 5th: enemy", () => {
        expect(temporaryRelationship(5, 9)).toBe(Relationship.ENEMY);
    });
});

describe("compoundRelationship", () => {
    it.each([
        [Relationship.FRIEND, Relationship.FRIEND, CompoundRelationship.ADHI_MITRA],
        [Relationship.NEUTRAL, Relationship.FRIEND, CompoundRelationship.MITRA],
        [Relationship.FRIEND, Relationship.ENEMY, CompoundRelationship.SAMA],
        [Relationship.ENEMY, Relationship.FRIEND, CompoundRelationship.SAMA],
        [Relationship.NEUTRAL, Relationship.ENEMY, CompoundRelationship.SHATRU],
        [Relationship.ENEMY, Relationship.ENEMY, CompoundRelationship.ADHI_SHATRU],
    ])("natural %s + temporary %s → %s", (natural, temporary, expected) => {
        expect(compoundRelationship(natural, temporary)).toBe(expected);
    });
});

describe("computeGrahaMaitri", () => {
    const maitri = computeGrahaMaitri(SIGNS);
    const gradeOf = (a: number, b: number) => maitri[a].find((m) => m.planet === b)?.compound;

    it("lists six relationships per planet (42 in total)", () => {
        expect(Object.values(maitri).flat()).toHaveLength(42);
    });

    it("Sun's relationships in the example chart", () => {
        // Moon (3rd) friend+friend, Mars (10th) friend+friend, Mercury (2nd) neutral+friend,
        // Jupiter (5th) friend+enemy, Venus (7th) enemy+enemy, Saturn (6th) enemy+enemy.
        expect(gradeOf(Planet.SUN, Planet.MOON)).toBe(CompoundRelationship.ADHI_MITRA);
        expect(gradeOf(Planet.SUN, Planet.MARS)).toBe(CompoundRelationship.ADHI_MITRA);
        expect(gradeOf(Planet.SUN, Planet.MERCURY)).toBe(CompoundRelationship.MITRA);
        expect(gradeOf(Planet.SUN, Planet.JUPITER)).toBe(CompoundRelationship.SAMA);
        expect(gradeOf(Planet.SUN, Planet.VENUS)).toBe(CompoundRelationship.ADHI_SHATRU);
        expect(gradeOf(Planet.SUN, Planet.SATURN)).toBe(CompoundRelationship.ADHI_SHATRU);
    });

    it("records the sign count that decides the temporary relationship", () => {
        const sunToJupiter = maitri[Planet.SUN].find((m) => m.planet === Planet.JUPITER);
        expect(sunToJupiter).toMatchObject({ distance: 5, temporary: Relationship.ENEMY });
    });

    it("is directional", () => {
        // Moon → Sun: natural friend, Sun is the 11th from Moon (friend) → adhi mitra.
        expect(gradeOf(Planet.MOON, Planet.SUN)).toBe(CompoundRelationship.ADHI_MITRA);
        // Jupiter → Mercury: natural enemy, Mercury is the 10th from Jupiter (friend) → sama.
        expect(gradeOf(Planet.JUPITER, Planet.MERCURY)).toBe(CompoundRelationship.SAMA);
        // Mercury → Jupiter: natural neutral, Jupiter is the 4th from Mercury (friend) → mitra.
        expect(gradeOf(Planet.MERCURY, Planet.JUPITER)).toBe(CompoundRelationship.MITRA);
    });

    it("treats conjunct planets as temporary enemies", () => {
        const conjunct = computeGrahaMaitri({ [Planet.SUN]: 1, [Planet.MOON]: 1 });
        expect(conjunct[Planet.SUN][0].temporary).toBe(Relationship.ENEMY);
        expect(conjunct[Planet.SUN][0].compound).toBe(CompoundRelationship.SAMA);
    });
});

describe("withGrahaMaitri", () => {
    it("fills rows and makes the five columns available, leaving Rahu/Ketu empty", () => {
        const rows = [...Object.entries(SIGNS), [String(Planet.RAHU), 3]].map(([name, sign]) => ({
            name: Number(name),
            sign: Number(sign),
        }));
        const data = withGrahaMaitri({
            rows,
            available: new Set(["planet"]),
            showAspectDelta: true,
        } as unknown as PlanetTableData);
        MAITRI_COLUMN_IDS.forEach((id) => expect(data.available.has(id)).toBe(true));
        expect(data.rows.find((r) => r.name === Planet.SUN)?.maitri).toHaveLength(6);
        expect(data.rows.find((r) => r.name === Planet.RAHU)?.maitri).toBeUndefined();
    });
});
