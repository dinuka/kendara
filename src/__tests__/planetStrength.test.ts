/**
 * Planet-strength factors (TODO #26) — pure derivation unit tests. QA plan: D-10 addendum to
 * specs/development/20260816-1923-student-notes-implementation.md.
 *
 * Only PRESENT factors are emitted — absence NEVER produces a tag (user-confirmed 2026-08-19: no
 * "මරණකාරක නොවේ" / "No Dig Bala" type tags). The planet ratio counts ONLY the shown (emitted) tags:
 * `{ green, green + red }` — white/informational tags are shown but never affect it.
 */
import type { CalculatedDetailsLike } from "@/lib/notepadObservations";
import { computePlanetStrengths, nextPlanetFactorColor, planetStrengthOf, ratioColorOf } from "@/lib/planetStrength";

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
    test("sign + house: kendra/trikona green, dusthana red, upachaya white", () => {
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
        expect(byPlanet[1].factors.map((f) => [f.key, f.color])).toEqual([
            ["sign", "green"],
            ["house", "green"],
        ]);
        expect(byPlanet[1].ratio).toEqual({ green: 2, total: 2 });
        expect(byPlanet[2].factors.map((f) => [f.key, f.color])).toEqual([
            ["sign", "red"],
            ["house", "red"],
        ]);
        expect(byPlanet[2].ratio).toEqual({ green: 0, total: 2 });
        // White (neutral) tags are shown but never affect the ratio.
        expect(byPlanet[3].ratio).toEqual({ green: 0, total: 0 });
    });

    test("navamsa factor appears only when navamsaStrength is stored; sign/navamsa carry the sign+strength params", () => {
        const result = computePlanetStrengths(
            calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25, navamsaStrength: 0.75 }] }),
        );
        const keys = result[0].factors.map((f) => f.key);
        expect(keys).toEqual(["sign", "navamsa", "house"]);

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
        // green: sign, house, dig, cheshta = 4 of 4 shown tags.
        expect(byPlanet[5].ratio).toEqual({ green: 4, total: 4 });

        // Lost balas → no tag at all (no "netha" tags, never red).
        expect(byPlanet[6].factors.map((f) => [f.key, f.color])).toEqual([
            ["sign", "green"],
            ["house", "green"],
        ]);
        expect(byPlanet[6].ratio).toEqual({ green: 2, total: 2 });
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
        expect(result[0].factors.map((f) => f.key)).toEqual(["sign", "house"]);
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
            ["house", "green"],
            ["retrograde", "white"],
            ["combust", "red"],
        ]);
        expect(byPlanet[1].ratio).toEqual({ green: 2, total: 3 }); // combust red counts; retrograde white does not
        // Non-combust → no "not combust" tag.
        expect(byPlanet[2].factors.map((f) => f.key)).toEqual(["sign", "house"]);
        expect(byPlanet[2].ratio).toEqual({ green: 2, total: 2 });
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

        const p5 = byPlanet[5].factors.filter((f) => f.key !== "sign" && f.key !== "house");
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
        expect(byPlanet[5].ratio).toEqual({ green: 6, total: 13 }); // sign+house + 4 benefic present vs 7 malefic present

        // Non-members → no flag tags at all, ratio stays clean (only shown tags count).
        expect(byPlanet[6].factors.map((f) => f.key)).toEqual(["sign", "house"]);
        expect(byPlanet[6].ratio).toEqual({ green: 2, total: 2 });
        expect(byPlanet[7].factors.map((f) => f.key)).toEqual(["sign", "house"]);
        expect(byPlanet[7].ratio).toEqual({ green: 2, total: 2 });
    });

    test("missing flag data is NOT a factor — no flag tags at all", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 7, sign: 9, house: 9, strength: 1.25 }] }));
        expect(result[0].factors.map((f) => f.key)).toEqual(["sign", "house"]);
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
            "house",
            "dig",
            "cheshta",
            "retrograde",
            "combust",
            "atmakaraka",
            "wargoththama",
        ]);
        // green: sign, navamsa, house, dig, cheshta, atmakaraka, wargoththama = 7
        // red: combust = 1   (kala/naisargika lost → not emitted; retrograde white shown, not counted)
        expect(entry.ratio).toEqual({ green: 7, total: 8 });
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
        // Shown: sign, navamsa, house, dig, cheshta. Derived green: sign, navamsa, dig = 3
        // (house forced neutral, cheshta forced red → red = 1).
        expect(entry.ratio).toEqual({ green: 3, total: 4 });
        expect(entry.factors.find((f) => f.key === "house")?.color).toBe("white");
        expect(entry.factors.find((f) => f.key === "cheshta")?.color).toBe("red");
    });

    test("an override can make a neutral factor green (student determination)", () => {
        const result = computePlanetStrengths(calc({ planets: [{ name: 2, sign: 5, house: 3, strength: 0 }] }), {
            "2": { house: "green" },
        });
        // sign stays white (Sama), house overridden to green → 1 of 1 decidable.
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

describe("planetStrengthOf (UT-PS-111)", () => {
    test("returns the entry for a present planet, undefined otherwise", () => {
        const calculated = calc({ planets: [{ name: 2, sign: 5, house: 7, strength: 1.25 }] });
        expect(planetStrengthOf(calculated, 2)?.planet).toBe(2);
        expect(planetStrengthOf(calculated, 3)).toBeUndefined();
        expect(planetStrengthOf(null, 2)).toBeUndefined();
    });
});
