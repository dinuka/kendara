/**
 * Yoga / Dosha separated tags — engine / catalog / rules / resolution unit tests.
 * QA plan: specs/qa/20260906-0837-yoga-dosha-tags-test-plan.md (UT-YD-001..155).
 *
 * Shani-Mangala is evaluated as a DOSHA ("Shani Mangala Dosha"); the Yoga catalog is empty this
 * release. The catalog module is mocked only to make `activeYogaEntries`/`activeDoshaEntries`
 * controllable for the empty-catalog / additive-extension tests (UT-YD-007/089); every other
 * test uses the real seed catalog via requireActual defaults.
 */
import * as fs from "fs";
import * as path from "path";

import { CancellationStatus, PlanetaryStrength, YogaStrength } from "@/lib/astrologyEnums";
import { CANCELLATION_REGISTRY, MITIGATION_REGISTRY } from "@/lib/yogaDosha/cancellation";
import {
    DOSHA_CATALOG,
    YOGA_CATALOG,
    activeDoshaEntries,
    activeYogaEntries,
    catalogAliasesFor,
    catalogNameFor,
    doshaCatalogEntry,
    yogaCatalogEntry,
} from "@/lib/yogaDosha/catalog";
import {
    SIGN_LORDS,
    areConjunct,
    degreeGapBetween,
    hasMutualAspect,
    isParivartana,
    relativeHouseGap,
} from "@/lib/yogaDosha/relationships";
import { resolveDoshas, resolveYogaDoshas, resolveYogas, validateYogaDoshaShape } from "@/lib/yogaDosha/resolve";
import { PlanetLike, YOGA_DOSHA_VERSION, buildChartFacts, computeYogaDoshas } from "@/lib/yogaDosha/ruleEngine";
import * as rulesModule from "@/lib/yogaDosha/rules";
import { evaluateRule } from "@/lib/yogaDosha/rules";
import { KUJA_DOSHA_HOUSES, evaluateRule as evaluateRuleDirect } from "@/lib/yogaDosha/rules";
import { AspectFact, ChartFacts, PlanetFact } from "@/lib/yogaDosha/types";

jest.mock("@/lib/yogaDosha/catalog", () => {
    const actual = jest.requireActual("@/lib/yogaDosha/catalog") as Record<string, unknown>;
    return {
        ...actual,
        activeYogaEntries: jest.fn(() => (actual.activeYogaEntries as () => unknown[])()),
        activeDoshaEntries: jest.fn(() => (actual.activeDoshaEntries as () => unknown[])()),
    };
});

const messagesDir = path.resolve(__dirname, "..", "..", "src", "messages");
const en = JSON.parse(fs.readFileSync(path.join(messagesDir, "en.json"), "utf8"));
const si = JSON.parse(fs.readFileSync(path.join(messagesDir, "si.json"), "utf8"));

const mockActiveYogaEntries = activeYogaEntries as jest.Mock;
const mockActiveDoshaEntries = activeDoshaEntries as jest.Mock;

const aspect = (planetName: number, aspectType: number, degreeGap: number): AspectFact => ({
    planetName,
    aspectType,
    degreeGap,
});

function pf(name: number, extra: Partial<PlanetFact> = {}): PlanetFact {
    return {
        planetName: name,
        sign: 1,
        house: 1,
        degree: 15,
        absoluteDegree: 15,
        strength: PlanetaryStrength.SAMA,
        navamsaSign: 1,
        navamsaStrength: PlanetaryStrength.SAMA,
        nakshatra: 0,
        aspects: [],
        ...extra,
    };
}

const facts = (planets: PlanetFact[]): ChartFacts => ({
    ascendantSign: 1,
    source: "auto",
    tradition: "MAIN_STREAM",
    planets,
});

/** Stored-chart-document planet (name-keyed), the shape legacy docs hand to the resolver. */
function planetDoc(name: number, sign: number, house: number): PlanetLike {
    return {
        name,
        sign,
        house,
        degree: 15,
        absoluteDegree: 15,
        strength: PlanetaryStrength.SAMA,
        navamsaSign: sign,
        navamsaStrength: PlanetaryStrength.SAMA,
        nakshatra: 0,
        aspects: [],
    };
}

const saturnMarsBoth = (saturn: Partial<PlanetFact>, mars: Partial<PlanetFact>): PlanetFact[] => [
    pf(7, saturn),
    pf(3, mars),
];

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    // Restore the real status-filtering behaviour (UT-YD-089 leaks a mocked empty catalog).
    mockActiveYogaEntries.mockImplementation(() => YOGA_CATALOG.filter((entry) => entry.status === "ACTIVE"));
    mockActiveDoshaEntries.mockImplementation(() => DOSHA_CATALOG.filter((entry) => entry.status === "ACTIVE"));
});

describe("Catalog & enums (UT-YD-001..008)", () => {
    test("UT-YD-001: catalog is registry-driven — all ACTIVE doshas live in the dosha catalog", () => {
        expect(YOGA_CATALOG.map((e) => e.id)).toEqual(["dharmaKarmadhipati"]);
        expect(YOGA_CATALOG[0].kind).toBe("yoga");
        expect(YOGA_CATALOG[0].status).toBe("ACTIVE");
        expect(YOGA_CATALOG[0].keywordEn).toBe("Dharma Karmadhipati Yoga");
        expect(YOGA_CATALOG[0].keywordSi).toBe("ධර්ම කර්මාධිපති යෝගය");
        expect(DOSHA_CATALOG.map((e) => e.id)).toEqual(["shaniMangala", "agniMarutha", "manglik"]);
        expect(DOSHA_CATALOG[0].kind).toBe("dosha");
        expect(DOSHA_CATALOG[0].status).toBe("ACTIVE");
        expect(DOSHA_CATALOG[0].keywordEn).toBe("Shani Mangala Dosha");
        expect(DOSHA_CATALOG[0].keywordSi).toBe("ශනි මංගල දෝෂය");
        expect(DOSHA_CATALOG[1].kind).toBe("dosha");
        expect(DOSHA_CATALOG[1].status).toBe("ACTIVE");
        expect(DOSHA_CATALOG[1].keywordEn).toBe("Agni Marutha Dosha");
        expect(DOSHA_CATALOG[1].keywordSi).toBe("අග්නි මාරුත දෝෂය");
        expect(DOSHA_CATALOG[2].kind).toBe("dosha");
        expect(DOSHA_CATALOG[2].status).toBe("ACTIVE");
        // Every row carries the architect's registry columns.
        for (const entry of [...YOGA_CATALOG, ...DOSHA_CATALOG]) {
            expect(typeof entry.id).toBe("string");
            expect(["yoga", "dosha"]).toContain(entry.kind);
            expect(typeof entry.tradition).toBe("string");
            expect(typeof entry.keywordEn).toBe("string");
            expect(Array.isArray(entry.rules)).toBe(true);
            expect(Array.isArray(entry.cancellations ?? [])).toBe(true);
            expect(Array.isArray(entry.mitigations ?? [])).toBe(true);
            expect(Array.isArray(entry.planets)).toBe(true);
            expect(Array.isArray(entry.expressionKeys)).toBe(true);
        }
    });

    test("UT-YD-002: catalog rows match the data-model §Rule Catalog seed table", () => {
        expect(YOGA_CATALOG.flatMap((e) => e.rules.map((r) => r.rule))).toEqual([
            "dharmaKarmadhipati.dk01",
            "dharmaKarmadhipati.dk02",
            "dharmaKarmadhipati.dk03",
        ]);
        expect(YOGA_CATALOG[0].rules.map((r) => r.strength)).toEqual([1, 2, 1]);
        expect(YOGA_CATALOG[0].planets).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(YOGA_CATALOG[0].expressionKeys).toEqual(["expression.main"]);
        expect(YOGA_CATALOG[0].mitigations).toEqual([]);
        expect(DOSHA_CATALOG[0].rules.map((r) => r.rule)).toEqual([
            "shaniMangala.sm01",
            "shaniMangala.sm02",
            "shaniMangala.sm03",
        ]);
        expect(DOSHA_CATALOG[0].rules.map((r) => r.strength)).toEqual([1, 2, 2]);
        expect(DOSHA_CATALOG[0].planets).toEqual([7, 3]);
        expect(DOSHA_CATALOG[0].expressionKeys).toEqual(["expression.main"]);
        expect(DOSHA_CATALOG[0].dashaActivation).toEqual({
            planets: [7, 3],
            noteKey: "dosha.shaniMangala.dashaNote",
        });
        expect(DOSHA_CATALOG[1].rules.map((r) => r.rule)).toEqual([
            "agniMarutha.am01",
            "agniMarutha.am02",
            "agniMarutha.am03",
            "agniMarutha.am04",
            "agniMarutha.am05",
            "agniMarutha.am06",
            "agniMarutha.am07",
            "agniMarutha.am08",
        ]);
        expect(DOSHA_CATALOG[1].rules.map((r) => r.strength)).toEqual([1, 2, 2, 2, 2, 3, 3, 1]);
        expect(DOSHA_CATALOG[1].planets).toEqual([7, 3]);
        expect(DOSHA_CATALOG[1].mitigations).toEqual([]);
        expect(DOSHA_CATALOG[2].rules).toEqual([
            { rule: "manglik.mk01", strength: 2, reasonKey: "rule.mk01" },
            { rule: "manglik.mk02", strength: 2, reasonKey: "rule.mk02" },
            { rule: "manglik.mk03", strength: 2, reasonKey: "rule.mk03" },
        ]);
        expect(DOSHA_CATALOG[2].planets).toEqual([3]);
        expect(DOSHA_CATALOG[2].expressionKeys).toEqual(["expression.partnershipStress"]);
    });

    test("UT-YD-003: ids unique + every rule id resolves a pure evaluator without throwing", () => {
        const ids = [...YOGA_CATALOG, ...DOSHA_CATALOG].map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        const chart = facts(saturnMarsBoth({}, {}));
        for (const entry of [...YOGA_CATALOG, ...DOSHA_CATALOG]) {
            for (const { rule } of entry.rules) {
                const result = evaluateRule(rule as never, chart);
                expect(typeof result.triggered).toBe("boolean");
                expect(typeof result.strength).toBe("number");
            }
        }
    });

    test("UT-YD-004: bilingual name maps keyed by catalog id, both locales, frozen lookup", () => {
        for (const id of ["dharmaKarmadhipati", "shaniMangala", "agniMarutha", "manglik"]) {
            expect(catalogNameFor(id, "en").length).toBeGreaterThan(0);
            expect(catalogNameFor(id, "si").length).toBeGreaterThan(0);
        }
        expect(catalogNameFor("removedYoga", "en")).toBe("");
        expect(catalogNameFor("removedYoga", "si")).toBe("");
    });

    test("UT-YD-005: every catalog i18n key resolves a non-empty string in EN and SI", () => {
        const resolve = (obj: Record<string, unknown>, dotted: string): unknown => {
            return dotted.split(".").reduce<unknown>((acc, part) => {
                if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
                return undefined;
            }, obj);
        };
        const keys: string[] = [];
        for (const entry of [...YOGA_CATALOG, ...DOSHA_CATALOG]) {
            keys.push(`${entry.i18nKey}.name`);
            for (const rule of entry.rules) keys.push(`${entry.i18nKey}.${rule.reasonKey}`);
            for (const key of entry.expressionKeys) keys.push(`${entry.i18nKey}.${key}`);
            if (entry.id === "shaniMangala" || entry.id === "agniMarutha" || entry.id === "dharmaKarmadhipati") {
                for (let house = 1; house <= 12; house++) keys.push(`${entry.i18nKey}.theme.house${house}`);
                if (entry.id !== "dharmaKarmadhipati") keys.push(`${entry.i18nKey}.dashaNote`);
            } else {
                for (const house of [1, 2, 4, 7, 8, 12]) keys.push(`${entry.i18nKey}.theme.house${house}`);
            }
            for (const mitigation of "mitigations" in entry ? entry.mitigations : []) {
                keys.push(`${entry.i18nKey}.mitigation.${mitigation.split(".").pop()}`);
            }
        }
        keys.push(...[1, 2, 3, 4].map((v) => `yogaStrength.${v}`));
        keys.push(...[1, 2, 3].map((v) => `cancellationStatus.${v}`));
        keys.push("tradition.MAIN_STREAM");
        for (const locale of [en, si] as Array<Record<string, unknown>>) {
            for (const key of keys) {
                const value = resolve(locale, key);
                expect(typeof value).toBe("string");
                expect((value as string).length).toBeGreaterThan(0);
            }
        }
    });

    test("UT-YD-006: house{n} theme-key convention — n in 1..12 of the registered house number", () => {
        for (let house = 1; house <= 12; house++) {
            expect(typeof en.dosha.shaniMangala.theme[`house${house}`]).toBe("string");
            expect(typeof en.dosha.agniMarutha.theme[`house${house}`]).toBe("string");
        }
        for (const house of [1, 2, 4, 7, 8, 12]) {
            expect(typeof en.dosha.manglik.theme[`house${house}`]).toBe("string");
        }
        expect(en.dosha.shaniMangala.name).toBe("Shani Mangala Dosha");
        expect(en.dosha.agniMarutha.name).toBe("Agni Marutha Dosha");
    });

    test("UT-YD-007: additive extension is non-breaking — existing outputs identical", () => {
        const chart = facts(saturnMarsBoth({ house: 7, sign: 7 }, { house: 7, sign: 7 }));
        const baseline = computeYogaDoshas(chart);
        // A brand-new ACTIVE dosha entry whose rule can never fire (nakshatra ownership with 0).
        const syntheticPending = {
            ...DOSHA_CATALOG[0],
            id: "pendingExample",
            status: "ACTIVE",
            rules: [{ rule: "agniMarutha.am06", strength: 3, reasonKey: "rule.am06" }],
        } as const;
        mockActiveDoshaEntries.mockImplementation(() =>
            [...DOSHA_CATALOG, syntheticPending as never].filter((entry) => entry.status === "ACTIVE"),
        );
        const extended = computeYogaDoshas(chart);
        expect(extended.doshas[0]).toEqual(baseline.doshas[0]);
        expect(extended.doshas[1]).toEqual(baseline.doshas[1]);
        expect(extended.doshas[2]).toEqual(baseline.doshas[2]);
        expect(extended.doshas[3].id).toBe("pendingExample");
        expect(extended.doshas[3].isPresent).toBe(false);
    });

    test("UT-YD-008: enum values and labels match the data-model §YogaStrength/§CancellationStatus", () => {
        expect(YogaStrength.VERY_STRONG).toBe(1);
        expect(YogaStrength.STRONG).toBe(2);
        expect(YogaStrength.MODERATE).toBe(3);
        expect(YogaStrength.WEAK).toBe(4);
        expect(CancellationStatus.NOT_CANCELLED).toBe(1);
        expect(CancellationStatus.CANCELLED).toBe(2);
        expect(CancellationStatus.MITIGATED).toBe(3);
        expect(en.yogaStrength).toEqual({ 1: "Very strong", 2: "Strong", 3: "Moderate", 4: "Weak" });
        expect(si.cancellationStatus[3]).toBeDefined();
    });
});

describe("Relationships (UT-YD-020..025)", () => {
    test("UT-YD-020: isConjunct — same sign + house AND mutual stored 0° records (in orb)", () => {
        const inOrb = [
            pf(7, { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] }),
            pf(3, { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] }),
        ];
        expect(areConjunct(inOrb[0], inOrb[1])).toBe(true);
        expect(areConjunct(pf(7, { sign: 7, house: 7 }), pf(3, { sign: 7, house: 7 }))).toBe(false);
        expect(areConjunct(pf(7, { sign: 7, house: 7 }), pf(3, { sign: 8, house: 8 }))).toBe(false);
        expect(areConjunct(pf(7, { sign: 12, house: 12 }), pf(3, { sign: 1, house: 1 }))).toBe(false);
    });

    test("UT-YD-021b: isConjunct — same sign + house but out of each planet's orb is NOT conjunct (6a74b291)", () => {
        const saturn = pf(7, { sign: 8, house: 7, absoluteDegree: 226.03, aspects: [] });
        const mars = pf(3, { sign: 8, house: 7, absoluteDegree: 239.6, aspects: [] });
        expect(areConjunct(saturn, mars)).toBe(false);
    });

    test("UT-YD-021: relativeHouseGap — 7th-house pairs are gap 6 both directions", () => {
        const pairs: Array<[number, number, number]> = [
            [1, 7, 6],
            [7, 1, 6],
            [12, 6, 6],
            [6, 12, 6],
            [2, 8, 6],
            [8, 2, 6],
        ];
        for (const [a, b, gap] of pairs) {
            expect(relativeHouseGap(pf(7, { house: a }), pf(3, { house: b }))).toBe(gap);
        }
        expect(relativeHouseGap(pf(7, { house: 1 }), pf(3, { house: 6 }))).toBe(5);
        expect(relativeHouseGap(pf(7, { house: 1 }), pf(3, { house: 8 }))).toBe(7);
    });

    test("UT-YD-022: kendra 4/10 pairs are gaps 3 and 9", () => {
        for (const [a, b] of [
            [1, 10],
            [10, 1],
            [4, 7],
            [7, 4],
            [12, 3],
            [3, 12],
        ]) {
            const gap = relativeHouseGap(pf(7, { house: a }), pf(3, { house: b }));
            expect(gap === 3 || gap === 9).toBe(true);
        }
    });

    test("UT-YD-023: adjacent 2/12 pairs are gaps 1 and 11 (relationship math; 2/12 is no longer a registered rule of either dosha)", () => {
        for (const [a, b] of [
            [2, 3],
            [3, 2],
            [12, 1],
            [1, 12],
        ]) {
            const gap = relativeHouseGap(pf(7, { house: a }), pf(3, { house: b }));
            expect(gap === 1 || gap === 11).toBe(true);
        }
    });

    test("UT-YD-024: isParivartana — sign exchange via SIGN_LORDS, never conjunction", () => {
        // Saturn in Aries (lord Mars) + Mars in Capricorn (lord Saturn).
        const a = pf(7, { sign: 1, house: 1 });
        const b = pf(3, { sign: 10, house: 10 });
        expect(isParivartana(a, b)).toBe(true);
        expect(areConjunct(a, b)).toBe(false);
        // Same-sign pair is a conjunction path, not exchange.
        expect(isParivartana(pf(7, { sign: 7 }), pf(3, { sign: 7 }))).toBe(false);
        expect(isParivartana(pf(7, { sign: 2 }), pf(3, { sign: 9 }))).toBe(false);
    });

    test("UT-YD-025: hasMutualAspect — stored aspect lists union, both directions", () => {
        const mutualA = pf(7, { aspects: [aspect(3, 120, 5)] });
        const mutualB = pf(3, { aspects: [aspect(7, 120, 5)] });
        expect(hasMutualAspect(mutualA, mutualB)).toBe(true);
        const oneWayB = pf(3, { aspects: [] });
        expect(hasMutualAspect(mutualA, oneWayB)).toBe(false);
        const emptyA = pf(7, { aspects: [] });
        expect(hasMutualAspect(emptyA, oneWayB)).toBe(false);
    });
});

describe("Shani–Mangala + Agni–Marutha rules (UT-YD-040..047, AM-0x)", () => {
    test("UT-YD-040: SM-01 conjunction fires at strength 1 with house param; AM-01 mirrors it", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const sm = evaluateRuleDirect("shaniMangala.sm01", chart);
        expect(sm.triggered).toBe(true);
        expect(sm.strength).toBe(1);
        expect(sm.reasonKey).toBe("rule.sm01");
        expect(sm.params).toEqual({ house: 7 });
        expect(sm.houseImpact).toEqual([7]);
        // The broad Agni Marutha conjunction also fires.
        const am = evaluateRuleDirect("agniMarutha.am01", chart);
        expect(am.triggered).toBe(true);
        expect(am.strength).toBe(1);
    });

    test("UT-YD-041: SM-02 7th-from-each-other — needs BOTH directions to aspect (mutual 180°, stored records, per-planet orbs)", () => {
        const seventh = facts(
            saturnMarsBoth({ house: 7, aspects: [aspect(3, 180, 2)] }, { house: 1, aspects: [aspect(7, 180, 2)] }),
        );
        const result = evaluateRuleDirect("shaniMangala.sm02", seventh);
        expect(result.triggered).toBe(true);
        expect(result.strength).toBe(2);
        expect(result.reasonKey).toBe("rule.sm02");
        expect(result.params).toEqual({ gap: 6 });
        // Reverse direction is also 7th (gap 6 both ways).
        const reversed = facts(
            saturnMarsBoth({ house: 1, aspects: [aspect(3, 180, 2)] }, { house: 7, aspects: [aspect(7, 180, 2)] }),
        );
        expect(evaluateRuleDirect("shaniMangala.sm02", reversed).triggered).toBe(true);
        // Positionally 7th but only ONE direction aspects (6a68e773 shape) — NOT Shani Mangala.
        const oneWayPlanets = saturnMarsBoth({ house: 7, aspects: [] }, { house: 1, aspects: [aspect(7, 180, 3)] });
        expect(hasMutualAspect(oneWayPlanets[0], oneWayPlanets[1])).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm02", facts(oneWayPlanets)).triggered).toBe(false);
        // Not opposite → absent even with mutual stored aspects.
        const not7 = facts(
            saturnMarsBoth({ house: 2, aspects: [aspect(3, 90, 10)] }, { house: 7, aspects: [aspect(7, 90, 10)] }),
        );
        expect(evaluateRuleDirect("shaniMangala.sm02", not7).triggered).toBe(false);
        // A 2/12 pair is not a Shani Mangala under any SM clause.
        const twoTwelve = facts(saturnMarsBoth({ house: 2 }, { house: 3 }));
        expect(evaluateRuleDirect("shaniMangala.sm02", twoTwelve).triggered).toBe(false);
    });

    test("AM-1/UT-YD-042: SM-03 requires the mutual 4-10 drishti (90°/270° records); 7th pairs fire SM-02 but not SM-03", () => {
        const fourthTenth = facts(
            saturnMarsBoth({ house: 1, aspects: [aspect(3, 270, 3)] }, { house: 10, aspects: [aspect(7, 90, 3)] }),
        );
        const sm03 = evaluateRuleDirect("shaniMangala.sm03", fourthTenth);
        expect(sm03.triggered).toBe(true);
        expect(sm03.strength).toBe(2);
        expect(sm03.params).toEqual({ gap: 9 });
        // The same mutual 4-10 (Mars still 10th from Saturn, Saturn 4th from Mars).
        const reverse = facts(
            saturnMarsBoth({ house: 4, aspects: [aspect(3, 270, 3)] }, { house: 1, aspects: [aspect(7, 90, 3)] }),
        );
        expect(evaluateRuleDirect("shaniMangala.sm03", reverse).triggered).toBe(true);
        // Gap-3 orientation (Mars 4th from Saturn) is the reverse 4-10 — never SM-3, even with
        // a mutual 90° record (the doc requires Mars to be 10th from Saturn, not 4th).
        expect(
            evaluateRuleDirect(
                "shaniMangala.sm03",
                facts(
                    saturnMarsBoth(
                        { house: 1, aspects: [aspect(3, 90, 3)] },
                        { house: 4, aspects: [aspect(7, 90, 3)] },
                    ),
                ),
            ).triggered,
        ).toBe(false);
        // Positionally 4-10, but only Saturn→Mars aspects → the mutual record is missing.
        expect(
            evaluateRuleDirect(
                "shaniMangala.sm03",
                facts(saturnMarsBoth({ house: 1, aspects: [aspect(3, 270, 3)] }, { house: 10, aspects: [] })),
            ).triggered,
        ).toBe(false);
        // A conjunct pair fires SM-01 + AM-01, never SM-02/SM-03.
        const conjunct = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        expect(evaluateRuleDirect("shaniMangala.sm02", conjunct).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm03", conjunct).triggered).toBe(false);
        const engine = computeYogaDoshas(conjunct);
        expect(engine.doshas[0].formation.rulesTriggered).toEqual(["shaniMangala.sm01"]);
        // Agni Marutha conjunct presence.
        expect(engine.doshas[1].isPresent).toBe(true);
    });

    test("UT-YD-045 regression (chart 6a68e773): positionally 7th but no mutual drishti → NO Shani Mangala, AM still present", () => {
        // Saturn 4.82° Aquarius (house 5), Mars 27.06° Leo (house 11): 7th from each other but only
        // Mars→Saturn (210°, 8th-house, gap 7.76) is recorded — Saturn's aspect list has no Mars.
        const saturn = pf(7, {
            sign: 11,
            house: 5,
            degree: 4.82,
            absoluteDegree: 304.82,
            nakshatra: 23,
            aspects: [aspect(1, 150, 6.63), aspect(2, 270, 4.09), aspect(6, 120, 3.89)],
        });
        const mars = pf(3, {
            sign: 5,
            house: 11,
            degree: 27.06,
            absoluteDegree: 147.06,
            nakshatra: 12,
            aspects: [aspect(6, 90, 3.87), aspect(7, 210, 7.76)],
        });
        const chart = facts([saturn, mars]);
        expect(relativeHouseGap(saturn, mars)).toBe(6);
        expect(hasMutualAspect(saturn, mars)).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm01", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm02", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm03", chart).triggered).toBe(false);
        // Agni Marutha is the broad relationship → still present (AM-02 Mars aspects Saturn via the
        // stored 210° record; AM-06 because Dhanishta/23 is a Mars nakshatra).
        const engine = computeYogaDoshas(chart);
        expect(engine.doshas[0].id).toBe("shaniMangala");
        expect(engine.doshas[0].isPresent).toBe(false);
        expect(engine.doshas[1].id).toBe("agniMarutha");
        expect(engine.doshas[1].isPresent).toBe(true);
        expect(engine.doshas[1].formation.rulesTriggered).toContain("agniMarutha.am02");
        expect(engine.doshas[1].formation.rulesTriggered).toContain("agniMarutha.am06");
    });

    test("UT-YD-048 regression (chart 6a74b291): same sign + house but out of each planet's orb → NO Shani Mangala, AM via am04", () => {
        // Saturn 16.03° Vrishchika (house 7, nakshatra 17 Anuradha), Mars 29.6° Vrishchika (house 7,
        // nakshatra 18 Jyeshtha): separation 13.57° exceeds Saturn's 9° and Mars's 8° conjunction
        // orbs, so the compute pipeline stored no 0° records on either side — they are NOT combined.
        const saturn = pf(7, {
            sign: 8,
            house: 7,
            degree: 16.03,
            absoluteDegree: 226.03,
            nakshatra: 17,
            aspects: [],
        });
        const mars = pf(3, {
            sign: 8,
            house: 7,
            degree: 29.6,
            absoluteDegree: 239.6,
            nakshatra: 18,
            aspects: [],
        });
        const chart = facts([saturn, mars]);
        expect(degreeGapBetween(saturn, mars)).toBeCloseTo(13.57, 2);
        expect(areConjunct(saturn, mars)).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm01", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm02", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm03", chart).triggered).toBe(false);
        // Agni Marutha stays present: Saturn sits in Mars's own sign Vrishchika (SIGN_LORDS[8] = Mars).
        const engine = computeYogaDoshas(chart);
        expect(engine.doshas[0].id).toBe("shaniMangala");
        expect(engine.doshas[0].isPresent).toBe(false);
        expect(engine.doshas[1].id).toBe("agniMarutha");
        expect(engine.doshas[1].isPresent).toBe(true);
        expect(engine.doshas[1].formation.rulesTriggered).toContain("agniMarutha.am04");
    });

    test("AM-2/AM-3: one-directional aspects fire the broad dosha only (never Shani Mangala)", () => {
        const marsAspectsSaturn = facts(saturnMarsBoth({ aspects: [] }, { aspects: [aspect(7, 90, 5)] }));
        expect(evaluateRuleDirect("agniMarutha.am02", marsAspectsSaturn).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am03", marsAspectsSaturn).triggered).toBe(false);
        const saturnAspectsMars = facts(saturnMarsBoth({ aspects: [aspect(3, 90, 5)] }, { aspects: [] }));
        expect(evaluateRuleDirect("agniMarutha.am03", saturnAspectsMars).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am02", saturnAspectsMars).triggered).toBe(false);
        // SM-02 also needs the opposite placement (gap 6) AND a mutual 180° record, so a
        // one-directional 90° aspect can never push the pair into Shani Mangala.
        expect(evaluateRuleDirect("shaniMangala.sm02", saturnAspectsMars).triggered).toBe(false);
    });

    test("AM-4/AM-5: sign ownership — Saturn in a Mars sign, Mars in a Saturn sign", () => {
        expect(SIGN_LORDS[1]).toBe(3); // Mesha → Mars
        expect(SIGN_LORDS[8]).toBe(3); // Vrishchika → Mars
        expect(SIGN_LORDS[2]).toBe(6); // Vrishabha → Venus (regression: was Jupiter 5)
        expect(SIGN_LORDS[7]).toBe(6); // Tula → Venus (regression: was Jupiter 5)
        expect(SIGN_LORDS[6]).toBe(4); // Kanya → Mercury
        expect(SIGN_LORDS[9]).toBe(5); // Dhanus → Jupiter
        const saturnInMarsSign = facts(saturnMarsBoth({ sign: 8, house: 8 }, { sign: 1, house: 1 }));
        expect(evaluateRuleDirect("agniMarutha.am04", saturnInMarsSign).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am05", saturnInMarsSign).triggered).toBe(false);
        expect(SIGN_LORDS[10]).toBe(7); // Makara → Saturn
        expect(SIGN_LORDS[11]).toBe(7); // Kumbha → Saturn
        const marsInSaturnSign = facts(saturnMarsBoth({ sign: 10, house: 10 }, { sign: 11, house: 11 }));
        expect(evaluateRuleDirect("agniMarutha.am05", marsInSaturnSign).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am04", marsInSaturnSign).triggered).toBe(false);
    });

    test("AM-6/AM-7: nakshatra ownership — Saturn in a Mars nakshatra, Mars in a Saturn nakshatra", () => {
        // Mrigashira (5) / Chitra (14) / Dhanishta (23) are Mars-ruled; Pushya (8) / Anuradha (17) /
        // Uttara Bhadrapada (26) are Saturn-ruled.
        const saturnInMarsNak = facts(saturnMarsBoth({ nakshatra: 5 }, { nakshatra: 8 }));
        expect(evaluateRuleDirect("agniMarutha.am06", saturnInMarsNak).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am07", saturnInMarsNak).triggered).toBe(true);
        // Missing nakshatra (0) fails closed.
        expect(
            evaluateRuleDirect("agniMarutha.am06", facts(saturnMarsBoth({ nakshatra: 0 }, { nakshatra: 5 }))).triggered,
        ).toBe(false);
        // A nakshatra neutrality fires neither.
        const neutral = facts(saturnMarsBoth({ nakshatra: 1 }, { nakshatra: 2 }));
        expect(evaluateRuleDirect("agniMarutha.am06", neutral).triggered).toBe(false);
        expect(evaluateRuleDirect("agniMarutha.am07", neutral).triggered).toBe(false);
    });

    test("UT-YD-044: parivartana is Agni Marutha AM-08 only — never Shani Mangala", () => {
        // Sign exchange (Saturn in Aries, Mars in Capricorn) with a 2/12 house placement — so the
        // pair is NOT also 4-10 (which would legitimately fire SM-03) nor 7th (SM-02).
        const chart = facts(saturnMarsBoth({ sign: 1, house: 1 }, { sign: 10, house: 3 }));
        const am08 = evaluateRuleDirect("agniMarutha.am08", chart);
        expect(am08.triggered).toBe(true);
        expect(am08.strength).toBe(1);
        expect(evaluateRuleDirect("agniMarutha.am04", chart).triggered).toBe(true);
        expect(evaluateRuleDirect("agniMarutha.am05", chart).triggered).toBe(true);
        // The doc's central rule: parivartana alone is broad, not narrow.
        expect(evaluateRuleDirect("shaniMangala.sm01", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm02", chart).triggered).toBe(false);
        expect(evaluateRuleDirect("shaniMangala.sm03", chart).triggered).toBe(false);
        const engine = computeYogaDoshas(chart);
        expect(engine.doshas[0].id).toBe("shaniMangala");
        expect(engine.doshas[0].isPresent).toBe(false);
        expect(engine.doshas[1].id).toBe("agniMarutha");
        expect(engine.doshas[1].isPresent).toBe(true);
        expect(engine.doshas[1].formation.rulesTriggered).toContain("agniMarutha.am08");
    });

    test("AM inheritance: every Shani Mangala present is also Agni Marutha present", () => {
        // Conjunction (sm01 → also am01).
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const engine = computeYogaDoshas(chart);
        expect(engine.doshas[0].isPresent).toBe(true);
        expect(engine.doshas[1].isPresent).toBe(true);
    });

    test("UT-YD-047: no relationship anywhere — both doshas absent", () => {
        // Saturn in house 2 / Mars house 9 (2/12), both in neutral signs with unowned nakshatras.
        const chart = facts(
            saturnMarsBoth({ house: 2, sign: 5, nakshatra: 1 }, { house: 9, sign: 5, nakshatra: 2, aspects: [] }),
        );
        const engine = computeYogaDoshas(chart);
        expect(engine.doshas[0].isPresent).toBe(false);
        expect(engine.doshas[1].isPresent).toBe(false);
        for (const d of engine.doshas) expect(d.formation.rulesTriggered).toEqual([]);
    });
});

describe("Kuja Dosha (UT-YD-070)", () => {
    test("UT-YD-070: Kuja dosha evaluated independently from Lagna, Moon and Venus (docs/kuja-doshaya.md)", () => {
        // facts() fixes ascendantSign 1, so a planet's whole-sign house equals its sign here.
        // MK-01 (from Lagna): Mars 7th from Lagna → dosha; Moon 11th → Mars 9th from Moon (not);
        // Venus 3rd → Mars 5th from Venus (not).
        const fromLagna = facts([
            pf(2, { sign: 11, house: 11 }),
            pf(6, { sign: 3, house: 3 }),
            pf(3, { sign: 7, house: 7 }),
        ]);
        const lagnaEngine = computeYogaDoshas(fromLagna);
        const lagnaManglik = lagnaEngine.doshas.find((d) => d.id === "manglik");
        expect(lagnaManglik?.isPresent).toBe(true);
        expect(lagnaManglik?.formation.rulesTriggered).toEqual(["manglik.mk01"]);
        expect(lagnaManglik?.formation.reasons[0].params).toEqual({ reference: "Lagna", house: 7 });

        // MK-02 (from Moon): Mars 4th from Moon → dosha; from Lagna Mars is 6th (not);
        // Venus 1st → Mars 6th from Venus (not).
        const fromMoon = facts([
            pf(2, { sign: 3, house: 3 }),
            pf(6, { sign: 1, house: 1 }),
            pf(3, { sign: 6, house: 6 }),
        ]);
        const moonEngine = computeYogaDoshas(fromMoon);
        const moonManglik = moonEngine.doshas.find((d) => d.id === "manglik");
        expect(moonManglik?.isPresent).toBe(true);
        expect(moonManglik?.formation.rulesTriggered).toEqual(["manglik.mk02"]);
        expect(moonManglik?.formation.reasons[0].params).toEqual({ reference: "Moon", house: 4 });

        // MK-03 (from Venus): Mars 4th from Venus → dosha; from Lagna Mars is 3rd (not);
        // Moon 6th → Mars 10th from Moon (not).
        const fromVenus = facts([
            pf(2, { sign: 6, house: 6 }),
            pf(6, { sign: 12, house: 12 }),
            pf(3, { sign: 3, house: 3 }),
        ]);
        const venusEngine = computeYogaDoshas(fromVenus);
        const venusManglik = venusEngine.doshas.find((d) => d.id === "manglik");
        expect(venusManglik?.isPresent).toBe(true);
        expect(venusManglik?.formation.rulesTriggered).toEqual(["manglik.mk03"]);
        expect(venusManglik?.formation.reasons[0].params).toEqual({ reference: "Venus", house: 4 });

        // Multiple reasons must be reported independently, never collapsed (docs §5).
        const multiple = facts([
            pf(2, { sign: 3, house: 3 }),
            pf(6, { sign: 12, house: 12 }),
            pf(3, { sign: 7, house: 7 }),
        ]);
        const multiEngine = computeYogaDoshas(multiple);
        const multiManglik = multiEngine.doshas.find((d) => d.id === "manglik");
        expect(multiManglik?.isPresent).toBe(true);
        expect(multiManglik?.formation.rulesTriggered).toEqual(["manglik.mk01", "manglik.mk03"]);

        // Safe placements (3/5/6/9/10/11 from every reference) never fire the dosha.
        const safe = facts([pf(2, { sign: 8, house: 8 }), pf(6, { sign: 4, house: 4 }), pf(3, { sign: 6, house: 6 })]);
        const safeEngine = computeYogaDoshas(safe);
        const safeManglik = safeEngine.doshas.find((d) => d.id === "manglik");
        expect(safeManglik?.isPresent).toBe(false);
        expect(safeManglik?.formation.rulesTriggered).toEqual([]);
    });

    test("UT-YD-071: MK rules recognise every house in KUJA_DOSHA_HOUSES [1,2,4,7,8,12]", () => {
        for (const house of [1, 2, 4, 7, 8, 12]) {
            const mk = evaluateRuleDirect("manglik.mk01", facts([pf(3, { sign: house, house })]));
            expect(mk.triggered).toBe(true);
            expect(mk.params).toEqual({ reference: "Lagna", house });
            expect(mk.houseImpact).toEqual([house]);
        }
        for (const house of [3, 5, 6, 9, 10, 11]) {
            const mk = evaluateRuleDirect("manglik.mk01", facts([pf(3, { sign: house, house })]));
            expect(mk.triggered).toBe(false);
        }
        // A missing reference (no Moon / Venus facts) fails that rule closed.
        expect(evaluateRuleDirect("manglik.mk02", facts([pf(3, { sign: 7, house: 7 })])).triggered).toBe(false);
        expect(evaluateRuleDirect("manglik.mk03", facts([pf(3, { sign: 7, house: 7 })])).triggered).toBe(false);
    });

    test("UT-YD-072: Kuja dosha never depends on Saturn — placement alone drives it (docs §9)", () => {
        const chart = facts([
            pf(7, { sign: 9, house: 9 }), // Saturn anywhere
            pf(2, { sign: 3, house: 3 }),
            pf(6, { sign: 12, house: 12 }),
            pf(3, { sign: 7, house: 7 }), // Mars 7th from Lagna
        ]);
        const manglik = computeYogaDoshas(chart).doshas.find((d) => d.id === "manglik");
        expect(manglik?.isPresent).toBe(true);
        expect(manglik?.formation.rulesTriggered).toEqual(["manglik.mk01", "manglik.mk03"]);
        expect(manglik?.formation.reasons.every((r) => r.params)).toBe(true);
    });

    test("UT-YD-073: manglik houseImpact/themes use the reference-relative house, never the absolute one", () => {
        // Mars absolutely in house 9 (a NON-dosha house) — but 4th from Moon (mk02) and 7th from
        // Venus (mk03). Regresses the absolute-house bug that produced theme.house9 → MISSING_MESSAGE.
        const chart = facts([pf(2, { sign: 6, house: 6 }), pf(6, { sign: 3, house: 3 }), pf(3, { sign: 9, house: 9 })]);
        const manglik = computeYogaDoshas(chart).doshas.find((d) => d.id === "manglik");
        expect(manglik?.isPresent).toBe(true);
        expect(manglik?.formation.rulesTriggered).toEqual(["manglik.mk02", "manglik.mk03"]);
        const { houseImpact } = manglik!.context;
        for (const house of houseImpact) expect(KUJA_DOSHA_HOUSES).toContain(house);
        expect(houseImpact).toEqual([4, 7]);
        const themeKeys = manglik!.interpretation.themes.map((t) => t.key);
        expect(themeKeys).toEqual(["theme.house4", "theme.house7"]);
    });
});

describe("Dharma Karmadhipati Yoga (UT-DK-001..011)", () => {
    // Ascendant Aries (sign 1) → 9th house sign 9 (Sagittarius, lord Jupiter=5),
    // 10th house sign 10 (Capricorn, lord Saturn=7).

    test("UT-DK-001: DK-01 conjunction — 9th and 10th lords in the same sign/house with mutual 0° records", () => {
        const chart = facts([
            pf(5, { sign: 10, house: 10, aspects: [aspect(7, 0, 0)] }),
            pf(7, { sign: 10, house: 10, aspects: [aspect(5, 0, 0)] }),
        ]);
        const dk = evaluateRuleDirect("dharmaKarmadhipati.dk01", chart);
        expect(dk.triggered).toBe(true);
        expect(dk.strength).toBe(1);
        expect(dk.reasonKey).toBe("rule.dk01");
        expect(dk.params).toEqual({ dharmaLord: 5, karmaLord: 7 });
        expect(dk.houseImpact).toEqual([9, 10]);
    });

    test("UT-DK-002: DK-02 — one-directional aspect does NOT fire (9th lord aspects 10th lord only)", () => {
        // Spec §19: BOTH lords must aspect each other — a one-way drishti is not mutual.
        const chart = facts([
            pf(5, { sign: 9, house: 9, aspects: [aspect(7, 120, 5)] }),
            pf(7, { sign: 10, house: 10, aspects: [] }),
        ]);
        const dk = evaluateRuleDirect("dharmaKarmadhipati.dk02", chart);
        expect(dk.triggered).toBe(false);
    });

    test("UT-DK-003: DK-02 — reverse one-directional aspect does NOT fire (10th lord aspects 9th lord only)", () => {
        const chart = facts([
            pf(5, { sign: 9, house: 9, aspects: [] }),
            pf(7, { sign: 10, house: 10, aspects: [aspect(5, 120, 5)] }),
        ]);
        const dk = evaluateRuleDirect("dharmaKarmadhipati.dk02", chart);
        expect(dk.triggered).toBe(false);
    });

    test("UT-DK-004: DK-02 — MUTUAL aspect fires (both lords aspect each other at a drishti angle)", () => {
        const chart = facts([
            pf(5, { sign: 9, house: 9, aspects: [aspect(7, 120, 5)] }),
            pf(7, { sign: 10, house: 10, aspects: [aspect(5, 120, 5)] }),
        ]);
        const dk = evaluateRuleDirect("dharmaKarmadhipati.dk02", chart);
        expect(dk.triggered).toBe(true);
        expect(dk.strength).toBe(2);
    });

    test("UT-DK-005: DK-03 parivartana — each lord in the other's own sign", () => {
        // Jupiter in Capricorn (lord Saturn) + Saturn in Sagittarius (lord Jupiter).
        const chart = facts([pf(5, { sign: 10, house: 10 }), pf(7, { sign: 9, house: 9 })]);
        const dk = evaluateRuleDirect("dharmaKarmadhipati.dk03", chart);
        expect(dk.triggered).toBe(true);
        expect(dk.strength).toBe(1);
        // Also check the parivartana relationship helper confirms it.
        const jupiter = pf(5, { sign: 10, house: 10 });
        const saturn = pf(7, { sign: 9, house: 9 });
        expect(isParivartana(jupiter, saturn)).toBe(true);
    });

    test("UT-DK-006: no qualifying relationship — yoga NOT formed", () => {
        // Jupiter and Saturn in unrelated houses with no aspects between them.
        const chart = facts([pf(5, { sign: 9, house: 9, aspects: [] }), pf(7, { sign: 6, house: 6, aspects: [] })]);
        const engine = computeYogaDoshas(chart);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(false);
        expect(dk?.formation.rulesTriggered).toEqual([]);
    });

    test("UT-DK-007: strong/debilitated lords alone never create the yoga (docs distinction)", () => {
        // Both lords present but no relationship — the yoga must NOT form even if the lords
        // are in strong positions. Exalted Jupiter and own-sign Saturn with no mutual aspect.
        const chart = facts([
            pf(5, { sign: 4, house: 4, strength: PlanetaryStrength.UCHCHA, aspects: [] }),
            pf(7, { sign: 10, house: 10, strength: PlanetaryStrength.OWN_SIGN, aspects: [] }),
        ]);
        const engine = computeYogaDoshas(chart);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(false);
    });

    test("UT-DK-008: engine integration — all qualifying relations form the yoga, reasons carry lord params", () => {
        // Conjunction plus parivartana-style set: DK-01 and DK-03 both fire.
        const conjunct = facts([
            pf(5, { sign: 10, house: 10, aspects: [aspect(7, 0, 0)] }),
            pf(7, { sign: 10, house: 10, aspects: [aspect(5, 0, 0)] }),
        ]);
        const engine = computeYogaDoshas(conjunct);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(true);
        expect(dk?.formation.primaryRule).toBe("dharmaKarmadhipati.dk01");
        expect(dk?.formation.reasons[0].params).toEqual({ dharmaLord: 5, karmaLord: 7 });
        expect(dk?.context.houseImpact).toEqual([9, 10]);
        expect(dk?.formation.strength).toBe(1);
        // Shape validation on present yoga entries.
        expect(validateYogaDoshaShape(dk)).toEqual([]);
    });

    test("UT-DK-009: Venus-ruled houses — Capricorn ascendant, 9th lord Mercury + 10th lord Venus, no sambandha → absent", () => {
        // Ascendant Capricorn (10): 9th house = Virgo (lord Mercury 4), 10th house = Libra
        // (lord Venus 6). THE SIGN_LORDS regression: Libra was mapped to Jupiter (5) making the
        // engine inspect the wrong 10th lord. Mercury and Venus share no aspect/conjunction, so
        // the yoga must be absent (reported for horoscope 6a68e2c9150a9f9377fa8861).
        const chart = buildChartFacts({
            ascendantSign: 10,
            source: "auto",
            planets: [
                {
                    name: 4,
                    sign: 6,
                    house: 9,
                    degree: 6.55,
                    absoluteDegree: 156.55,
                    strength: PlanetaryStrength.SAMA,
                    navamsaSign: 1,
                    navamsaStrength: PlanetaryStrength.SAMA,
                    nakshatra: 12,
                    aspects: [],
                },
                {
                    name: 6,
                    sign: 7,
                    house: 10,
                    degree: 22.34,
                    absoluteDegree: 202.34,
                    strength: PlanetaryStrength.UCHCHA,
                    navamsaSign: 1,
                    navamsaStrength: PlanetaryStrength.SAMA,
                    nakshatra: 6,
                    aspects: [],
                },
            ],
        });
        expect(SIGN_LORDS[7]).toBe(6); // Libra lord = Venus — the fixed mapping
        const engine = computeYogaDoshas(chart);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(false);
        expect(dk?.formation.rulesTriggered).toEqual([]);
    });

    test("UT-DK-010: conjunction-only chart — DK-01 fires, DK-02 does NOT (yuti is not drishti)", () => {
        // Reported for horoscope 6a68e63506d2d7cd52c6fa9d: the 9th/10th lords were conjunct (mutual
        // 0° records) and the engine ALSO emitted the DK-02 "aspecting each other" reason. A
        // 0° conjunction record is yuti, not drishti — only the DK-01 reason may appear.
        const chart = facts([
            pf(5, { sign: 12, house: 12, aspects: [aspect(7, 0, 0)] }),
            pf(7, { sign: 12, house: 12, aspects: [aspect(5, 0, 0)] }),
        ]);
        const dk02 = evaluateRuleDirect("dharmaKarmadhipati.dk02", chart);
        expect(dk02.triggered).toBe(false);
        const engine = computeYogaDoshas(chart);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(true);
        expect(dk?.formation.rulesTriggered).toEqual(["dharmaKarmadhipati.dk01"]);
        expect(dk?.formation.reasons.map((r) => r.rule)).toEqual(["dharmaKarmadhipati.dk01"]);
    });

    test("UT-DK-011: genuine non-zero mutual aspect — DK-02 fires even when the lords are also conjunct", () => {
        // 90° mutual drishti in addition to the 0° conjunction record: the aspect reason is real
        // graha drishti, so both DK-01 and DK-02 qualify.
        const chart = facts([
            pf(5, { sign: 9, house: 9, aspects: [aspect(7, 0, 0), aspect(7, 90, 5)] }),
            pf(7, { sign: 9, house: 9, aspects: [aspect(5, 0, 0), aspect(5, 90, 5)] }),
        ]);
        const engine = computeYogaDoshas(chart);
        const dk = engine.yogas.find((y) => y.id === "dharmaKarmadhipati");
        expect(dk?.isPresent).toBe(true);
        expect(dk?.formation.rulesTriggered).toEqual(["dharmaKarmadhipati.dk01", "dharmaKarmadhipati.dk02"]);
    });
});

describe("Rule engine (UT-YD-080..090)", () => {
    test("UT-YD-080: only active catalog entries evaluated", () => {
        const chart = facts(saturnMarsBoth({ aspects: [aspect(3, 0, 0)] }, { aspects: [aspect(7, 0, 0)] }));
        const engine = computeYogaDoshas(chart);
        // With ascendant Aries, the 9th lord is Jupiter (not in this fixture) — the yoga is absent
        // but still evaluated and stored (fail-closed, US-YD-005 Edge).
        expect(engine.yogas.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(engine.yogas[0].isPresent).toBe(false);
        expect(engine.doshas.map((d) => d.id)).toEqual(["shaniMangala", "agniMarutha", "manglik"]);
        // Default both-in-house-1 facts are a same-sign same-house conjunction → first two present.
        // Mars in house 1 is also 1st from Lagna → Kuja dosha present (mk01).
        expect(engine.doshas[0].isPresent).toBe(true);
        expect(engine.doshas[1].isPresent).toBe(true);
        expect(engine.doshas[2].isPresent).toBe(true);
        expect(engine.doshas[2].formation.rulesTriggered).toEqual(["manglik.mk01"]);
    });

    test("UT-YD-081: structured output shape — never { yoga: true }", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const [shani] = computeYogaDoshas(chart).doshas;
        expect(shani.id).toBe("shaniMangala");
        expect(shani.kind).toBe("dosha");
        expect(shani.isPresent).toBe(true);
        expect(shani.tradition).toBe("MAIN_STREAM");
        expect(shani.formation).toHaveProperty("rulesTriggered");
        expect(shani.formation).toHaveProperty("primaryRule");
        expect(shani.formation).toHaveProperty("strength");
        expect(shani.formation).toHaveProperty("reasons");
        expect(shani.context).toHaveProperty("houseImpact");
        expect(shani.interpretation).toHaveProperty("themes");
        expect(shani.mitigation).toBeInstanceOf(Array);
        expect(shani.cancellation).toHaveProperty("status");
        expect(shani.cancellation).toHaveProperty("factors");
        expect(shani.finalAssessment).toHaveProperty("severity");
        expect(shani.finalAssessment).toHaveProperty("expressionKeys");
        expect(shani.dashaActivation).toBeDefined();
        expect((shani as unknown as Record<string, unknown>).yoga).toBeUndefined();
        for (const dosha of computeYogaDoshas(chart).doshas) {
            expect(validateYogaDoshaShape(dosha)).toEqual([]);
        }
    });

    test("UT-YD-082: all satisfied rules + primary-rule ranking (see UT-YD-042 co-fire)", () => {
        // SM-01 (strength 1) + any second rule → primary is the strongest (lowest number).
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0), aspect(3, 150, 5)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0), aspect(7, 210, 5)] },
            ),
        );
        const engine = computeYogaDoshas(chart);
        const formation = engine.doshas[0].formation;
        expect(formation.rulesTriggered).toContain("shaniMangala.sm01");
        expect(formation.primaryRule).toBe("shaniMangala.sm01");
        expect(formation.strength).toBe(1);
    });

    test("UT-YD-083: reason dedup — no identical reasonKey+params pairs", () => {
        const chart = facts(
            saturnMarsBoth(
                { house: 1, absoluteDegree: 100, aspects: [aspect(3, 180, 10), aspect(3, 60, 5)] },
                { house: 7, absoluteDegree: 280, aspects: [aspect(7, 180, 10), aspect(7, 300, 5)] },
            ),
        );
        const reasons = computeYogaDoshas(chart).doshas[0].formation.reasons;
        const serialized = reasons.map((r) => `${r.reasonKey}|${JSON.stringify(r.params ?? {})}`);
        expect(new Set(serialized).size).toBe(serialized.length);
    });

    test("UT-YD-084: reasons carry numeric params only", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const reasons = computeYogaDoshas(chart).doshas[0].formation.reasons;
        expect(reasons.length).toBeGreaterThan(0);
        for (const reason of reasons) {
            for (const value of Object.values(reason.params ?? {})) {
                expect(typeof value).toBe("number");
            }
        }
    });

    test("UT-YD-085: context.houseImpact = union of impacted houses", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0), aspect(3, 180, 10)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0), aspect(7, 180, 10)] },
            ),
        );
        const context = computeYogaDoshas(chart).doshas[0].context;
        expect(context.houseImpact).toEqual([7]);
    });

    test("UT-YD-086: interpretation themes mirror impacted houses", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0), aspect(3, 180, 10)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0), aspect(7, 180, 10)] },
            ),
        );
        const themes = computeYogaDoshas(chart).doshas[0].interpretation.themes;
        expect(themes.map((t) => t.key)).toEqual(["theme.house7"]);
        expect(themes[0].params).toEqual({ house: 7 });
    });

    test("UT-YD-087: determinism — deep-equal on repeated evaluation", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 150, 5)] },
                { sign: 7, house: 7, aspects: [aspect(7, 210, 5)] },
            ),
        );
        expect(computeYogaDoshas(chart)).toEqual(computeYogaDoshas(chart));
    });

    test("UT-YD-088: partial evaluation fails closed (rule throw → absent entry, no abort)", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const spy = jest.spyOn(rulesModule, "evaluateRule").mockImplementation(() => {
            throw new Error("boom");
        });
        try {
            const engine = computeYogaDoshas(chart);
            expect(engine.doshas[0].isPresent).toBe(false);
            expect(engine.doshas[0].formation.rulesTriggered).toEqual([]);
        } finally {
            spy.mockRestore();
        }
    });

    test("UT-YD-089: empty active catalog → { yogas: [], doshas: [] }", () => {
        mockActiveYogaEntries.mockImplementation(() => []);
        mockActiveDoshaEntries.mockImplementation(() => []);
        const engine = computeYogaDoshas(facts(saturnMarsBoth({}, {})));
        expect(engine).toEqual({ yogas: [], doshas: [] });
    });
});

describe("Cancellation & mitigation (UT-YD-110..117, UT-YD-130)", () => {
    test("UT-YD-110/114: three separate stored fields; no registered cancellation → status 1 default", () => {
        expect(CANCELLATION_REGISTRY).toEqual({});
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const dosha = computeYogaDoshas(chart).doshas[0];
        expect(dosha.isPresent).toBe(true);
        expect(dosha.cancellation).toEqual({ status: CancellationStatus.NOT_CANCELLED, factors: [] });
        expect(dosha.mitigation).toEqual([]);
        expect(dosha.formation.rulesTriggered).toContain("shaniMangala.sm01");
    });

    test("UT-YD-112: Jupiter mitigation never cancels (status != 2)", () => {
        const chart = facts([
            pf(7, { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] }),
            pf(3, { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] }),
            pf(5, { sign: 9, house: 9, aspects: [aspect(7, 120, 4), aspect(3, 150, 4)] }),
        ]);
        const dosha = computeYogaDoshas(chart).doshas[0];
        expect(dosha.mitigation).toHaveLength(1);
        expect(dosha.mitigation[0].factorKey).toBe("shaniMangala.mitigation.sm-mit-001");
        expect(dosha.mitigation[0].effect).toBe("REDUCES_SEVERITY");
        expect(dosha.mitigation[0].target).toBe(3);
        expect(dosha.mitigation[0].confidence).toBe(2);
        expect(dosha.cancellation.status).not.toBe(CancellationStatus.CANCELLED);
    });

    test("UT-YD-113: mitigation factor shape — ruleId/factor/effect/target/tradition/confidence", () => {
        expect(Object.keys(MITIGATION_REGISTRY).length).toBeGreaterThan(0);
        const chart = facts([
            pf(7, { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] }),
            pf(3, { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] }),
            pf(5, { sign: 9, house: 9, aspects: [aspect(7, 120, 4)] }),
        ]);
        const [factor] = computeYogaDoshas(chart).doshas[0].mitigation;
        expect(factor).toMatchObject({
            factorKey: "shaniMangala.mitigation.sm-mit-001",
            type: "BENEFIC_INFLUENCE",
            effect: "REDUCES_SEVERITY",
            target: 3,
            confidence: 2,
        });
    });

    test("UT-YD-115/117: severity weighted synthesis — mitigation raises severity, clamped 1..4", () => {
        const chart = facts([
            pf(7, { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] }),
            pf(3, { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] }),
        ]);
        const dosha = computeYogaDoshas(chart).doshas[0];
        expect(dosha.finalAssessment.severity).toBe(1);
        expect(dosha.finalAssessment.expressionKeys.length).toBeGreaterThan(0);
        expect(dosha.finalAssessment.expressionKeys).toEqual(["expression.main"]);
    });

    test("UT-YD-116: expression keys emitted for present entries", () => {
        // Non-conjunct present formation via SM-02 (houses 2/8 with the mutual opposition record);
        // the same mutual aspects also fire AM-02/AM-03, so Shani Mangala and Agni Marutha are both
        // present here.
        const chart = facts(
            saturnMarsBoth({ house: 2, aspects: [aspect(3, 180, 10)] }, { house: 8, aspects: [aspect(7, 180, 10)] }),
        );
        const engine = computeYogaDoshas(chart);
        const shani = engine.doshas.find((d) => d.id === "shaniMangala");
        expect(shani?.isPresent).toBe(true);
        expect(shani?.formation.rulesTriggered).toEqual(["shaniMangala.sm02"]);
        expect(shani?.finalAssessment.expressionKeys.length).toBeGreaterThan(0);
    });

    test("UT-YD-130: dasha activation — soft note, planets [7,3], tendency language only", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const dosha = computeYogaDoshas(chart).doshas[0];
        expect(dosha.dashaActivation).toEqual({
            planets: [7, 3],
            noteKey: "dosha.shaniMangala.dashaNote",
        });
        const note = en.dosha.shaniMangala.dashaNote as string;
        expect(note.toLowerCase()).not.toMatch(/will |will be/);
    });
});

describe("Legacy & manual resolution (UT-YD-150..155)", () => {
    test("UT-YD-150: manual source — same contract, stored aspect records", () => {
        const manual = buildChartFacts({
            ascendantSign: 1,
            source: "manual",
            planets: [
                {
                    name: 7,
                    sign: 7,
                    house: 7,
                    degree: 15,
                    absoluteDegree: 195,
                    strength: PlanetaryStrength.SAMA,
                    navamsaSign: 7,
                    navamsaStrength: PlanetaryStrength.SAMA,
                    nakshatra: 14,
                    aspects: [aspect(3, 0, 0)],
                },
                {
                    name: 3,
                    sign: 7,
                    house: 7,
                    degree: 15,
                    absoluteDegree: 195,
                    strength: PlanetaryStrength.SAMA,
                    navamsaSign: 7,
                    navamsaStrength: PlanetaryStrength.SAMA,
                    nakshatra: 14,
                    aspects: [aspect(7, 0, 0)],
                },
            ],
        });
        const engine = computeYogaDoshas(manual);
        // Ascendant Aries → 9th lord Jupiter absent from this manual fixture → yoga absent.
        expect(engine.yogas.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(engine.yogas[0].isPresent).toBe(false);
        expect(engine.doshas[0].isPresent).toBe(true);
        expect(manual.source).toBe("manual");
        // Stored mutual 0° (conjunction, in-orb) records fire SM-01 — the positional conjunction.
        expect(engine.doshas[0].formation.rulesTriggered[0]).toBe("shaniMangala.sm01");
        expect(engine.doshas[0].formation.reasons.length).toBeGreaterThan(0);
    });

    test("UT-YD-152: resolveYogas — stored v2 wins; legacy recompute; corrupt falls back", () => {
        // Stored, well-formed, exactly-versioned entries win as-is (no catalog re-evaluation at read).
        const storedYoga = {
            id: "shaniMangala",
            kind: "yoga",
            isPresent: true,
            tradition: "MAIN_STREAM",
            formation: {
                rulesTriggered: ["shaniMangala.sm01"],
                primaryRule: "shaniMangala.sm01",
                strength: 1,
                reasons: [],
            },
            context: { houseImpact: [7] },
            interpretation: { themes: [] },
            mitigation: [],
            cancellation: { status: 1, factors: [] },
            finalAssessment: { severity: 1, expressionKeys: [] },
        } as const;
        const versioned = {
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: [storedYoga],
            ascendant: { sign: 1 },
            planets: [],
        };
        expect(resolveYogas(versioned)).toEqual([storedYoga]);
        // Versioned with an empty list is stored-first too.
        expect(resolveYogas({ ...versioned, yogas: [] })).toEqual([]);

        // Legacy document without the version field → recompute purely from stored chart data.
        // The active Dharma Karmadhipati yoga is derived (absent here — the 9th lord Jupiter is
        // missing from this Aries-ascendant fixture) rather than omitted.
        const legacy = {
            ascendant: { sign: 1 },
            planets: [planetDoc(7, 7, 7), planetDoc(3, 7, 7)],
            yogas: ["shaniMangala"],
        };
        const resolved = resolveYogas(legacy);
        expect(resolved?.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(resolved?.[0].isPresent).toBe(false);
        // Corrupt stored entry → warn + derive (never crash).
        const corrupt = {
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: [{ junk: true }],
            ascendant: { sign: 1 },
            planets: [planetDoc(7, 7, 7), planetDoc(3, 7, 7)],
        };
        expect(resolveYogas(corrupt)?.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(resolveYogas(corrupt)?.[0].isPresent).toBe(false);
        // Nothing derivable → undefined.
        expect(resolveYogas(undefined)).toBeUndefined();
        expect(resolveYogas({})).toBeUndefined();
    });

    test("UT-YD-153: resolveDoshas — versioned structured stays; legacy chart data derives", () => {
        const chart = facts([
            pf(7, { house: 2 }),
            pf(3, { house: 7 }),
            pf(5, { house: 9, aspects: [aspect(3, 120, 5)] }),
        ]);
        const derived = computeYogaDoshas(chart).doshas;
        // All three ACTIVE doshas are evaluated — Mars 7th from Lagna fires Kuja (mk01),
        // no Moon/Venus facts so mk02/mk03 fail closed.
        expect(derived.map((d) => d.id)).toEqual(["shaniMangala", "agniMarutha", "manglik"]);
        expect(derived[0].isPresent).toBe(false);
        expect(derived[2].isPresent).toBe(true);
        expect(derived[2].formation.rulesTriggered).toEqual(["manglik.mk01"]);
        // A stored, exactly-versioned manglik entry wins as-is (stored-first, no re-evaluation).
        const versioned = {
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            doshas: {
                doshas: [
                    {
                        id: "manglik",
                        kind: "dosha",
                        isPresent: false,
                        tradition: "MAIN_STREAM",
                        formation: { rulesTriggered: [], primaryRule: "", strength: 4, reasons: [] },
                        context: { houseImpact: [] },
                        interpretation: { themes: [] },
                        mitigation: [],
                        cancellation: { status: 1, factors: [] },
                        finalAssessment: { severity: 4, expressionKeys: [] },
                    },
                ],
            },
            ascendant: { sign: 1 },
            planets: [planetDoc(7, 7, 7), planetDoc(3, 7, 7)],
        };
        expect(resolveDoshas(versioned)?.map((d) => d.id)).toEqual(["manglik"]);
        // Legacy doc: stale empty doshas + chart data → derives the ACTIVE dosha (absent here).
        const legacy = {
            ascendant: { sign: 1 },
            planets: [planetDoc(7, 5, 5), planetDoc(3, 7, 7)],
            doshas: { doshas: [] },
        };
        const legacyResolved = resolveDoshas(legacy);
        expect(legacyResolved?.map((d) => d.id)).toEqual(["shaniMangala", "agniMarutha", "manglik"]);
        expect(legacyResolved?.[0].isPresent).toBe(false);
        expect(legacyResolved?.[2].isPresent).toBe(true);
    });

    test("UT-YD-155: schema-invariant validator shared by engine outputs", () => {
        const chart = facts(
            saturnMarsBoth(
                { sign: 7, house: 7, aspects: [aspect(3, 0, 0)] },
                { sign: 7, house: 7, aspects: [aspect(7, 0, 0)] },
            ),
        );
        const engine = computeYogaDoshas(chart);
        for (const entry of [...engine.yogas, ...engine.doshas]) {
            expect(validateYogaDoshaShape(entry)).toEqual([]);
        }
        // Negative controls.
        expect(validateYogaDoshaShape(null)).toHaveLength(1);
        expect(validateYogaDoshaShape({ id: "", isPresent: true })).not.toEqual([]);
        expect(
            validateYogaDoshaShape({
                id: "x",
                isPresent: true,
                formation: { rulesTriggered: [], strength: 9 },
                cancellation: { status: 7 },
            }),
        ).not.toEqual([]);
    });

    test("UT-YD-151: manual degree fallback is deterministic (no NaN), aspects default empty", () => {
        // Stored manual records may omit the aspects array entirely (no `aspects` key). The engine
        // still treats the pair as non-conjunct (SM-01 needs stored mutual 0° records — with no
        // records there is no evidence the planets are within their orbs).
        const planetsWithoutAspects = [
            {
                name: 7,
                sign: 7,
                house: 7,
                degree: 15,
                absoluteDegree: 195,
                strength: PlanetaryStrength.SAMA,
                navamsaSign: 7,
                navamsaStrength: PlanetaryStrength.SAMA,
            },
            {
                name: 3,
                sign: 7,
                house: 7,
                degree: 15,
                absoluteDegree: 195,
                strength: PlanetaryStrength.SAMA,
                navamsaSign: 7,
                navamsaStrength: PlanetaryStrength.SAMA,
            },
        ] as unknown as PlanetLike[];
        const factsBuilt = buildChartFacts({
            ascendantSign: 1,
            source: "manual",
            planets: planetsWithoutAspects,
        });
        expect(factsBuilt.planets[0].aspects).toEqual([]);
        const engine = computeYogaDoshas(factsBuilt);
        // Ascendant Aries → 9th lord Jupiter absent → yoga absent (fail-closed).
        expect(engine.yogas.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(engine.yogas[0].isPresent).toBe(false);
        expect(engine.doshas[0].isPresent).toBe(false);
        expect(engine.doshas[0].mitigation).toEqual([]);
    });

    test("resolveYogaDoshas: combined entry point mirrors the two resolves", () => {
        const doc = {
            ascendant: { sign: 1 },
            planets: [
                { ...planetDoc(7, 7, 7), aspects: [aspect(3, 0, 0)] },
                { ...planetDoc(3, 7, 7), aspects: [aspect(7, 0, 0)] },
            ],
        };
        const combined = resolveYogaDoshas(doc);
        expect(combined?.yogas?.map((y) => y.id)).toEqual(["dharmaKarmadhipati"]);
        expect(combined?.yogas?.[0]?.isPresent).toBe(false);
        expect(combined?.doshas?.[0]?.isPresent).toBe(true);
        expect(combined?.doshas?.[0]?.kind).toBe("dosha");
        expect(resolveYogaDoshas(undefined)).toBeUndefined();
    });
});

describe("BI-YD-700: message-key parity for the new namespaces", () => {
    test("identical key sets across en.json ↔ si.json", () => {
        const walk = (obj: unknown, prefix = ""): string[] => {
            if (obj === null || typeof obj !== "object") return [];
            const out: string[] = [];
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                const dotted = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === "object") out.push(...walk(value, dotted));
                else out.push(dotted);
            }
            return out.sort();
        };
        const enKeys = walk(en);
        const siKeys = walk(si);
        for (const namespace of ["yogaDosha", "yoga", "dosha", "yogaStrength", "cancellationStatus", "tradition"]) {
            const enNs = enKeys.filter((k) => k.startsWith(`${namespace}.`) || k === namespace);
            const siNs = siKeys.filter((k) => k.startsWith(`${namespace}.`) || k === namespace);
            expect(siNs).toEqual(enNs);
        }
    });
});

describe("BI-YD-705: search text content resolves catalog names per language", () => {
    test("UT-YD-004d: catalog aliases exist for both ids in both languages", () => {
        expect(catalogAliasesFor("shaniMangala").length).toBeGreaterThan(0);
        expect(catalogAliasesFor("agniMarutha").length).toBeGreaterThan(0);
        expect(catalogAliasesFor("manglik").length).toBeGreaterThan(0);
        expect(catalogAliasesFor("nope")).toEqual([]);
    });

    test("tradition labels exist in both locales", () => {
        expect(en.tradition.MAIN_STREAM).toBe("Mainstream");
        expect(si.tradition.MAIN_STREAM.length).toBeGreaterThan(0);
    });
});
