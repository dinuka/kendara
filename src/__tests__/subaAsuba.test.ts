/**
 * Suba Asuba (සුබ / අසුබ — පාපී ග්‍රහයන්) — unit tests.
 * Source: docs/papi-grahayan.md.
 */
import { Planet } from "@/lib/astrologyEnums";
import { calculateHoroscope } from "@/lib/calculation";
import { compute } from "@/lib/manualChart";
import { synthesizeNavamsaCalculation } from "@/lib/manualChartDetails";
import {
    SubaAsuba,
    type SubaAsubaHouse,
    type SubaAsubaPlanet,
    computeSubaAsuba,
    resolveSubaAsuba,
} from "@/lib/subaAsuba";

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

const ninePlanets = (houses: Partial<Record<number, number>> = {}): SubaAsubaPlanet[] =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((name) => ({ name, house: houses[name] ?? 12 }));

/** Default D1 house list: every house lorded by Sun (a malefic) so no suba planet owns a Kendra
 *  house unless a test explicitly reassigns one. */
const defaultHouses = (): SubaAsubaHouse[] =>
    Array.from({ length: 12 }, (_, i) => ({ houseNumber: i + 1, lord: Planet.SUN }));

const withLord = (houses: SubaAsubaHouse[], houseNumber: number, lord: number): SubaAsubaHouse[] =>
    houses.map((h) => (h.houseNumber === houseNumber ? { ...h, lord } : h));

const entryOf = (result: ReturnType<typeof computeSubaAsuba>, planet: number) => result[String(planet)];

describe("Natural classifications (UT-SA-001..012)", () => {
    test("UT-SA-001: Jupiter (Guru) is suba by nature", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.JUPITER]: 5 }), defaultHouses(), 10);
        const entry = entryOf(result, Planet.JUPITER);
        expect(entry.value).toBe(SubaAsuba.SUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.naturalBenefic",
            params: { planet: Planet.JUPITER },
        });
    });

    test("UT-SA-002: Venus (Shukra) is suba by nature", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.VENUS]: 2 }), defaultHouses(), 10);
        expect(entryOf(result, Planet.VENUS).value).toBe(SubaAsuba.SUBA);
    });

    test("UT-SA-003: Sun (Ravi) is asuba by nature", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.SUN]: 1 }), defaultHouses(), 10);
        const entry = entryOf(result, Planet.SUN);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.naturalMalefic",
            params: { planet: Planet.SUN },
        });
    });

    test("UT-SA-004: Mars (Kuja) is asuba by nature", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.MARS]: 6 }), defaultHouses(), 10);
        expect(entryOf(result, Planet.MARS).value).toBe(SubaAsuba.ASUBA);
    });

    test("UT-SA-005: Saturn (Shani) is asuba by nature", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.SATURN]: 12 }), defaultHouses(), 10);
        expect(entryOf(result, Planet.SATURN).value).toBe(SubaAsuba.ASUBA);
    });

    test("UT-SA-006: Rahu and Ketu are asuba by nature", () => {
        const result = computeSubaAsuba(ninePlanets(), defaultHouses(), 10);
        expect(entryOf(result, Planet.RAHU).value).toBe(SubaAsuba.ASUBA);
        expect(entryOf(result, Planet.KETU).value).toBe(SubaAsuba.ASUBA);
    });
});

describe("Moon by paksha (UT-SA-013..020)", () => {
    const waxingCases: Array<[thithi: number, expected: SubaAsuba]> = [
        [1, SubaAsuba.SUBA],
        [7, SubaAsuba.SUBA],
        [15, SubaAsuba.SUBA],
    ];
    const waningCases: Array<[thithi: number, expected: SubaAsuba]> = [
        [16, SubaAsuba.ASUBA],
        [22, SubaAsuba.ASUBA],
        [30, SubaAsuba.ASUBA],
    ];

    test.each(waxingCases)("UT-SA-013: thithi %i (Shukla Paksha) → suba", (thithi, expected) => {
        const result = computeSubaAsuba(ninePlanets(), defaultHouses(), thithi);
        const entry = entryOf(result, Planet.MOON);
        expect(entry.value).toBe(expected);
        expect(entry.reasons[0].key).toBe("papiGrahayan.reason.moonWaxing");
        expect(entry.reasons[0].params).toEqual({ thithi });
    });

    test.each(waningCases)("UT-SA-014: thithi %i (Krishna Paksha) → asuba", (thithi, expected) => {
        const result = computeSubaAsuba(ninePlanets(), defaultHouses(), thithi);
        const entry = entryOf(result, Planet.MOON);
        expect(entry.value).toBe(expected);
        expect(entry.reasons[0].key).toBe("papiGrahayan.reason.moonWaning");
        expect(entry.reasons[0].params).toEqual({ thithi });
    });
});

describe("Mercury (Budha) by association (UT-SA-021..028)", () => {
    const planetsDifferentHouses: SubaAsubaPlanet[] = [
        { name: Planet.MERCURY, house: 5 },
        { name: Planet.MARS, house: 11 },
    ];

    test("UT-SA-021: Budha alone in a house → suba", () => {
        const result = computeSubaAsuba([{ name: Planet.MERCURY, house: 2 }], defaultHouses(), 10);
        const entry = entryOf(result, Planet.MERCURY);
        expect(entry.value).toBe(SubaAsuba.SUBA);
        expect(entry.reasons).toContainEqual({ key: "papiGrahayan.reason.budhaAlone" });
    });

    test("UT-SA-022: Budha with a benefic (Jupiter) → suba", () => {
        const result = computeSubaAsuba(
            [
                { name: Planet.MERCURY, house: 5 },
                { name: Planet.JUPITER, house: 5 },
            ],
            defaultHouses(),
            10,
        );
        const entry = entryOf(result, Planet.MERCURY);
        expect(entry.value).toBe(SubaAsuba.SUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.budhaWithBenefic",
            params: { planets: String(Planet.JUPITER) },
        });
    });

    test("UT-SA-023: Budha with a malefic (Sun) → asuba", () => {
        const result = computeSubaAsuba(
            [
                { name: Planet.MERCURY, house: 1 },
                { name: Planet.SUN, house: 1 },
            ],
            defaultHouses(),
            10,
        );
        const entry = entryOf(result, Planet.MERCURY);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.budhaWithMalefic",
            params: { planets: String(Planet.SUN) },
        });
    });

    test("UT-SA-024: Budha with Rahu → asuba (Rahu is malefic)", () => {
        const result = computeSubaAsuba(
            [
                { name: Planet.MERCURY, house: 8 },
                { name: Planet.RAHU, house: 8 },
            ],
            defaultHouses(),
            10,
        );
        expect(entryOf(result, Planet.MERCURY).value).toBe(SubaAsuba.ASUBA);
    });

    test("UT-SA-025: Budha with both a benefic and a malefic → asuba (malefic wins)", () => {
        const result = computeSubaAsuba(
            [
                { name: Planet.MERCURY, house: 9 },
                { name: Planet.SUN, house: 9 },
                { name: Planet.JUPITER, house: 9 },
            ],
            defaultHouses(),
            10,
        );
        const entry = entryOf(result, Planet.MERCURY);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons).toContainEqual(
            expect.objectContaining({
                key: "papiGrahayan.reason.budhaWithMalefic",
                params: { planets: String(Planet.SUN) },
            }),
        );
    });

    test("UT-SA-026: a companion in another house does not count as association", () => {
        const result = computeSubaAsuba(planetsDifferentHouses, defaultHouses(), 10);

        const entry = entryOf(result, Planet.MERCURY);
        expect(entry.value).toBe(SubaAsuba.SUBA);
        expect(entry.reasons).toContainEqual({ key: "papiGrahayan.reason.budhaAlone" });
    });
});

describe("Kendra lordship exception (UT-SA-027..032)", () => {
    test("UT-SA-027: Jupiter owning house 4 → asuba, kendra reason appended", () => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.JUPITER]: 5 }),
            withLord(defaultHouses(), 4, Planet.JUPITER),
            10,
        );
        const entry = entryOf(result, Planet.JUPITER);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.naturalBenefic",
            params: { planet: Planet.JUPITER },
        });
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.kendra",
            params: { planet: Planet.JUPITER, houses: "4" },
        });
    });

    test("UT-SA-028: Venus owning house 7 → asuba", () => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.VENUS]: 2 }),
            withLord(defaultHouses(), 7, Planet.VENUS),
            10,
        );
        expect(entryOf(result, Planet.VENUS).value).toBe(SubaAsuba.ASUBA);
    });

    test.each([1, 10])("UT-SA-029: Jupiter owning Kendra house %i → asuba", (house) => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.JUPITER]: house }),
            withLord(defaultHouses(), house, Planet.JUPITER),
            10,
        );
        expect(entryOf(result, Planet.JUPITER).value).toBe(SubaAsuba.ASUBA);
    });

    test("UT-SA-030: Venus owning house 6 (non-Kendra) stays suba", () => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.VENUS]: 6 }),
            withLord(defaultHouses(), 6, Planet.VENUS),
            10,
        );
        expect(entryOf(result, Planet.VENUS).value).toBe(SubaAsuba.SUBA);
    });

    test("UT-SA-031: Moon (suba by waxing) owning house 1 → asuba", () => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.MOON]: 1 }),
            withLord(defaultHouses(), 1, Planet.MOON),
            5,
        );
        expect(entryOf(result, Planet.MOON).value).toBe(SubaAsuba.ASUBA);
    });

    test("UT-SA-032: an already-asuba planet owning a Kendra house is not double-tagged", () => {
        const result = computeSubaAsuba(
            ninePlanets({ [Planet.MARS]: 1 }),
            withLord(defaultHouses(), 1, Planet.MARS),
            10,
        );
        const entry = entryOf(result, Planet.MARS);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons.some((r) => r.key === "papiGrahayan.reason.kendra")).toBe(false);
    });

    test("UT-SA-032b: a suba planet owning two Kendra houses lists both (houses '1,4')", () => {
        const houses = withLord(withLord(defaultHouses(), 1, Planet.JUPITER), 4, Planet.JUPITER);
        const result = computeSubaAsuba(ninePlanets({ [Planet.JUPITER]: 5 }), houses, 10);
        const entry = entryOf(result, Planet.JUPITER);
        expect(entry.value).toBe(SubaAsuba.ASUBA);
        expect(entry.reasons).toContainEqual({
            key: "papiGrahayan.reason.kendra",
            params: { planet: Planet.JUPITER, houses: "1,4" },
        });
    });
});

describe("Calculation pipeline integration (UT-SA-033..036)", () => {
    const auto = calculateHoroscope(baseData);

    test("UT-SA-033: auto calculateHoroscope enriches the result with all 9 planets", () => {
        expect(auto.subaAsuba).toBeDefined();
        for (const p of auto.planets) {
            const entry = auto.subaAsuba?.[String(p.name)];
            expect(entry).toBeDefined();
            expect([SubaAsuba.SUBA, SubaAsuba.ASUBA]).toContain(entry?.value);
        }
    });

    test("UT-SA-034: render-time fallback equals the stored value for the same doc (incl. Houses)", () => {
        const legacyDoc = { planets: auto.planets, houses: auto.houses, thithi: auto.thithi };
        expect(resolveSubaAsuba(legacyDoc)).toEqual(auto.subaAsuba);
    });

    test("UT-SA-035: stored record wins over recomputation", () => {
        const stored = { [String(Planet.JUPITER)]: { value: SubaAsuba.SUBA, reasons: [] } };
        const doc = { subaAsuba: stored, planets: auto.planets, thithi: auto.thithi };
        expect(resolveSubaAsuba(doc)).toEqual(stored);
    });

    test("UT-SA-036: D9 result is NOT enriched with subaAsuba (D1-chart-only concept)", () => {
        const chart = compute({
            lagna: 1,
            houses: { "1": [Planet.SUN] },
            navamsaLagna: 5,
            navamsaHouses: { "1": [Planet.SUN] },
        });
        const d9 = synthesizeNavamsaCalculation(chart);
        expect(d9).not.toBeNull();
        expect((d9 as NonNullable<typeof d9>).subaAsuba).toBeUndefined();
    });
});

describe("resolveSubaAsuba robustness (UT-SA-037..043)", () => {
    test("UT-SA-037: null/undefined doc → undefined", () => {
        expect(resolveSubaAsuba(null)).toBeUndefined();
        expect(resolveSubaAsuba(undefined)).toBeUndefined();
    });

    test("UT-SA-038: corrupt stored record → undefined (never guessed)", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        expect(resolveSubaAsuba({ subaAsuba: "junk", planets: ninePlanets(), thithi: 10 })).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    test("UT-SA-039: invalid stored entries are dropped, valid ones win", () => {
        const result = resolveSubaAsuba({
            subaAsuba: {
                "5": {
                    value: SubaAsuba.SUBA,
                    reasons: [{ key: "papiGrahayan.reason.naturalBenefic", params: { planet: 5 } }],
                },
                "99": { value: SubaAsuba.SUBA, reasons: [] },
            },
            planets: ninePlanets({ [Planet.JUPITER]: 4 }),
            thithi: 10,
        });
        expect(result?.[String(Planet.JUPITER)]).toBeDefined();
        expect(result?.["99"]).toBeUndefined();
    });

    test("UT-SA-040: no stored thithi → recomputed from stored Sun/Moon degrees", () => {
        const doc = {
            planets: [
                { name: Planet.SUN, absoluteDegree: 0, house: 1 },
                { name: Planet.MOON, absoluteDegree: 40, house: 8 },
                { name: Planet.MARS, absoluteDegree: 200, house: 11 },
            ],
        };
        const result = resolveSubaAsuba(doc);
        expect(result?.[String(Planet.MOON)]?.value).toBe(SubaAsuba.SUBA);
    });

    test("UT-SA-041: a suba planet owning no Kendra house keeps its single natural reason", () => {
        const result = computeSubaAsuba(ninePlanets({ [Planet.VENUS]: 5 }), defaultHouses(), 10);
        const entry = entryOf(result, Planet.VENUS);
        expect(entry.value).toBe(SubaAsuba.SUBA);
        expect(entry.reasons).toHaveLength(1);
    });

    test("UT-SA-042: legacy fallback applies the Kendra lordship exception from stored Houses", () => {
        // Sagittarius Lagna → Jupiter owns house 1 (Sagittarius) and house 4 (Pisces).
        const houses = defaultHouses().map((h) =>
            h.houseNumber === 1
                ? { ...h, lord: Planet.JUPITER }
                : h.houseNumber === 4
                  ? { ...h, lord: Planet.JUPITER }
                  : h,
        );
        const doc = { planets: ninePlanets({ [Planet.JUPITER]: 5 }), houses, thithi: 10 };
        const result = resolveSubaAsuba(doc);
        expect(result?.[String(Planet.JUPITER)]?.value).toBe(SubaAsuba.ASUBA);
        expect(result?.[String(Planet.JUPITER)]?.reasons).toContainEqual({
            key: "papiGrahayan.reason.kendra",
            params: { planet: Planet.JUPITER, houses: "1,4" },
        });
    });

    test("UT-SA-043: legacy fallback derives lordship from the ascendant sign when Houses are absent", () => {
        // Sagittarius Lagna (ascendant.sign 9) → Jupiter owns Kendra houses 1 and 4.
        const doc = { planets: ninePlanets({ [Planet.JUPITER]: 5 }), thithi: 10, ascendant: { sign: 9 } };
        const result = resolveSubaAsuba(doc);
        expect(result?.[String(Planet.JUPITER)]?.value).toBe(SubaAsuba.ASUBA);
        expect(result?.[String(Planet.JUPITER)]?.reasons).toContainEqual({
            key: "papiGrahayan.reason.kendra",
            params: { planet: Planet.JUPITER, houses: "1,4" },
        });
    });
});
