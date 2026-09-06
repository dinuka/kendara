/**
 * Student Notepad — observation derivation unit tests.
 * QA plan: specs/qa/20260816-1823-student-notes-test-plan.md (UT-SN-100..117).
 */
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import {
    classifyHouseLordPosition,
    classifyPlanetStrength,
    observationTagId,
    resolveNotepadObservation,
} from "@/lib/notepadObservations";
import type {
    CalculatedDetailsLike,
    ObservationSection,
    ObservationTagBase,
    PlanetLike,
} from "@/lib/notepadObservations";
import type { WargaChartEntry, WargaKendara } from "@/lib/wargaKendara";

const U = PlanetaryStrength;

const planet = (name: number, house: number, o: Partial<PlanetLike> = {}): PlanetLike => ({
    name,
    house,
    sign: 1,
    degree: 0,
    absoluteDegree: 0,
    strength: U.SAMA,
    ...o,
});

const houses12 = (): Array<{ houseNumber: number; sign: number }> =>
    Array.from({ length: 12 }, (_, i) => ({ houseNumber: i + 1, sign: i + 1 }));

const chartEntry = (o: Partial<WargaChartEntry> = {}): WargaChartEntry => ({
    lagnaSign: 1,
    houses: Array.from({ length: 12 }, (_, i) => ({
        houseNumber: i + 1,
        sign: i + 1,
        planets: [] as number[],
        aspects: [],
    })),
    planets: [],
    marakaPlanets: [],
    maranakaraka: [],
    digBalaPlanets: [],
    ...o,
});

/** Full auto-computed fixture: wargaKendara present and authoritative. House 7 has Mars + Venus
 *  per the d1 whole-sign houses, while Moon/Mercury/Rahu claim stored house 7 — the d1 source must
 *  win (UT-SN-102). Moon's nakshatra is Chitra (14). */
const autoWarga: CalculatedDetailsLike = {
    ascendant: { sign: 1, degree: 0, lord: 3 },
    houses: houses12(),
    planets: [
        planet(1, 5, { sign: 5, strength: U.UCHCHA, nakshatra: 10, pada: 2 }),
        planet(2, 7, { sign: 7, strength: U.SAMA, nakshatra: 14, pada: 1 }),
        planet(3, 7, { sign: 7, strength: U.UCHCHA, nakshatra: 14, pada: 1 }),
        planet(4, 7, { sign: 7, strength: U.NEECHA, nakshatra: 14 }),
        planet(5, 9, { sign: 9, strength: U.SAMA }),
        planet(6, 7, { sign: 7, strength: U.MITRA }),
        planet(7, 3, { sign: 3, strength: U.SAMA }),
        planet(8, 7, { sign: 7, strength: U.SAMA }),
        planet(9, 1, { sign: 1, strength: U.SAMA }),
    ],
    nakshatra: { moonNakshatra: { id: 14, pada: 1 } },
    wargaKendara: {
        d1: chartEntry({
            lagnaSign: 1,
            houses: Array.from({ length: 12 }, (_, i) => ({
                houseNumber: i + 1,
                sign: i + 1,
                planets: i === 6 ? [3, 6] : [],
                aspects: [],
            })),
        }),
        d9: chartEntry({
            lagnaSign: 6,
            houses: Array.from({ length: 12 }, (_, i) => ({
                houseNumber: i + 1,
                sign: i + 1,
                planets: i === 6 ? [3] : [],
                aspects: [],
            })),
            planets: [{ name: 3, sign: 10, house: 7, strength: U.OWN_SIGN, conjunctions: [], aspects: [] }],
        }),
        suryaLagna: chartEntry({
            lagnaSign: 1,
            houses: Array.from({ length: 12 }, (_, i) => ({
                houseNumber: i + 1,
                sign: i + 1,
                planets: i === 6 ? [5] : [],
                aspects: [],
            })),
            planets: [{ name: 5, sign: 1, house: 7, strength: U.SAMA, conjunctions: [], aspects: [] }],
        }),
        chandraLagna: chartEntry({
            lagnaSign: 1,
            houses: Array.from({ length: 12 }, (_, i) => ({
                houseNumber: i + 1,
                sign: i + 1,
                planets: i === 6 ? [2] : [],
                aspects: [],
            })),
            planets: [{ name: 2, sign: 1, house: 7, strength: U.SAMA, conjunctions: [], aspects: [] }],
        }),
    } as WargaKendara,
};

/** Legacy snapshot with no wargaKendara and no derivable chart data (no ascendant/houses): the
 *  warga-backed sections degrade; house sections fall back to `planets[].house` (UT-SN-101/109b/111). */
const legacyNoWarga: CalculatedDetailsLike = {
    planets: [
        planet(1, 7, { sign: 5, strength: U.UCHCHA, nakshatra: 14, pada: 1 }),
        planet(2, 7, { sign: 7, strength: U.SAMA, nakshatra: 14, pada: 2 }),
        planet(3, 7, { sign: 7, strength: U.NEECHA }),
    ],
    nakshatra: { moonNakshatra: { id: 14, pada: 2 } },
};

/** Manual horoscope without warga data — same fallback shape as legacy, flagged manual. */
const manualNoWarga: CalculatedDetailsLike = {
    ...legacyNoWarga,
    manualHousePlacements: { navamsaLagna: undefined },
};

/** Stored warga valid at the top level but holey inside: `d9.houses[6]` lacks `planets` and the
 *  Mars row is missing from `d9.planets` — sub-parts degrade individually (UT-SN-112b). */
const corruptPartial: CalculatedDetailsLike = {
    ascendant: { sign: 1, degree: 0, lord: 3 },
    houses: houses12(),
    planets: [
        planet(1, 7, { sign: 5, strength: U.UCHCHA }),
        planet(3, 7, { sign: 7, strength: U.SAMA }),
        planet(6, 7, { sign: 7, strength: U.SAMA }),
    ],
    nakshatra: { moonNakshatra: { id: 14, pada: 1 } },
    wargaKendara: {
        d1: chartEntry(),
        d9: chartEntry({
            lagnaSign: 6,
            houses: Array.from({ length: 12 }, (_, i) => ({
                houseNumber: i + 1,
                sign: i + 1,
                // house 7 (index 6) deliberately missing the planets array — corrupt
                ...(i === 6 ? {} : { planets: [] as number[] }),
                aspects: [],
            })) as WargaChartEntry["houses"],
        }),
        suryaLagna: chartEntry(),
        chandraLagna: chartEntry(),
    } as WargaKendara,
};

const sectionOf = (sections: ObservationSection[], key: string): ObservationSection =>
    sections.find((s) => s.key === key) as ObservationSection;

describe("Planets in house (UT-SN-100..102, UT-SN-113b)", () => {
    test("UT-SN-100: autoWarga, parent 7 — d1 whole-sign planets, full tag shape", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "planetsInHouse");
        expect(section.tags).toHaveLength(2);
        expect(section.tags.map((t) => t.planet)).toEqual([3, 6]);
        for (const tag of section.tags) {
            expect(tag.kind).toBe("planet");
            expect(typeof tag.planet).toBe("number");
            expect(typeof tag.sign).toBe("number");
            expect(tag.house).toBe(7);
            expect(typeof tag.strength).toBe("number");
        }
        // Mars UCHCHA (green) + Venus MITRA (green)
        expect(section.tags.map((t) => t.color)).toEqual(["green", "green"]);
        expect(section.ratio).toEqual({ green: 2, total: 2 });
    });

    test("UT-SN-102: d1 whole-sign wins over stored planets[].house — never a mix", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        // Moon(2), Mercury(4), Rahu(8) claim stored house 7 but d1 puts them elsewhere — excluded.
        const planets = sectionOf(sections, "planetsInHouse").tags.map((t) => t.planet);
        expect(planets).toEqual([3, 6]);
    });

    test("UT-SN-101: legacy fallback — planets[].house when warga is undefinable", () => {
        const { sections } = resolveNotepadObservation(legacyNoWarga, 7, null);
        const section = sectionOf(sections, "planetsInHouse");
        expect(section.tags.map((t) => t.planet)).toEqual([1, 2, 3]);
        expect(section.tags.map((t) => t.color)).toEqual(["green", "white", "red"]);
        expect(section.ratio).toEqual({ green: 1, total: 3 });
    });

    test("UT-SN-113b: manual horoscope without warga — same fallback, no crash", () => {
        const { sections } = resolveNotepadObservation(manualNoWarga, 7, null);
        expect(sectionOf(sections, "planetsInHouse").tags).toHaveLength(3);
    });
});

describe("House lord & position (UT-SN-103/104)", () => {
    test("UT-SN-103: Aries lagna, house 7 (Libra) — lord Venus placed in its own house → position 1, dark green", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "houseLord");
        const primary = section.tags[0];
        expect(primary.kind).toBe("lord");
        expect(primary.planet).toBe(6);
        expect(primary.position).toBe(1);
        expect(primary.color).toBe("darkGreen");
        expect(primary.house).toBe(7);
        // Ratio counts the primary tag (dark green → good).
        expect(section.ratio).toEqual({ green: 1, total: 1 });
    });

    test("UT-SN-103b: the user example — Makara lagna, 7th house (Cancer, lord Moon) with Moon in the 8th → 'Moon - 2', light green + Ashtamamsha", () => {
        const makaraLagna: CalculatedDetailsLike = {
            ascendant: { sign: 10, degree: 0, lord: 7 },
            houses: houses12(),
            planets: [
                planet(2, 8, { sign: 5, strength: U.SAMA, nakshatra: 14, pada: 1 }),
                planet(3, 1, { sign: 10, strength: U.SAMA }),
                planet(5, 5, { sign: 3, strength: U.SAMA }),
            ],
            nakshatra: { moonNakshatra: { id: 14, pada: 1 } },
        };
        const { sections } = resolveNotepadObservation(makaraLagna, 7, null);
        const section = sectionOf(sections, "houseLord");
        const primary = section.tags[0];
        expect(primary.planet).toBe(2);
        expect(primary.position).toBe(2);
        expect(primary.color).toBe("lightGreen");
        expect(section.ratio).toEqual({ green: 1, total: 1 });

        const details = section.tags.map((t) => t.detail);
        // Moon owns only the 7th house → no ownsHouses tag; sign/nakshatra/strength + Ashtamamsha.
        expect(details).not.toContain("ownsHouses");
        expect(details).toContain("inSign");
        expect(details).toContain("inNakshatra");
        expect(details).toContain("strength");
        expect(details).toContain("ashtamamsha");
    });

    test("UT-SN-103c: every house has a lord — an otherwise empty house still emits the lord tag", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 1, null);
        const section = sectionOf(sections, "houseLord");
        expect(section.tags.length).toBeGreaterThan(0);
        const primary = section.tags[0];
        expect(primary.kind).toBe("lord");
        // House 1 (Aries, lord Mars) with Mars placed in the 7th → position 7, light green.
        expect(primary.planet).toBe(3);
        expect(primary.position).toBe(7);
        expect(primary.color).toBe("lightGreen");
        expect(section.ratio).toEqual({ green: 1, total: 1 });
    });

    test("UT-SN-104: red position (6/8/12) → primary red and ratio 0/1", () => {
        const redLagna: CalculatedDetailsLike = {
            ascendant: { sign: 1, degree: 0, lord: 3 },
            houses: houses12(),
            planets: [planet(3, 6, { sign: 6, strength: U.UCHCHA })],
        };
        const { sections } = resolveNotepadObservation(redLagna, 1, null);
        const section = sectionOf(sections, "houseLord");
        expect(section.tags[0].color).toBe("red");
        expect(section.ratio).toEqual({ green: 0, total: 1 });
    });

    test("UT-SN-104b: degradation — no ascendant/houses → single not-available tag, ratio 0/1", () => {
        const { sections } = resolveNotepadObservation(legacyNoWarga, 7, null);
        const section = sectionOf(sections, "houseLord");
        expect(section.tags).toHaveLength(1);
        expect(section.tags[0].labelKey).toBe("notepad.observation.notAvailable");
        expect(section.ratio).toEqual({ green: 0, total: 1 });
    });
});

describe("House-lord position colours (UT-SN-107/108 extension)", () => {
    test("1/5/9 → darkGreen, 6/8/12 → red, others → lightGreen", () => {
        expect(classifyHouseLordPosition(1)).toBe("darkGreen");
        expect(classifyHouseLordPosition(5)).toBe("darkGreen");
        expect(classifyHouseLordPosition(9)).toBe("darkGreen");
        expect(classifyHouseLordPosition(6)).toBe("red");
        expect(classifyHouseLordPosition(8)).toBe("red");
        expect(classifyHouseLordPosition(12)).toBe("red");
        for (const position of [2, 3, 4, 7, 10, 11]) {
            expect(classifyHouseLordPosition(position)).toBe("lightGreen");
        }
    });
});

describe("House-lord related tags (planet-table conditions)", () => {
    const lordRich: CalculatedDetailsLike = {
        ascendant: { sign: 1, degree: 0, lord: 3 },
        houses: houses12(),
        planets: [
            planet(3, 5, {
                sign: 5,
                strength: U.OWN_SIGN,
                retrograde: true,
                navamsaSign: 9,
                aspects: [{ planetName: 5, isBeneficial: true }],
            }),
            planet(5, 9, {
                sign: 9,
                strength: U.UCHCHA,
                aspects: [{ planetName: 3, isBeneficial: false }],
            }),
            planet(6, 5, { sign: 5, strength: U.SAMA }),
        ],
        bhavaSuchika: { "3": 5 },
        shadbalaya: { "3": { kalaBala: { value: true } } },
        ashtamanshaPlanets: [3],
        maranakaraka: [3],
        yogakaraka: [3],
        atmakaraka: 3,
        marakaPlanets: [3],
        badhakaPlanet: [3],
        nidhanamshaPlanets: [3],
        wargoththamaPlanets: [3],
        gandanthaPlanets: [3],
        gandamulaPlanets: [3],
        pushkaraPlanets: [3],
        lord22ndDrekkana: 3,
        lord64thNavamsa: 3,
        // Explicit warga: the whole-sign D1 chart is authoritative for conjunctions/aspects. The d1
        // rows deliberately DIFFER from the stored degree-based `aspects` above — stored says Mars
        // aspects Venus beneficially; the d1 says Mars aspects Venus at 120° (green) and Venus
        // aspects Mars at 90° (red). The d1 must win.
        wargaKendara: {
            d1: chartEntry({
                lagnaSign: 1,
                houses: Array.from({ length: 12 }, (_, i) => ({
                    houseNumber: i + 1,
                    sign: i + 1,
                    planets: i === 4 ? [3, 6] : i === 8 ? [5] : ([] as number[]),
                    aspects: [],
                })),
                planets: [
                    {
                        name: 3,
                        sign: 5,
                        house: 5,
                        strength: U.OWN_SIGN,
                        conjunctions: [6],
                        aspects: [{ planetName: 5, aspectType: 120 }],
                    },
                    {
                        name: 5,
                        sign: 9,
                        house: 9,
                        strength: U.UCHCHA,
                        conjunctions: [],
                        aspects: [{ planetName: 3, aspectType: 90 }],
                    },
                    { name: 6, sign: 5, house: 5, strength: U.SAMA, conjunctions: [3], aspects: [] },
                ],
            }),
            d9: chartEntry(),
            suryaLagna: chartEntry(),
            chandraLagna: chartEntry(),
        } as WargaKendara,
    };

    test("every planet-table condition surfaces as a related tag", () => {
        const { sections } = resolveNotepadObservation(lordRich, 1, null);
        const section = sectionOf(sections, "houseLord");
        // Primary: Mars (house 1 lord) placed in house 5 → position 5, dark green.
        expect(section.tags[0]).toMatchObject({ kind: "lord", planet: 3, position: 5, color: "darkGreen" });

        const details = section.tags.map((t) => t.detail);
        expect(details).toContain("ownsHouses"); // Mars rules Aries(1) + Scorpio(8)
        const owns = section.tags.find((t) => t.detail === "ownsHouses");
        expect(owns?.houses).toEqual([1, 8]);
        expect(details).toContain("inSign");
        expect(details).toContain("strength");
        expect(details).toContain("navamsa");
        expect(details).toContain("retrograde");
        expect(details).toContain("conjuncts");
        expect(details).toContain("aspectsMade");
        expect(details).toContain("aspectsReceived");
        expect(details).toContain("ashtamansha");
        expect(details).toContain("kalaBala");
        expect(details).toContain("bhavaSuchika");
        expect(details).toContain("maranakaraka");
        expect(details).toContain("yogakaraka");
        expect(details).toContain("atmakaraka");
        expect(details).toContain("maraka");
        expect(details).toContain("badhaka");
        expect(details).toContain("nidhanamsha");
        expect(details).toContain("wargoththama");
        expect(details).toContain("gandantha");
        expect(details).toContain("gandamula");
        expect(details).toContain("pushkara");
        expect(details).toContain("drekkanaLord");
        expect(details).toContain("navamsaLord");
        expect(details).not.toContain("combust");
        expect(details).not.toContain("ashtamamsha");
        expect(details).not.toContain("cheshtaBala");
    });

    test("related-tag colours: strength/aspects/kala-bala/benefic-malefic flags follow polarity", () => {
        const { sections } = resolveNotepadObservation(lordRich, 1, null);
        const section = sectionOf(sections, "houseLord");
        const byDetail = (detail: string) => section.tags.find((t) => t.detail === detail);

        expect(byDetail("strength")?.color).toBe("green"); // OWN_SIGN
        expect(byDetail("aspectsMade")?.color).toBe("green"); // isBeneficial true
        expect(byDetail("aspectsReceived")?.color).toBe("red"); // isBeneficial false
        expect(byDetail("kalaBala")?.color).toBe("green"); // value true
        expect(byDetail("maranakaraka")?.color).toBe("red");
        expect(byDetail("maraka")?.color).toBe("red");
        expect(byDetail("badhaka")?.color).toBe("red");
        expect(byDetail("nidhanamsha")?.color).toBe("red");
        expect(byDetail("gandantha")?.color).toBe("red");
        expect(byDetail("gandamula")?.color).toBe("red");
        expect(byDetail("ashtamansha")?.color).toBe("red");
        expect(byDetail("atmakaraka")?.color).toBe("green");
        expect(byDetail("yogakaraka")?.color).toBe("green");
        expect(byDetail("wargoththama")?.color).toBe("green");
        expect(byDetail("pushkara")?.color).toBe("green");
        // Informational tags stay neutral white.
        for (const detail of ["inSign", "navamsa", "retrograde", "bhavaSuchika", "ownsHouses", "drekkanaLord"]) {
            expect(byDetail(detail)?.color).toBe("white");
        }
    });

    test("regression: whole-sign D1 aspects win over stored degree-based aspects — no phantom Rahu/Ketu", () => {
        // The user's report: stored degree-based `planets[].aspects` claimed the Moon aspects Rahu
        // and Ketu, but the D1 chart shows only a Venus aspect. The D1 whole-sign model must win.
        const makaraHouses = Array.from({ length: 12 }, (_, i) => ({
            houseNumber: i + 1,
            sign: ((10 - 1 + i) % 12) + 1,
        }));
        const storedMoonAspects: PlanetLike["aspects"] = [
            { planetName: 8, isBeneficial: false },
            { planetName: 9, isBeneficial: false },
        ];
        const withStaleDegreeAspects: CalculatedDetailsLike = {
            ascendant: { sign: 10, degree: 0, lord: 7 },
            houses: makaraHouses,
            planets: [
                planet(2, 8, {
                    sign: 5,
                    strength: U.SAMA,
                    aspects: storedMoonAspects,
                }),
                planet(6, 10, { sign: 2, strength: U.SAMA }),
            ],
            wargaKendara: {
                d1: chartEntry({
                    lagnaSign: 10,
                    houses: makaraHouses.map((h) => ({
                        ...h,
                        planets: h.houseNumber === 8 ? [2] : h.houseNumber === 10 ? [6] : ([] as number[]),
                        aspects: [],
                    })),
                    planets: [
                        { name: 2, sign: 5, house: 8, strength: U.SAMA, conjunctions: [], aspects: [] },
                        {
                            name: 6,
                            sign: 2,
                            house: 10,
                            strength: U.SAMA,
                            conjunctions: [],
                            aspects: [{ planetName: 2, aspectType: 120 }],
                        },
                    ],
                }),
                d9: chartEntry(),
                suryaLagna: chartEntry(),
                chandraLagna: chartEntry(),
            } as WargaKendara,
        };
        const { sections } = resolveNotepadObservation(withStaleDegreeAspects, 7, null);
        const section = sectionOf(sections, "houseLord");
        // Primary: 7th house (Cancer, lord Moon) with Moon in the 8th → position 2.
        expect(section.tags[0]).toMatchObject({ kind: "lord", planet: 2, position: 2, color: "lightGreen" });

        const made = section.tags.filter((t) => t.detail === "aspectsMade");
        const received = section.tags.filter((t) => t.detail === "aspectsReceived");
        // The d1 shows only Venus (120°, green) related to the Moon — Rahu(8)/Ketu(9) must NOT surface.
        expect(made.map((t) => t.target)).toEqual([]);
        expect(received.map((t) => t.target)).toEqual([6]);
        expect(received[0]?.color).toBe("green");
    });
});

describe("Nakshatra load (UT-SN-105)", () => {
    test("UT-SN-105: load tag with nakshatra params + pada, ratio over subjects", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "nakshatraLoad");
        expect(section.tags).toHaveLength(1);
        const tag = section.tags[0];
        expect(tag.labelKey).toBe("notepad.observation.nakshatraLoad");
        expect(tag.params).toEqual({ nakshatra: 14, count: 3 });
        expect(tag.pada).toBe(1);
        // Subjects: Moon(SAMA/white), Mars(UCHCHA/green), Mercury(NEECHA/red)
        expect(section.ratio).toEqual({ green: 1, total: 3 });
    });

    test("UT-SN-105b: degenerate count-0 nakshatra never emits a misleading load tag", () => {
        const noMoonNakshatra: CalculatedDetailsLike = {
            ...legacyNoWarga,
            planets: [planet(1, 7, { strength: U.UCHCHA })],
            nakshatra: { moonNakshatra: { id: 14, pada: 1 } },
        };
        const { sections } = resolveNotepadObservation(noMoonNakshatra, 7, null);
        const section = sectionOf(sections, "nakshatraLoad");
        expect(section.tags[0].labelKey).toBe("notepad.observation.notAvailable");
        expect(section.ratio).toEqual({ green: 0, total: 1 });
    });
});

describe("Significator planets (UT-SN-106/106b)", () => {
    test("UT-SN-106: marriage → Venus only, same planet tag shape", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, "marriage");
        const section = sectionOf(sections, "subTagPlanet");
        expect(section.tags.map((t) => t.planet)).toEqual([6]);
        expect(section.tags[0].kind).toBe("planet");
        expect(section.ratio).toEqual({ green: 1, total: 1 });
    });

    test("UT-SN-106b: unmapped sub-tag → empty section (component renders empty-state text)", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, "actionsInTheWorld");
        const section = sectionOf(sections, "subTagPlanet");
        expect(section.tags).toEqual([]);
        expect(section.ratio).toEqual({ green: 0, total: 0 });
    });

    test("UT-SN-106c: no sub-tag selected → empty section", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        expect(sectionOf(sections, "subTagPlanet").tags).toEqual([]);
    });
});

describe("observationTagId (color-override persistence keys)", () => {
    const base = { color: "white" as const };

    test("stable across equal content, distinct across different tags/sections", () => {
        const lordTag = { ...base, kind: "lord" as const, planet: 2, position: 2, house: 8 };
        const sameTag = { ...base, kind: "lord" as const, planet: 2, position: 2, house: 8 };
        const movedTag = { ...base, kind: "lord" as const, planet: 2, position: 3, house: 9 };
        const aspectMade = {
            ...base,
            kind: "lordDetail" as const,
            detail: "aspectsMade" as const,
            planet: 2,
            target: 6,
        };
        const aspectReceived = {
            ...base,
            kind: "lordDetail" as const,
            detail: "aspectsReceived" as const,
            planet: 2,
            target: 6,
        };
        const houseTag = { ...base, kind: "house" as const, chart: "d1" as const, house: 7 };
        const d9HouseTag = { ...base, kind: "house" as const, chart: "d9" as const, house: 7 };

        expect(observationTagId("houseLord", lordTag)).toBe(observationTagId("houseLord", sameTag));
        expect(observationTagId("houseLord", lordTag)).not.toBe(observationTagId("houseLord", movedTag));
        expect(observationTagId("houseLord", aspectMade)).not.toBe(observationTagId("houseLord", aspectReceived));
        expect(observationTagId("wargaKendara", houseTag)).not.toBe(observationTagId("wargaKendara", d9HouseTag));
        // Same content in different sections is a different tag (per-section overrides).
        expect(observationTagId("planetsInHouse", houseTag)).not.toBe(observationTagId("wargaKendara", houseTag));
    });

    test("flag-less boolean details collapse to one key; opposing flags differ", () => {
        const retro = { ...base, kind: "lordDetail" as const, detail: "retrograde" as const, planet: 3, flag: true };
        const notRetro = { ...base, kind: "lordDetail" as const, detail: "retrograde" as const, planet: 3 };
        const other = { ...base, kind: "lordDetail" as const, detail: "retrograde" as const, planet: 4 };
        expect(observationTagId("houseLord", retro)).not.toBe(observationTagId("houseLord", notRetro));
        expect(observationTagId("houseLord", retro)).not.toBe(observationTagId("houseLord", other));
    });
});

describe("Color classification (UT-SN-107/108)", () => {
    test("UT-SN-107: known strengths classify consistently", () => {
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.ATHI_UCHCHA })).toBe("green");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.UCHCHA })).toBe("green");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.MOOLATRIKONA })).toBe("green");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.OWN_SIGN })).toBe("green");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.MITRA })).toBe("green");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.NEECHA })).toBe("red");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.ATHI_NEECHA })).toBe("red");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.SHATRU })).toBe("red");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: U.SAMA })).toBe("white");
    });

    test("UT-SN-108: unknown strengths (NaN/string/future enum) → white, never throws", () => {
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: NaN })).toBe("white");
        expect(classifyPlanetStrength({ kind: "planet", color: "white", strength: 2 })).toBe("white");
        expect(
            classifyPlanetStrength({ kind: "planet", color: "white", strength: "strong" as unknown as number }),
        ).toBe("white");
        expect(classifyPlanetStrength({ kind: "planet", color: "white" })).toBe("white");
        // Pluggable classifier swaps in without touching the builders.
        const alwaysRed = () => "red" as const;
        const { sections } = resolveNotepadObservation(autoWarga, 7, null, alwaysRed);
        expect(sectionOf(sections, "planetsInHouse").tags.every((t) => t.color === "red")).toBe(true);
    });
});

describe("Chandra / Surya Lagna houses (UT-SN-109/110/109b)", () => {
    test("UT-SN-109: chandraLagnaHouse renders the related house + load", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "chandraLagnaHouse");
        expect(section.tags.map((t) => t.kind)).toEqual(["house", "load"]);
        expect(section.tags[0]).toMatchObject({ chart: "chandraLagna", house: 7, planets: [2], loadCount: 1 });
        expect(section.ratio).toEqual({ green: 0, total: 1 });
    });

    test("UT-SN-110: suryaLagnaHouse same shape via suryaLagna entry", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "suryaLagnaHouse");
        expect(section.tags[0]).toMatchObject({ chart: "suryaLagna", house: 7, planets: [5], loadCount: 1 });
    });

    test("UT-SN-109b: absent charts degrade to not-available (legacy fixture)", () => {
        const { sections } = resolveNotepadObservation(legacyNoWarga, 7, null);
        for (const key of ["chandraLagnaHouse", "suryaLagnaHouse", "wargaKendara"]) {
            const section = sectionOf(sections, key);
            expect(section.tags).toHaveLength(1);
            expect(section.tags[0].labelKey).toBe("notepad.observation.notAvailable");
            expect(section.ratio).toEqual({ green: 0, total: 1 });
        }
    });
});

describe("Related Warga Kendara (UT-SN-111/112/112b)", () => {
    test("UT-SN-112: full warga — lagna + related house + D1 load in warga", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(sections, "wargaKendara");
        const kinds = section.tags.map((t) => t.kind);
        expect(kinds[0]).toBe("lagna");
        expect(section.tags[0]).toMatchObject({ chart: "d9", lagnaSign: 6, loadCount: 0 });
        expect(kinds[1]).toBe("house");
        expect(section.tags[1]).toMatchObject({ chart: "d9", house: 7, planets: [3], loadCount: 1 });
        // D1 load in warga: stored planets with house 7 → 5 tags; Mars positioned from d9 row
        // (sign 10 / house 7 / OWN_SIGN green), the others fall back to D1 placement (white).
        const d1Load = section.tags.filter((t) => t.kind === "d1LoadInWarga");
        expect(d1Load).toHaveLength(5);
        expect(d1Load.map((t) => t.planet).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([2, 3, 4, 6, 8]);
        const mars = d1Load.find((t) => t.planet === 3);
        expect(mars).toMatchObject({ sign: 10, house: 7, strength: U.OWN_SIGN, color: "green" });
        // Ratio over the d1-load subjects: 1 green (Mars) of 5.
        expect(section.ratio).toEqual({ green: 1, total: 5 });
    });

    test("UT-SN-111: legacy snapshot — warga sections degrade, never throw", () => {
        const { sections } = resolveNotepadObservation(legacyNoWarga, 7, null);
        expect(sectionOf(sections, "wargaKendara").tags[0].labelKey).toBe("notepad.observation.notAvailable");
    });

    test("UT-SN-111b: full legacy chart (ascendant+houses) re-derives warga via resolveWargaKendara", () => {
        const fullLegacy: CalculatedDetailsLike = {
            ascendant: { sign: 1, degree: 0, lord: 3 },
            houses: houses12(),
            planets: [planet(1, 7, { sign: 5, strength: U.UCHCHA }), planet(2, 7, { sign: 7, strength: U.SAMA })],
            nakshatra: { moonNakshatra: { id: 14, pada: 1 } },
        };
        const { sections } = resolveNotepadObservation(fullLegacy, 7, null);
        const section = sectionOf(sections, "wargaKendara");
        // Derived d9 renders real sub-parts instead of not-available.
        expect(section.tags[0].labelKey).not.toBe("notepad.observation.notAvailable");
        expect(section.tags.some((t) => t.kind === "lagna")).toBe(true);
    });

    test("UT-SN-112b: corrupt warga sub-parts degrade individually", () => {
        const { sections } = resolveNotepadObservation(corruptPartial, 7, null);
        const section = sectionOf(sections, "wargaKendara");
        // House row sub-part is corrupt → its own not-available tag.
        expect(section.tags.some((t) => t.labelKey === "notepad.observation.notAvailable")).toBe(true);
        // Section still renders + the D1-load sub-part still works.
        expect(section.tags.some((t) => t.kind === "lagna")).toBe(true);
        const d1Load = section.tags.filter((t) => t.kind === "d1LoadInWarga");
        expect(d1Load.length).toBeGreaterThan(0);
        // Mars missing from d9 rows → D1 placement, strength omitted → neutral white.
        const mars = d1Load.find((t) => t.planet === 3);
        expect(mars?.strength).toBeUndefined();
        expect(mars?.color).toBe("white");
    });
});

describe("Ratio matrix + determinism + robustness (UT-SN-115/116/117)", () => {
    test("UT-SN-115: ratio matrix cases", () => {
        // (a) 3 planets, 1 green — legacy fixture house 7.
        const legacy = resolveNotepadObservation(legacyNoWarga, 7, null);
        expect(sectionOf(legacy.sections, "planetsInHouse").ratio).toEqual({ green: 1, total: 3 });

        // (b) 0 green of N — autoWarga suryaLagna (Jupiter SAMA only).
        const auto = resolveNotepadObservation(autoWarga, 7, null);
        expect(sectionOf(auto.sections, "suryaLagnaHouse").ratio).toEqual({ green: 0, total: 1 });

        // (d) zero tags → {0,0} — the component suppresses the badge.
        expect(sectionOf(auto.sections, "subTagPlanet").ratio).toEqual({ green: 0, total: 0 });
    });

    test("UT-SN-116: deterministic output across identical inputs", () => {
        const a = resolveNotepadObservation(autoWarga, 7, "marriage");
        const b = resolveNotepadObservation(autoWarga, 7, "marriage");
        expect(a).toEqual(b);
        // Stable section order.
        expect(a.sections.map((s) => s.key)).toEqual([
            "planetsInHouse",
            "houseLord",
            "nakshatraLoad",
            "subTagPlanet",
            "chandraLagnaHouse",
            "suryaLagnaHouse",
            "wargaKendara",
        ]);
    });

    test("UT-SN-117: corrupt/partial input never throws", () => {
        expect(() => resolveNotepadObservation(null, 7, null)).not.toThrow();
        expect(() => resolveNotepadObservation(undefined, 7, null)).not.toThrow();
        expect(() => resolveNotepadObservation({} as CalculatedDetailsLike, 7, null)).not.toThrow();
        expect(() =>
            resolveNotepadObservation({ planets: "nope" } as unknown as CalculatedDetailsLike, 7, null),
        ).not.toThrow();
        expect(() =>
            resolveNotepadObservation(
                { nakshatra: { moonNakshatra: "legacy-string" } } as unknown as CalculatedDetailsLike,
                7,
                null,
            ),
        ).not.toThrow();
        expect(() => resolveNotepadObservation(autoWarga, 99, null)).not.toThrow();
        expect(() => resolveNotepadObservation(autoWarga, 1.5, null)).not.toThrow();

        // null calculatedDetails → every section is not-available (0/1).
        const nullCase = resolveNotepadObservation(null, 7, null);
        expect(nullCase.sections).toHaveLength(7);
        for (const section of nullCase.sections) {
            expect(section.tags[0].labelKey).toBe("notepad.observation.notAvailable");
            expect(section.ratio).toEqual({ green: 0, total: 1 });
        }

        // parentTag 0 / invalid → no sections (component shows only student tags).
        expect(resolveNotepadObservation(autoWarga, 0, null).sections).toEqual([]);
        expect(resolveNotepadObservation(autoWarga, 99, null).sections).toEqual([]);
    });

    test("UT-SN-117b: every section is always present in fixed order (empty sections included)", () => {
        const { sections } = resolveNotepadObservation(autoWarga, 1, null);
        expect(sections.map((s) => s.key)).toEqual([
            "planetsInHouse",
            "houseLord",
            "nakshatraLoad",
            "subTagPlanet",
            "chandraLagnaHouse",
            "suryaLagnaHouse",
            "wargaKendara",
        ]);
    });
});

describe("Not-relevant tag exclusion (TODO #26)", () => {
    test("planetsInHouse: excluded tag drops its subject from the ratio; the tag still renders", () => {
        const base = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(base.sections, "planetsInHouse");
        expect(section.tags.map((t) => t.planet)).toEqual([3, 6]);
        expect(section.ratio).toEqual({ green: 2, total: 2 });

        const marsId = observationTagId("planetsInHouse", section.tags[0]);
        const out = resolveNotepadObservation(autoWarga, 7, null, undefined, new Set([marsId]));
        const excluded = sectionOf(out.sections, "planetsInHouse");
        expect(excluded.tags).toHaveLength(2);
        expect(excluded.ratio).toEqual({ green: 1, total: 1 });

        const both = new Set(section.tags.map((t) => observationTagId("planetsInHouse", t)));
        const allOut = resolveNotepadObservation(autoWarga, 7, null, undefined, both);
        expect(sectionOf(allOut.sections, "planetsInHouse").ratio).toEqual({ green: 0, total: 0 });
    });

    test("legacy fallback: excluding a neutral tag cuts total only; excluding the green tag drops the numerator", () => {
        const base = resolveNotepadObservation(legacyNoWarga, 7, null);
        const section = sectionOf(base.sections, "planetsInHouse");
        expect(section.ratio).toEqual({ green: 1, total: 3 });
        const [sunId, moonId, marsId] = section.tags.map((t) => observationTagId("planetsInHouse", t));

        const noMoon = resolveNotepadObservation(legacyNoWarga, 7, null, undefined, new Set([moonId]));
        expect(sectionOf(noMoon.sections, "planetsInHouse").ratio).toEqual({ green: 1, total: 2 });

        const noSun = resolveNotepadObservation(legacyNoWarga, 7, null, undefined, new Set([sunId]));
        expect(sectionOf(noSun.sections, "planetsInHouse").ratio).toEqual({ green: 0, total: 2 });
    });

    test("houseLord: excluding the primary tag dismisses the section's ratio (0/0)", () => {
        const base = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(base.sections, "houseLord");
        expect(section.tags[0].kind).toBe("lord");
        expect(section.ratio).toEqual({ green: 1, total: 1 });

        const primaryId = observationTagId("houseLord", section.tags[0]);
        const out = resolveNotepadObservation(autoWarga, 7, null, undefined, new Set([primaryId]));
        const excluded = sectionOf(out.sections, "houseLord");
        expect(excluded.tags.length).toBeGreaterThan(0);
        expect(excluded.ratio).toEqual({ green: 0, total: 0 });
    });

    test("nakshatraLoad: the single aggregated tag — excluded → 0/0", () => {
        const base = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(base.sections, "nakshatraLoad");
        expect(section.ratio).toEqual({ green: 1, total: 3 });

        const loadId = observationTagId("nakshatraLoad", section.tags[0]);
        const out = resolveNotepadObservation(autoWarga, 7, null, undefined, new Set([loadId]));
        expect(sectionOf(out.sections, "nakshatraLoad").ratio).toEqual({ green: 0, total: 0 });
    });

    test("wargaKendara: excluding a D1-load tag drops that subject from the ratio", () => {
        const base = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(base.sections, "wargaKendara");
        expect(section.ratio).toEqual({ green: 1, total: 5 });
        const marsTag = section.tags.find((t) => t.kind === "d1LoadInWarga" && t.planet === 3) as ObservationTagBase;

        const marsId = observationTagId("wargaKendara", marsTag);
        const out = resolveNotepadObservation(autoWarga, 7, null, undefined, new Set([marsId]));
        const excluded = sectionOf(out.sections, "wargaKendara");
        expect(excluded.ratio).toEqual({ green: 0, total: 4 });
        expect(excluded.tags).toHaveLength(section.tags.length);
    });

    test("exclusion changes only the ratio — tag colors and the tags list are untouched", () => {
        const base = resolveNotepadObservation(autoWarga, 7, null);
        const section = sectionOf(base.sections, "planetsInHouse");
        const excluded = new Set(section.tags.map((t) => observationTagId("planetsInHouse", t)));

        const out = resolveNotepadObservation(autoWarga, 7, null, undefined, excluded);
        const excludedSection = sectionOf(out.sections, "planetsInHouse");
        expect(excludedSection.tags).toEqual(section.tags);
    });
});
