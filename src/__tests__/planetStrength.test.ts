/**
 * Planet-strength factors (TODO #26) — pure derivation unit tests. QA plan: D-10 addendum to
 * specs/development/20260816-1923-student-notes-implementation.md.
 *
 * Only PRESENT factors are emitted — absence NEVER produces a tag (user-confirmed 2026-08-19: no
 * "මරණකාරක නොවේ" / "No Dig Bala" type tags). The planet ratio counts ONLY the shown (emitted) tags:
 * `{ green, green + red }` — white/informational tags are shown but never affect it.
 */
import type { Aspect } from "@/lib/astrology";
import type { CalculatedDetailsLike } from "@/lib/notepadObservations";
import {
    bhavaColorOf,
    computePlanetStrengths,
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
    test("zero-total (no green/red shown tags) is neutral white", () => {
        expect(ratioColorOf({ green: 0, total: 0 })).toBe("white");
    });

    test.each([
        [{ green: 1, total: 4 }, "darkRed"], // 25%
        [{ green: 2, total: 5 }, "lightRed"], // 40%
        [{ green: 3, total: 5 }, "white"], // 60%
        [{ green: 4, total: 5 }, "lightGreen"], // 80%
        [{ green: 5, total: 5 }, "darkGreen"], // 100%
    ])("%o → %s", (ratio, expected) => {
        expect(ratioColorOf(ratio)).toBe(expected);
    });
});

describe("nextPlanetFactorColor — the student toggle cycle", () => {
    test("cycles green → red → white → green", () => {
        expect(nextPlanetFactorColor("green")).toBe("red");
        expect(nextPlanetFactorColor("red")).toBe("white");
        expect(nextPlanetFactorColor("white")).toBe("green");
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
        // sign factor alone classifies polarity.
        expect(byPlanet[1].factors.map((f) => [f.key, f.color])).toEqual([["sign", "green"]]);
        expect(byPlanet[1].ratio).toEqual({ green: 1, total: 1 });
        expect(byPlanet[2].factors.map((f) => [f.key, f.color])).toEqual([["sign", "red"]]);
        expect(byPlanet[2].ratio).toEqual({ green: 0, total: 1 });
        // White (neutral) tags are shown but never affect the ratio.
        expect(byPlanet[3].ratio).toEqual({ green: 0, total: 0 });
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
        // green: sign, dig, cheshta = 3 of 3 shown tags.
        expect(byPlanet[5].ratio).toEqual({ green: 3, total: 3 });

        // Lost balas → no tag at all (no "netha" tags, never red).
        expect(byPlanet[6].factors.map((f) => [f.key, f.color])).toEqual([["sign", "green"]]);
        expect(byPlanet[6].ratio).toEqual({ green: 1, total: 1 });
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
        expect(byPlanet[1].ratio).toEqual({ green: 1, total: 2 }); // combust red counts; retrograde white does not
        // Non-combust → no "not combust" tag.
        expect(byPlanet[2].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[2].ratio).toEqual({ green: 1, total: 1 });
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
            ["maranakaraka", "red"],
            ["maraka", "red"],
            ["badhaka", "red"],
            ["wargoththama", "green"],
            ["pushkara", "green"],
            ["gandantha", "red"],
            ["gandamula", "red"],
            ["ashtamansha", "red"],
            ["nidhanamsha", "red"],
        ]);
        expect(byPlanet[5].ratio).toEqual({ green: 5, total: 12 }); // sign + 4 benefic present vs 7 malefic present

        // Non-members → no flag tags at all, ratio stays clean (only shown tags count).
        expect(byPlanet[6].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[6].ratio).toEqual({ green: 1, total: 1 });
        expect(byPlanet[7].factors.map((f) => f.key)).toEqual(["sign"]);
        expect(byPlanet[7].ratio).toEqual({ green: 1, total: 1 });
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
        expect(factors.maranakaraka.color).toBe("red");
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
        // green: sign, navamsa, dig, cheshta, atmakaraka, wargoththama = 6
        // red: combust = 1   (kala/naisargika lost → not emitted; retrograde white shown, not counted)
        expect(entry.ratio).toEqual({ green: 6, total: 7 });
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
    test("an override replaces the effective color; white/neutral tags never count", () => {
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
        // Shown: sign, navamsa, dig, cheshta. Derived green: sign, navamsa, dig = 3
        // (cheshta forced red → red = 1). The stored `house` override is inert — the `house`
        // factor no longer emits (kept in the validation catalog only so old overrides persist).
        expect(entry.ratio).toEqual({ green: 3, total: 4 });
        expect(entry.factors.some((f) => f.key === "house")).toBe(false);
        expect(entry.factors.find((f) => f.key === "cheshta")?.color).toBe("red");
    });

    test("an override can make a neutral factor green (student determination)", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 2, sign: 5, house: 3, strength: 0 }] }), {
            "2": { sign: "green" },
        });
        // sign stays white (Sama) by default, overridden to green → 1 of 1 decidable.
        expect(result[0].ratio).toEqual({ green: 1, total: 1 });
    });

    test("overrides never throw for unknown planets/keys", () => {
        expect(() =>
            computePlanetStrengths(calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25 }] }), {
                "99": { nonexistent: "green" },
            }),
        ).not.toThrow();
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
        expect(entry.houseOwnerHouses).toEqual([2, 7]); // Venus rules Taurus + Libra
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

    test("context tags never affect the factor ratio", () => {
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
        expect(result[0].ratio).toEqual({ green: 1, total: 1 });
        expect(result[1].ratio).toEqual({ green: 1, total: 1 });
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
