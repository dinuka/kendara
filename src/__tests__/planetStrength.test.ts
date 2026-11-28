/**
 * Planet-strength factors (TODO #26) — pure derivation unit tests. QA plan: D-10 addendum to
 * specs/development/20260816-1923-student-notes-implementation.md.
 *
 * Only PRESENT factors are emitted — absence NEVER produces a tag (user-confirmed 2026-08-19: no
 * "මරණකාරක නොවේ" / "No Dig Bala" type tags). The planet ratio = (all shown chips − red ones) / all
 * shown chips: `{ good, total }` where `good` = non-red (green, dark-green or neutral white) count —
 * white/informational tags count as good, red (incl. dark-red) subtract.
 */
import type { Aspect } from "@/lib/astrology";
import type { CalculatedDetailsLike } from "@/lib/notepadObservations";
import {
    bhavaColorOf,
    computePlanetStrengths,
    houseOwnerRelationColorOf,
    houseOwnerRelationTagColorOf,
    nextPlanetFactorColor,
    planetStrengthOf,
    ratioColorOf,
} from "@/lib/planetStrength";

const calc = (overrides: Partial<CalculatedDetailsLike> = {}): CalculatedDetailsLike => ({
    ascendant: { sign: 1, degree: 0 },
    planets: [],
    ...overrides,
});

describe("ratioColorOf — the 5-band ratio rule (D-10)", () => {
    test("zero-total (no shown factor chips) is neutral white", () => {
        expect(ratioColorOf({ good: 0, total: 0 })).toBe("white");
    });

    test.each([
        [{ good: 1, total: 4 }, "darkRed"], // 25%
        [{ good: 2, total: 5 }, "lightRed"], // 40%
        [{ good: 3, total: 5 }, "white"], // 60%
        [{ good: 4, total: 5 }, "lightGreen"], // 80%
        [{ good: 5, total: 5 }, "darkGreen"], // 100%
    ])("%o → %s", (ratio, expected) => {
        expect(ratioColorOf(ratio)).toBe(expected);
    });
});

describe("nextPlanetFactorColor — the student toggle cycle", () => {
    test("cycles green → red → white → green", () => {
        expect(nextPlanetFactorColor("green")).toBe("red");
        expect(nextPlanetFactorColor("red")).toBe("white");
        expect(nextPlanetFactorColor("white")).toBe("green");
        // Derived dark shades advance from their base colour, then persist as a normal override.
        expect(nextPlanetFactorColor("darkGreen")).toBe("red");
        expect(nextPlanetFactorColor("darkRed")).toBe("white");
    });
});

describe("computePlanetStrengths — empty/null inputs (UT-PS-101)", () => {
    test("null/undefined calculated → no entries", () => {
        expect(computePlanetStrengths(null)).toEqual([]);
        expect(computePlanetStrengths(undefined)).toEqual([]);
    });

    test("no planets → no entries", () => {
        expect(computePlanetStrengths(calc({ planets: [] }))).toEqual([]);
    });

    test("corrupt planet rows (null / non-numeric name) are skipped without throwing", () => {
        const result = computePlanetStrengths(
            calc({ planets: [null as never, { name: 2, sign: 5, house: 7, strength: 1.25 }, { name: "x" } as never] }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].planet).toBe(2);
    });
});

describe("computePlanetStrengths — always-present polarity factors (UT-PS-102..108)", () => {
    test("sign factor classifies polarity; the current-house chip is replaced by ownership context", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 9, strength: 1.25 }, // trikona
                    { name: 2, sign: 5, house: 6, strength: -1 }, // dusthana
                    { name: 3, sign: 5, house: 3, strength: 0 }, // upachaya
                ],
            }),
        );
        const byPlanet = Object.fromEntries(result.map((entry) => [entry.planet, entry]));
        // The `house` factor is no longer emitted (replaced by the ownership context tags) — the
        // sign factor alone classifies polarity. The ratio now counts EVERY rendered tag: the sign
        // chip, the same-sign conjunctions (all three planets share sign 5) and the owned-house /
        // house-owner context tags (lagna Aries; the stored `house` drives the owner lookup).
        expect(byPlanet[1].factors.map((f) => [f.key, f.color])).toEqual([["sign", "green"]]);
        // Sun: the "with Moon"/"with Mars" conjunctions + the house-owner tags; Moon's own full band
        // is green so the conjunction chips count as good → 5/6.
        expect(byPlanet[1].ratio).toEqual({ good: 5, total: 6 });
        expect(byPlanet[2].factors.map((f) => [f.key, f.color])).toEqual([["sign", "red"]]);
        expect(byPlanet[2].ratio).toEqual({ good: 5, total: 6 });
        // White (neutral Sama) sign chip is shown and counts as good.
        expect(byPlanet[3].ratio).toEqual({ good: 5, total: 7 });
    });

    test("navamsa factor appears only when navamsaStrength is stored; sign/navamsa carry the sign+strength params", () => {
        const result = computePlanetStrengths(
            calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25, navamsaStrength: 0.75 }] }),
        );
        const keys = result[0].factors.map((f) => f.key);
        expect(keys).toEqual(["sign", "navamsa"]);

        // The sign factor carries { sign, strength }; navamsa carries them too when navamsaSign exists.
        const withNavSign = computePlanetStrengths(
            calc({ planets: [{ name: 2, sign: 7, house: 1, strength: -1, navamsaSign: 2, navamsaStrength: -0.1 }] }),
        )[0];
        expect(withNavSign.factors.find((f) => f.key === "sign")?.params).toEqual({ sign: 7, strength: -1 });
        expect(withNavSign.factors.find((f) => f.key === "navamsa")?.params).toEqual({ sign: 2, strength: -0.1 });
    });
});

describe("computePlanetStrengths — bala factors: gained only, no netha tags (UT-PS-102..108)", () => {
    test("gained balas emit green; lost/missing balas emit NO tag at all", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 5, sign: 9, house: 9, strength: 1.25 },
                    { name: 6, sign: 9, house: 9, strength: 1.25 },
                ],
                shadbalaya: {
                    "5": {
                        digBala: { value: true },
                        kalaBala: { value: false },
                        cheshtaBala: { value: true },
                        naisargikaBala: { value: false },
                    },
                    "6": { digBala: { value: false }, cheshtaBala: { value: false } },
                },
            }),
        );
        const byPlanet = Object.fromEntries(result.map((entry) => [entry.planet, entry]));

        // Only the two GAINED balas are tags; kala/naisargika lost → nothing.
        const p5Balas = byPlanet[5].factors.filter((f) => ["dig", "kala", "cheshta", "naisargika"].includes(f.key));
        expect(p5Balas.map((f) => [f.key, f.color])).toEqual([
            ["dig", "green"],
            ["cheshta", "green"],
        ]);
        // factor chips: sign + dig + cheshta (green) — plus context tags (conjunction with planet 6,
        // owned house + house-owner block) — all count toward the ratio now.
        expect(byPlanet[5].ratio).toEqual({ good: 5, total: 6 });

        // Lost balas → no tag at all (no "netha" tags, never red).
        expect(byPlanet[6].factors.map((f) => [f.key, f.color])).toEqual([["sign", "green"]]);
        expect(byPlanet[6].ratio).toEqual({ good: 6, total: 7 });
    });

    test("dig never for Rahu/Ketu even when a digBala entry exists", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 8, sign: 9, house: 9, strength: 1.25 },
                    { name: 9, sign: 9, house: 9, strength: 1.25 },
                ],
                shadbalaya: {
                    "8": { digBala: { value: true } },
                    "9": { digBala: { value: true } },
                },
            }),
        );
        for (const entry of result) {
            expect(entry.factors.some((f) => f.key === "dig")).toBe(false);
        }
    });

    test("no shadbalaya at all → no bala factors (missing data is not a factor)", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 5, sign: 9, house: 9, strength: 1.25 }] }));
        expect(result[0].factors.map((f) => f.key)).toEqual(["sign"]);
    });

    test("retrograde is informational white; combust emits only when true", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 7, strength: 1.25, retrograde: true, combustion: true },
                    { name: 2, sign: 5, house: 7, strength: 1.25, combustion: false },
                ],
            }),
        );
        const byPlanet = Object.fromEntries(result.map((entry) => [entry.planet, entry]));
        expect(byPlanet[1].factors.map((f) => [f.key, f.color])).toEqual([
            ["sign", "green"],
            ["retrograde", "white"],
            ["combust", "red"],
        ]);
        expect(byPlanet[1].ratio).toEqual({ good: 6, total: 7 }); // context tags included; combust red subtracts
        // Non-combust → no "not combust" tag.
        expect(byPlanet[2].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[2].ratio).toEqual({ good: 5, total: 5 });
    });
});

describe("computePlanetStrengths — karaka/varga flags: members only (UT-PS-107)", () => {
    const FLAGS = {
        atmakaraka: 5,
        yogakaraka: [5],
        maranakaraka: [5],
        marakaPlanets: [5],
        badhakaPlanet: [5],
        wargoththamaPlanets: [5],
        pushkaraPlanets: [5],
        gandanthaPlanets: [5],
        gandamulaPlanets: [5],
        ashtamanshaPlanets: [5],
        nidhanamshaPlanets: [5],
    };

    test("member → coloured tag; non-member → NO tag (no 'not X')", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 5, sign: 9, house: 9, strength: 1.25 },
                    { name: 6, sign: 9, house: 9, strength: 1.25 },
                    { name: 7, sign: 9, house: 9, strength: 1.25 },
                ],
                ...FLAGS,
            }),
        );
        const byPlanet = Object.fromEntries(result.map((entry) => [entry.planet, entry]));

        const p5 = byPlanet[5].factors.filter((f) => f.key !== "sign");
        expect(p5.map((f) => [f.key, f.color])).toEqual([
            ["atmakaraka", "green"],
            ["yogakaraka", "green"],
            ["maranakaraka", "darkRed"],
            ["maraka", "red"],
            ["badhaka", "red"],
            ["wargoththama", "darkGreen"],
            ["pushkara", "darkGreen"],
            ["gandantha", "red"],
            ["gandamula", "red"],
            ["ashtamansha", "darkRed"],
            ["nidhanamsha", "darkRed"],
        ]);
        expect(byPlanet[5].ratio).toEqual({ good: 8, total: 16 }); // factor chips + context tags all counted

        // Non-members → no flag tags; the ratio still counts their own context tags.
        expect(byPlanet[6].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[6].ratio).toEqual({ good: 7, total: 8 });
        expect(byPlanet[7].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[7].ratio).toEqual({ good: 7, total: 8 });
    });

    test("missing flag data is NOT a factor — no flag tags at all", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 7, sign: 9, house: 9, strength: 1.25 }] }));
        expect(result[0].factors.map((f) => f.key)).toEqual(["sign"]);
    });

    test("an individual malefic flag is red while a benefic one is green — no aggregate wins", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [{ name: 5, sign: 9, house: 9, strength: 1.25 }],
                atmakaraka: 5,
                maranakaraka: [5],
            }),
        );
        const factors = Object.fromEntries(result[0].factors.map((f) => [f.key, f]));
        expect(factors.atmakaraka.color).toBe("green");
        expect(factors.maranakaraka.color).toBe("darkRed");
    });
});

describe("computePlanetStrengths — order + denominator (UT-PS-105)", () => {
    test("factor order follows the catalog; ratio counts only the shown tags", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    {
                        name: 5,
                        sign: 9,
                        house: 10,
                        strength: 1.25,
                        navamsaStrength: 0.75,
                        retrograde: true,
                        combustion: true,
                    },
                ],
                atmakaraka: 5,
                wargoththamaPlanets: [5],
                shadbalaya: {
                    "5": {
                        digBala: { value: true },
                        kalaBala: { value: false },
                        cheshtaBala: { value: true },
                        naisargikaBala: { value: false },
                    },
                },
            }),
        );
        const entry = result[0];
        expect(entry.factors.map((f) => f.key)).toEqual([
            "sign",
            "navamsa",
            "dig",
            "cheshta",
            "retrograde",
            "combust",
            "atmakaraka",
            "wargoththama",
        ]);
        // Factor chips: sign, navamsa, dig, cheshta, atmakaraka, wargoththama, retrograde (white) = 7 good
        // candidates, combust red; plus the context tags (conjunctions, owned house, house owner…).
        expect(entry.ratio).toEqual({ good: 10, total: 12 });
        expect(entry.factors.filter((f) => f.color === "white")).toHaveLength(1); // retrograde only
    });

    test("planets are returned in enum order regardless of input order", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 9, sign: 9, house: 9, strength: 0 },
                    { name: 3, sign: 9, house: 9, strength: 0 },
                    { name: 1, sign: 9, house: 9, strength: 0 },
                ],
            }),
        );
        expect(result.map((entry) => entry.planet)).toEqual([1, 3, 9]);
    });
});

describe("computePlanetStrengths — student overrides (UT-PS-110)", () => {
    test("an override replaces the effective color; white tags count as good", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [{ name: 5, sign: 9, house: 10, strength: 1.25, navamsaStrength: 0.75 }],
                shadbalaya: {
                    "5": {
                        digBala: { value: true },
                        kalaBala: { value: false },
                        cheshtaBala: { value: true },
                        naisargikaBala: { value: false },
                    },
                },
            }),
            { "5": { house: "white", cheshta: "red" } },
        );
        const entry = result[0];
        // Shown: sign, navamsa, dig, cheshta. Derived good: sign, navamsa, dig = 3 (cheshta forced red →
        // red = 1); the context tags (conjunction + owned-house + house-owner block) add to the total.
        // The stored `house` override is inert — the `house` factor no longer emits (kept in the
        // validation catalog only so old overrides persist).
        expect(entry.ratio).toEqual({ good: 6, total: 8 });
        expect(entry.factors.some((f) => f.key === "house")).toBe(false);
        expect(entry.factors.find((f) => f.key === "cheshta")?.color).toBe("red");
    });

    test("an override can make a neutral factor green (student determination)", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 2, sign: 5, house: 3, strength: 0 }] }), {
            "2": { sign: "green" },
        });
        // sign stays white (Sama) by default, overridden to green; the owned-house + house-owner context
        // tags are good → ratio counts all of them.
        expect(result[0].ratio).toEqual({ good: 3, total: 4 });
    });

    test("overrides never throw for unknown planets/keys", () => {
        expect(() =>
            computePlanetStrengths(calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25 }] }), {
                "99": { nonexistent: "green" },
            }),
        ).not.toThrow();
    });

    test("locked factors ignore stored overrides — they always keep their derived dark shade", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [{ name: 1, sign: 4, house: 11, strength: 1.25 }],
                pushkaraPlanets: [1],
                maranakaraka: [1],
            }),
            { "1": { pushkara: "red", sign: "red" } },
        );
        const entry = result[0];
        // Sun's pushkara override is stale (recolouring a locked factor) — the derived darkGreen
        // is kept and counts as green; the non-locked `sign` override still applies.
        expect(entry.factors.find((f) => f.key === "pushkara")?.color).toBe("darkGreen");
        expect(entry.factors.find((f) => f.key === "maranakaraka")?.color).toBe("darkRed");
        expect(entry.factors.find((f) => f.key === "sign")?.color).toBe("red");
        // Factor chips: pushkara (darkGreen) good; sign + maranakaraka (darkRed) red → plus the context
        // tags (owned house, house owner…) — all shown tags count toward the ratio.
        expect(entry.ratio).toEqual({ good: 4, total: 6 });
    });
});

describe("computePlanetStrengths — Graha bala context tags (TODO #25/#26/#27)", () => {
    test("bhavaColorOf: 6/8/12 red, 1/5/9 green, anything else gray (white)", () => {
        expect(bhavaColorOf(6)).toBe("red");
        expect(bhavaColorOf(8)).toBe("red");
        expect(bhavaColorOf(12)).toBe("red");
        expect(bhavaColorOf(1)).toBe("green");
        expect(bhavaColorOf(5)).toBe("green");
        expect(bhavaColorOf(9)).toBe("green");
        expect(bhavaColorOf(2)).toBe("white");
        expect(bhavaColorOf(4)).toBe("white");
        expect(bhavaColorOf(10)).toBe("white");
    });

    test("houseOwnerRelationColorOf: 1/2/5/9 green (owner's placement house), 6/8/12 red, else gray", () => {
        expect(houseOwnerRelationColorOf(1)).toBe("green");
        expect(houseOwnerRelationColorOf(2)).toBe("green");
        expect(houseOwnerRelationColorOf(5)).toBe("green");
        expect(houseOwnerRelationColorOf(9)).toBe("green");
        expect(houseOwnerRelationColorOf(6)).toBe("red");
        expect(houseOwnerRelationColorOf(8)).toBe("red");
        expect(houseOwnerRelationColorOf(12)).toBe("red");
        expect(houseOwnerRelationColorOf(7)).toBe("white");
        expect(houseOwnerRelationColorOf(10)).toBe("white");
        expect(houseOwnerRelationColorOf(undefined)).toBe("white");
    });

    test("houseOwnerRelationTagColorOf: own-sign placement (relation 1) is always green, even in a gray house", () => {
        // The real chart bug: Venus in Libra of a Sagittarius lagna = house 11 (gray) yet the
        // "තමාගේම භාවයේ" tag must be green.
        expect(houseOwnerRelationTagColorOf(1, 11)).toBe("green");
        expect(houseOwnerRelationTagColorOf(1, 6)).toBe("green");
        expect(houseOwnerRelationTagColorOf(1, undefined)).toBe("green");
        // Other relations follow the owner's placement house rule.
        expect(houseOwnerRelationTagColorOf(2, 2)).toBe("green");
        expect(houseOwnerRelationTagColorOf(3, 11)).toBe("white");
        expect(houseOwnerRelationTagColorOf(3, 8)).toBe("red");
        expect(houseOwnerRelationTagColorOf(undefined, undefined)).toBe("white");
    });

    test("conjunctions: stored same-sign fallback carries the true-degree orb, enum order", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 8, strength: 1.25, absoluteDegree: 120 },
                    { name: 4, sign: 5, house: 8, strength: 1.25, absoluteDegree: 122.3 },
                ],
            }),
        );
        expect(result[0].conjunctions).toEqual([{ planet: 4, orb: 2.3 }]);
        expect(result[1].conjunctions).toEqual([{ planet: 1, orb: 2.3 }]);
    });

    test("conjunctions: planets in different signs are NOT conjunct (no phantom tags)", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 8, strength: 1.25 },
                    { name: 2, sign: 9, house: 12, strength: 1.25 },
                ],
            }),
        );
        expect(result[0].conjunctions).toEqual([]);
        expect(result[1].conjunctions).toEqual([]);
    });

    test("aspects received: stored records win (reasons kept), conjunctions (aspectType 0) excluded", () => {
        const aspect: Aspect = {
            planetName: 2,
            aspectType: 60,
            planetAbsoluteDegree: 90,
            degreeGap: 1.2,
            exactAspectDegree: 60,
            isBeneficial: true,
            delta: 1.2,
            reasons: [{ type: "planetary", angle: 60, delta: 1.2 }],
        };
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 8, strength: 1.25, aspects: [{ planetName: 2, aspectType: 0 }, aspect] },
                    { name: 2, sign: 9, house: 12, strength: 1.25 },
                ],
            }),
        );
        expect(result[1].receivedAspects).toEqual([
            {
                planet: 1,
                aspectType: 60,
                aspectingSign: 5,
                aspect,
            },
        ]);
        expect(result[0].receivedAspects).toEqual([]);
    });

    test("ownedHouses + houseOwner + houseOwnerHouses: whole-sign lordship from the lagna", () => {
        const result = computePlanetStrengths(
            calc({
                ascendant: { sign: 1, degree: 0, lord: 3 },
                planets: [{ name: 1, sign: 5, house: 7, strength: 1.25 }], // Sun in Leo (house 7)
            }),
        );
        const entry = result[0];
        expect(entry.ownedHouses).toEqual([5]); // Sun rules Leo → D1 house 5
        expect(entry.houseOwner).toBe(6); // house 7 = Libra → Venus
        expect(entry.houseOwnerHouses).toEqual([2]); // Venus rules Taurus + Libra but the current house 7 is excluded
        expect(entry.houseOwnerRelation).toBeUndefined(); // Venus has no sign data in this chart
    });

    test("houseOwnerHouses excludes the current house; houseOwnerRelation counts from the owner's sign", () => {
        // Moon in Gemini (house 3, Mercury's sign) with Mercury placed in Aries — count 3 from Mercury.
        const result = computePlanetStrengths(
            calc({
                ascendant: { sign: 1, degree: 0, lord: 3 },
                planets: [
                    { name: 2, sign: 3, house: 3, strength: 1.25 }, // Moon in Gemini
                    { name: 4, sign: 1, house: 1, strength: 1.25 }, // Mercury in Aries
                ],
            }),
        );
        const moon = result[0];
        expect(moon.houseOwner).toBe(4); // Mercury rules Gemini
        expect(moon.houseOwnerHouses).toEqual([6]); // Mercury rules Gemini(3) + Virgo(6); current house 3 excluded
        expect(moon.houseOwnerRelation).toBe(3); // Gemini is the 3rd sign from Mercury's Aries
        expect(moon.houseOwnerHouse).toBe(1); // Mercury placed in Aries → house 1 → the relation tag is green
        expect(houseOwnerRelationColorOf(moon.houseOwnerHouse)).toBe("green");

        // Owner placed in the sign it rules → relation 1 ("in its own house").
        const self = computePlanetStrengths(
            calc({
                ascendant: { sign: 1, degree: 0, lord: 3 },
                planets: [
                    { name: 2, sign: 3, house: 3, strength: 1.25 }, // Moon in Gemini
                    { name: 4, sign: 3, house: 3, strength: 1.25 }, // Mercury in Gemini
                ],
            }),
        );
        expect(self[0].houseOwnerRelation).toBe(1);
    });

    test("nakshatra owner: the Vimshottari lord of the occupied nakshatra", () => {
        const result = computePlanetStrengths(
            calc({ planets: [{ name: 1, sign: 5, house: 7, strength: 1.25, nakshatra: 1 }] }),
        );
        expect(result[0].nakshatraOwner).toBe(9); // nakshatra 1 → Ketu
        const without = computePlanetStrengths(calc({ planets: [{ name: 1, sign: 5, house: 7, strength: 1.25 }] }));
        expect(without[0].nakshatraOwner).toBeUndefined();
    });

    test("bhavaSuchika: read from the stored per-planet record when present, absent otherwise", () => {
        const withBhava = computePlanetStrengths(
            calc({
                planets: [{ name: 1, sign: 5, house: 7, strength: 1.25 }],
                bhavaSuchika: { "1": 4 },
            }),
        );
        expect(withBhava[0].bhavaSuchika).toBe(4);
        const without = computePlanetStrengths(calc({ planets: [{ name: 1, sign: 5, house: 7, strength: 1.25 }] }));
        expect(without[0].bhavaSuchika).toBeUndefined();
    });

    test("every rendered tag counts toward the ratio — context tags included", () => {
        const result = computePlanetStrengths(
            calc({
                planets: [
                    { name: 1, sign: 5, house: 8, strength: 1.25, nakshatra: 1 },
                    { name: 4, sign: 5, house: 8, strength: 1.25 },
                ],
                bhavaSuchika: { "1": 4 },
            }),
        );
        for (const entry of result) {
            expect(entry.factors.map((f) => f.key)).toEqual(["sign"]);
        }
        expect(result[0].ratio).toEqual({ good: 7, total: 7 });
        expect(result[1].ratio).toEqual({ good: 5, total: 6 });
    });

    test("real-chart regression (6aa93fd170e117c0c03f0041): Sun in Leo, lagna Sagittarius — all panel tags count", () => {
        const result = computePlanetStrengths(
            calc({
                ascendant: { sign: 9, degree: 0, lord: 5 },
                planets: [
                    // Sun in Leo (trikona, green), positive navamsa.
                    { name: 1, sign: 5, house: 9, strength: 1.25, navamsaStrength: 0.1 },
                    // Moon and Mars aspect Sun.
                    {
                        name: 2,
                        sign: 7,
                        house: 11,
                        strength: 1.25,
                        aspects: [{ planetName: 1, aspectType: 120, isBeneficial: true }],
                    },
                    {
                        name: 3,
                        sign: 3,
                        house: 7,
                        strength: 1.25,
                        aspects: [{ planetName: 1, aspectType: 120, isBeneficial: true }],
                    },
                    // Ketu shares Sun's sign → the conjunction chip is a good tag.
                    { name: 9, sign: 5, house: 9, strength: 0 },
                ],
                pushkaraPlanets: [1],
                bhavaSuchika: { "1": 1 },
                atmakaraka: 1,
            }),
        );
        const sun = result.find((r) => r.planet === 1)!;
        expect(new Set(sun.factors.map((f) => f.key))).toEqual(new Set(["sign", "navamsa", "atmakaraka", "pushkara"]));
        // 4 factor chips + conjunction (Ketu) + 2 received aspects (Moon, Mars) + Bhava Suchika +
        // owned house 9 (Leo is the 9th house from Sagittarius) = 9 good tags — no red family.
        expect(sun.conjunctions.map((c) => c.planet)).toEqual([9]);
        expect(sun.receivedAspects.map((a) => a.planet)).toEqual([2, 3]);
        expect(sun.houseOwner).toBe(1); // Sun lords Leo, its own house → owner block hidden
        expect(sun.ratio).toEqual({ good: 9, total: 9 });

        const moon = result.find((r) => r.planet === 2)!;
        // Moon: 1 sign chip + owned house 8 (Cancer is the 8th house, red) + Venus (absent, white) +
        // Venus's other house 6 (red) = 4 tags, 2 red.
        expect(moon.ratio).toEqual({ good: 2, total: 4 });
    });

    test("a referenced planet's FULL ratio band colours its chips — a visually green chip never subtracts (6aa93… regression)", () => {
        // Moon conjunct Mars. Mars's FACTOR-only band is red-family (red sign + locked dark-red
        // maranakaraka) but its FULL band is green (4 more good context tags) — so the "with Mars"
        // chip renders green and must count as GOOD, never subtract. Same-shape bug as the real
        // chart 6aa93fd170e117c0c03f0041 (Mars there counted as dark-red and dragged Moon to 11/14
        // while the panel showed only 2 red chips → 12/14).
        const result = computePlanetStrengths(
            calc({
                ascendant: { sign: 1, degree: 0, lord: 3 },
                planets: [
                    { name: 2, sign: 2, house: 2, strength: 1.25 },
                    { name: 3, sign: 2, house: 2, strength: -1, navamsaStrength: 1 },
                ],
                maranakaraka: [3],
            }),
        );
        const moon = result.find((r) => r.planet === 2)!;
        // Mars: 3 factor chips (sign red + maranakaraka dark-red left, navamsa green) + conjunction
        // (Moon, green) + rashi-lord Venus (absent) + owned house 1 green + owned house 8 red +
        // Venus's other house → 5/8 = 63% light-green.
        expect(result.find((r) => r.planet === 3)!.ratio).toEqual({ good: 5, total: 8 });
        // Moon: sign + "with Mars" (green by Mars's FULL band) + owned house 4 + Venus tags = 5/5.
        expect(moon.ratio).toEqual({ good: 5, total: 5 });
    });
});

describe("planetStrengthOf (UT-PS-111)", () => {
    test("returns the entry for a present planet, undefined otherwise", () => {
        const calculated = calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25 }] });
        expect(planetStrengthOf(calculated, 2)?.planet).toBe(2);
        expect(planetStrengthOf(calculated, 3)).toBeUndefined();
        expect(planetStrengthOf(null, 2)).toBeUndefined();
    });
});
