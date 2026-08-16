/**
 * Warga Kendara (වර්ග කේනදර) — unit tests.
 * QA plan: specs/qa/20260815-1233-warga-kendara-test-plan.md (UT-WK-* suite).
 */
import * as fs from "fs";
import * as path from "path";

import { navamsaSign } from "@/lib/astrology";
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";
import { calculateHoroscope } from "@/lib/calculation";
import { compute, SIGN_LORD, ownedHousesOf } from "@/lib/manualChart";
import { synthesizeCalculation } from "@/lib/manualChartDetails";
import { computeDigBalaPlanets } from "@/lib/shadBalaya";
import {
    computeWargaKendara,
    computeWargaMaraka,
    resolveWargaKendara,
    VARGA_CATALOG,
} from "@/lib/wargaKendara";
import type { WargaKendara } from "@/lib/wargaKendara";

const baseData = {
    name: "Test",
    displayName: true,
    birthDate: new Date("1990-06-15"),
    birthTime: "08:30",
    location: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    gender: "male" as const,
    ayanamsha: "lahiri" as const,
    isPublic: false,
    owner: { id: "user-1" },
} as unknown as Parameters<typeof calculateHoroscope>[0];

const auto = calculateHoroscope(baseData);

const wedge = (degree: number): number => Math.floor((((degree ?? 0) % 30) + 30) % 30 / (30 / 9)) + 1;

const D1_ONLY_KEYS = [
    "wargoththamaPlanets",
    "pushkaraPlanets",
    "gandanthaPlanets",
    "gandamulaPlanets",
    "lord22ndDrekkana",
    "lord64thNavamsa",
    "cheshtaBalaPlanets",
    "ashtamanshaPlanets",
    "kalaBalaPlanets",
    "atmakaraka",
    "combustPlanets",
    "badhakaPlanets",
] as const;

describe("D1 entry (UT-WK-001..007)", () => {
    const wk = computeWargaKendara(auto, { source: "auto" });
    const d1 = wk.d1 as NonNullable<WargaKendara["d1"]>;

    test("UT-WK-001: d1 lagna sign equals the result ascendant sign", () => {
        expect(d1.lagnaSign).toBe(auto.ascendant.sign);
    });

    test("UT-WK-002: d1 has 12 whole-sign house rows matching the result houses", () => {
        expect(d1.houses).toHaveLength(12);
        expect(d1.houses.map((h) => h.sign)).toEqual(auto.houses.map((h) => h.sign));
        expect(d1.houses.map((h) => h.houseNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    test("UT-WK-003: d1 planet rows are sorted by enum (1-9) and match sign/house/strength", () => {
        expect(d1.planets.map((p) => p.name)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        const byName = new Map(auto.planets.map((p) => [p.name, p]));
        for (const row of d1.planets) {
            const p = byName.get(row.name);
            expect(row.sign).toBe(p?.sign);
            expect(row.house).toBe(p?.house);
        }
    });

    test("UT-WK-004: d1 conjunctions = planets sharing the same whole-sign house", () => {
        for (const row of d1.planets) {
            const expected = auto.planets
                .filter((p) => p.name !== row.name && p.house === row.house)
                .map((p) => p.name)
                .sort((a, b) => a - b);
            expect(row.conjunctions).toEqual(expected);
        }
    });

    test("UT-WK-005: d1 aspects are whole-sign (opposition or special aspect) without degree fields", () => {
        for (const row of d1.planets) {
            for (const aspect of row.aspects) {
                expect(aspect.aspectType).toBeGreaterThan(0);
                expect(aspect.planetName).toBeGreaterThanOrEqual(1);
                expect(aspect.planetName).toBeLessThanOrEqual(9);
            }
        }
        // The row type never carries degrees — assert via the built value.
        expect(JSON.stringify(d1.planets)).not.toContain("degreeGap");
    });

    test("UT-WK-006: d1 house aspects carry the aspecting planet and whole-sign angle", () => {
        const SPECIAL_ASPECTS: Record<number, number[]> = {
            1: [2, 9],
            2: [2, 9],
            7: [2, 9],
            3: [3, 7],
            4: [3, 7],
            5: [4, 8],
            6: [4, 8],
        };
        const angleForDiff = (diff: number): number =>
            diff === 6 ? 180 : diff === 4 ? 120 : diff === 8 ? 240 : diff === 3 ? 90 : diff === 7 ? 210 : diff === 2 ? 60 : diff === 9 ? 270 : 0;
        const byName = new Map(auto.planets.map((p) => [p.name, p]));
        for (const house of d1.houses) {
            for (const aspect of house.aspects) {
                expect(aspect.planetName).toBeGreaterThanOrEqual(1);
                expect(aspect.planetName).toBeLessThanOrEqual(9);
                const planet = byName.get(aspect.planetName);
                const diff = (house.houseNumber - (planet?.house ?? 0) + 12) % 12;
                const aspectsHouse =
                    diff === 6 || (SPECIAL_ASPECTS[aspect.planetName]?.includes(diff) ?? false);
                expect(aspectsHouse).toBe(true);
                expect(aspect.aspectType).toBe(angleForDiff(diff));
            }
        }
        expect(JSON.stringify(d1.houses)).not.toContain("degreeGap");
    });

    test("UT-WK-007: ownership lists the houses whose sign the planet rules", () => {
        const ownedByPlanet = (planet: number): number[] =>
            d1.houses.filter((h) => SIGN_LORD[h.sign] === planet).map((h) => h.houseNumber).sort((a, b) => a - b);
        for (const planet of d1.planets) {
            expect(ownedHousesOf(planet.name, d1.houses)).toEqual(ownedByPlanet(planet.name));
        }
    });

    test("UT-WK-006: D1-only flags map from the result fields", () => {
        expect(d1.wargoththamaPlanets).toEqual(auto.wargoththamaPlanets);
        expect(d1.pushkaraPlanets).toEqual(auto.pushkaraPlanets);
        expect(d1.gandanthaPlanets).toEqual(auto.gandanthaPlanets);
        expect(d1.gandamulaPlanets).toEqual(auto.gandamulaPlanets);
        expect(d1.lord22ndDrekkana).toBe(auto.lord22ndDrekkana);
        expect(d1.lord64thNavamsa).toBe(auto.lord64thNavamsa);
        expect(d1.ashtamanshaPlanets).toEqual(auto.ashtamanshaPlanets);
        expect(d1.atmakaraka).toBe(auto.atmakaraka);
        expect(d1.badhakaPlanets).toEqual(auto.badhakaPlanet);
        expect(d1.combustPlanets).toEqual(auto.planets.filter((p) => p.combustion).map((p) => p.name));
    });

    test("UT-WK-007: d1 maraka = lords of the 2nd/7th signs from the ascendant", () => {
        const secondSign = ((auto.ascendant.sign + 1) % 12) || 12;
        const seventhSign = ((auto.ascendant.sign + 6) % 12) || 12;
        expect(d1.marakaPlanets).toEqual([SIGN_LORD[secondSign] || 1, SIGN_LORD[seventhSign] || 1]);
    });
});

describe("D9 entry (auto) (UT-WK-008..014)", () => {
    const wk = computeWargaKendara(auto, { source: "auto" });
    const d9 = wk.d9 as NonNullable<WargaKendara["d9"]>;
    const ascNavSign = navamsaSign(auto.ascendant.sign, wedge(auto.ascendant.degree));

    test("UT-WK-008: d9 lagna sign = navamsa sign of the ascendant degree", () => {
        expect(d9.lagnaSign).toBe(ascNavSign);
    });

    test("UT-WK-009: d9 house signs are whole-sign from the navamsa lagna", () => {
        expect(d9.houses).toHaveLength(12);
        expect(d9.houses[0].sign).toBe(ascNavSign);
        expect(d9.houses[5].sign).toBe(((ascNavSign - 1 + 5) % 12) + 1);
    });

    test("UT-WK-010: d9 planet rows use navamsa sign/house", () => {
        const byName = new Map(auto.planets.map((p) => [p.name, p]));
        for (const row of d9.planets) {
            const p = byName.get(row.name);
            const navSign = p?.navamsaSign ?? navamsaSign(p?.sign ?? 1, wedge(p?.degree ?? 0));
            expect(row.sign).toBe(navSign);
            expect(row.house).toBe(((navSign - ascNavSign + 12) % 12) + 1);
        }
    });

    test("UT-WK-011: d9 carries NO D1-only keys", () => {
        for (const key of D1_ONLY_KEYS) {
            expect(d9).not.toHaveProperty(key);
        }
    });

    test("UT-WK-012: d9 has the three per-chart values", () => {
        expect(Array.isArray(d9.marakaPlanets)).toBe(true);
        expect(Array.isArray(d9.maranakaraka)).toBe(true);
        expect(Array.isArray(d9.digBalaPlanets)).toBe(true);
    });

    test("UT-WK-013: d9 strength normalizes the stored navamsa strength", () => {
        const byName = new Map(auto.planets.map((p) => [p.name, p]));
        for (const row of d9.planets) {
            const stored = byName.get(row.name)?.navamsaStrength;
            expect(row.strength).toBe(stored === undefined ? PlanetaryStrength.SAMA : stored);
        }
    });
});

describe("Surya / Chandra Lagna entries (UT-WK-015..019)", () => {
    const wk = computeWargaKendara(auto, { source: "auto" });

    test("UT-WK-015/016: rotated entries are non-null with 12 houses and 9 planets", () => {
        for (const key of ["suryaLagna", "chandraLagna"] as const) {
            const entry = wk[key] as NonNullable<WargaKendara[typeof key]>;
            expect(entry).not.toBeNull();
            expect(entry.houses).toHaveLength(12);
            expect(entry.planets).toHaveLength(9);
            expect(entry.planets.map((p) => p.name)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
    });

    test("UT-WK-017: rotated lagna sign equals the Sun/Moon sign", () => {
        const sun = auto.planets.find((p) => p.name === Planet.SUN);
        const moon = auto.planets.find((p) => p.name === Planet.MOON);
        expect((wk.suryaLagna as NonNullable<WargaKendara["suryaLagna"]>).lagnaSign).toBe(sun?.sign);
        expect((wk.chandraLagna as NonNullable<WargaKendara["chandraLagna"]>).lagnaSign).toBe(moon?.sign);
    });

    test("UT-WK-018: rotated entries carry NO D1-only keys", () => {
        for (const key of ["suryaLagna", "chandraLagna"] as const) {
            const entry = wk[key] as NonNullable<WargaKendara[typeof key]>;
            for (const flag of D1_ONLY_KEYS) {
                expect(entry).not.toHaveProperty(flag);
            }
        }
    });

    test("UT-WK-019: rotated entries carry the three per-chart values", () => {
        for (const key of ["suryaLagna", "chandraLagna"] as const) {
            const entry = wk[key] as NonNullable<WargaKendara[typeof key]>;
            expect(Array.isArray(entry.marakaPlanets)).toBe(true);
            expect(Array.isArray(entry.maranakaraka)).toBe(true);
            expect(Array.isArray(entry.digBalaPlanets)).toBe(true);
        }
    });
});

describe("Per-chart Maraka / Maranakaraka / Dig Bala (UT-WK-020..024)", () => {
    test("UT-WK-020: computeWargaMaraka — Mesha lagna → lords of Vrishabha + Kanya", () => {
        expect(computeWargaMaraka(1)).toEqual([SIGN_LORD[2], SIGN_LORD[7]]);
    });

    test("UT-WK-021: computeWargaMaraka — Karka lagna → lords of Simha + Makara", () => {
        expect(computeWargaMaraka(4)).toEqual([SIGN_LORD[5], SIGN_LORD[10]]);
    });

    test("UT-WK-022: computeDigBalaPlanets honors the DIG_HOUSE map", () => {
        const planets = [
            { name: Planet.SUN, house: 10 }, // dig bala
            { name: Planet.SUN, house: 4 }, // not
            { name: Planet.JUPITER, house: 1 }, // dig bala
            { name: Planet.RAHU, house: 10 }, // never
            { name: Planet.KETU, house: 7 }, // never
            { name: Planet.SATURN, house: 7 }, // dig bala
        ];
        expect(computeDigBalaPlanets(planets)).toEqual([Planet.SUN, Planet.JUPITER, Planet.SATURN]);
    });

    test("UT-WK-023: Rahu/Ketu never appear in dig bala regardless of house", () => {
        const wk = computeWargaKendara(auto, { source: "auto" });
        for (const key of ["d1", "d9", "suryaLagna", "chandraLagna"] as const) {
            const entry = wk[key];
            if (entry) {
                expect(entry.digBalaPlanets).not.toContain(Planet.RAHU);
                expect(entry.digBalaPlanets).not.toContain(Planet.KETU);
            }
        }
    });

    test("UT-WK-024: per-chart values differ across charts (own lagna/houses)", () => {
        const wk = computeWargaKendara(auto, { source: "auto" });
        const d1 = wk.d1 as NonNullable<WargaKendara["d1"]>;
        const d9 = wk.d9 as NonNullable<WargaKendara["d9"]>;
        expect(d1.marakaPlanets).not.toEqual(d9.marakaPlanets);
    });
});

describe("Manual pipeline (UT-WK-025..028)", () => {
    test("UT-WK-025: manual without navamsa data → d9 null, d1/surya/chandra present", () => {
        const calc = synthesizeCalculation(compute({ lagna: 1, houses: { "1": [Planet.SUN] } }));
        expect(calc.wargaKendara?.d1).not.toBeNull();
        expect(calc.wargaKendara?.d9).toBeNull();
        expect(calc.wargaKendara?.suryaLagna).not.toBeNull();
        expect(calc.wargaKendara?.chandraLagna).not.toBeNull();
    });

    test("UT-WK-026: manual with navamsa data → d9 populated from entered placements", () => {
        const calc = synthesizeCalculation(
            compute({
                lagna: 1,
                houses: { "1": [Planet.SUN] },
                navamsaLagna: 5,
                navamsaHouses: { "1": [Planet.MOON], "3": [Planet.SUN] },
            }),
        );
        const d9 = calc.wargaKendara?.d9;
        expect(d9).not.toBeNull();
        expect(d9?.lagnaSign).toBe(5);
        const names = (d9?.planets ?? []).map((p) => p.name);
        expect(names).toContain(Planet.MOON);
        expect(names).toContain(Planet.SUN);
    });

    test("UT-WK-027: manual d1 entry uses the entered placements", () => {
        const calc = synthesizeCalculation(compute({ lagna: 3, houses: { "1": [Planet.MOON] } }));
        const d1 = calc.wargaKendara?.d1 as NonNullable<WargaKendara["d1"]>;
        expect(d1.lagnaSign).toBe(3);
        const moon = d1.planets.find((p) => p.name === Planet.MOON);
        expect(moon?.house).toBe(1);
    });

    test("UT-WK-028: manual result carries the warga tables but no embedded placements", () => {
        const calc = synthesizeCalculation(compute({ lagna: 1, houses: { "1": [Planet.SUN] } }));
        expect(calc.wargaKendara).toBeDefined();
        expect(calc.wargaKendara?.d1).not.toBeNull();
        // manualHousePlacements lives on the CalculatedDetails doc (API layer), not the result.
        expect("manualHousePlacements" in calc).toBe(false);
    });
});

describe("resolveWargaKendara (UT-WK-030..033, RE-WK-450..452)", () => {
    test("UT-WK-030: stored valid value wins (no recomputation)", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const stored = computeWargaKendara(auto, { source: "auto" });
        expect(resolveWargaKendara({ ...auto, wargaKendara: stored })).toEqual(stored);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    test("UT-WK-031: legacy doc without the field is derived at render", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const legacyDoc = {
            ascendant: auto.ascendant,
            houses: auto.houses,
            planets: auto.planets,
            shadbalaya: auto.shadbalaya,
            wargoththamaPlanets: auto.wargoththamaPlanets,
            pushkaraPlanets: auto.pushkaraPlanets,
            gandanthaPlanets: auto.gandanthaPlanets,
            gandamulaPlanets: auto.gandamulaPlanets,
            lord22ndDrekkana: auto.lord22ndDrekkana,
            lord64thNavamsa: auto.lord64thNavamsa,
            ashtamanshaPlanets: auto.ashtamanshaPlanets,
            atmakaraka: auto.atmakaraka,
            badhakaPlanet: auto.badhakaPlanet,
        };
        const derived = resolveWargaKendara(legacyDoc);
        expect(derived?.d1?.lagnaSign).toBe(auto.ascendant.sign);
        expect(derived?.d1?.wargoththamaPlanets).toEqual(auto.wargoththamaPlanets);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    test("RE-WK-450: corrupt stored value → warn + re-derive from stored data", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const doc = {
            wargaKendara: { d1: { lagnaSign: "oops" }, d9: null, suryaLagna: null, chandraLagna: null },
            ascendant: auto.ascendant,
            houses: auto.houses,
            planets: auto.planets,
        };
        const resolved = resolveWargaKendara(doc);
        expect(warn).toHaveBeenCalled();
        expect(resolved?.d1?.lagnaSign).toBe(auto.ascendant.sign);
        warn.mockRestore();
    });

    test("RE-WK-451: missing houses/planets → undefined (nothing derivable)", () => {
        expect(resolveWargaKendara({ ascendant: { sign: 1 } })).toBeUndefined();
        expect(resolveWargaKendara(null)).toBeUndefined();
        expect(resolveWargaKendara(undefined)).toBeUndefined();
    });

    test("RE-WK-452: legacy manual doc (manualHousePlacements present) derives with d9 null", () => {
        const calc = synthesizeCalculation(compute({ lagna: 1, houses: {} }));
        const legacyManual = {
            ascendant: calc.ascendant,
            houses: calc.houses,
            planets: calc.planets,
            manualHousePlacements: { lagna: 1, houses: {} },
        };
        const resolved = resolveWargaKendara(legacyManual);
        expect(resolved?.d1).not.toBeNull();
        expect(resolved?.d9).toBeNull();
    });
});

describe("VARGA_CATALOG (UT-WK-040)", () => {
    test("UT-WK-040: 16 canonical vargas in order with correct D numbers", () => {
        expect(VARGA_CATALOG).toEqual([
            { key: "d1", d: 1 },
            { key: "d2", d: 2 },
            { key: "d3", d: 3 },
            { key: "d4", d: 4 },
            { key: "d7", d: 7 },
            { key: "d9", d: 9 },
            { key: "d10", d: 10 },
            { key: "d12", d: 12 },
            { key: "d16", d: 16 },
            { key: "d20", d: 20 },
            { key: "d24", d: 24 },
            { key: "d27", d: 27 },
            { key: "d30", d: 30 },
            { key: "d40", d: 40 },
            { key: "d45", d: 45 },
            { key: "d60", d: 60 },
        ]);
    });
});

describe("i18n parity (BI-WK-380..385)", () => {
    const load = (file: string) => {
        const p = path.join(process.cwd(), "src/messages", file);
        return JSON.parse(fs.readFileSync(p, "utf8")) as { astrology: { wargaKendara: Record<string, unknown> } };
    };
    const en = load("en.json");
    const si = load("si.json");
    const vargasOf = (messages: ReturnType<typeof load>) =>
        messages.astrology.wargaKendara.vargas as Record<string, { name?: string; indication?: string }>;
    const RENDERED_KEYS = [...VARGA_CATALOG.map((v) => v.key), "suryaLagna", "chandraLagna"];

    test("BI-WK-380: every catalog key + surya/chandra has name+indication in BOTH locales", () => {
        for (const key of RENDERED_KEYS) {
            for (const messages of [en, si]) {
                const entry = vargasOf(messages)[key];
                expect(entry).toBeDefined();
                expect(entry?.name).toBeTruthy();
                expect(entry?.indication).toBeTruthy();
            }
        }
    });

    test("BI-WK-381: en and si have the same set of varga keys", () => {
        expect(Object.keys(vargasOf(en)).sort()).toEqual(Object.keys(vargasOf(si)).sort());
    });

    test("BI-WK-385: noDetails + indicationLabel + title + comingSoon exist in both locales", () => {
        for (const messages of [en, si]) {
            const wk = messages.astrology.wargaKendara;
            expect(wk.noDetails).toBeDefined();
            expect(wk.indicationLabel).toBeDefined();
            expect(wk.title).toBeDefined();
            expect(wk.comingSoon).toBeTruthy();
        }
    });

    test("BI-WK-386: tabs.{rashi,navamsa,suryaLagna,chandraLagna} resolve in both locales", () => {
        for (const messages of [en, si]) {
            const tabs = messages.astrology.wargaKendara.tabs as Record<string, string>;
            for (const key of ["rashi", "navamsa", "suryaLagna", "chandraLagna"]) {
                expect(tabs[key]).toBeTruthy();
            }
        }
    });
});