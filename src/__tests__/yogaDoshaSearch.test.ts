/**
 * Yoga / Dosha separated tags — search-layer + text-content tests.
 * QA plan: specs/qa/20260906-0837-yoga-dosha-tags-test-plan.md (SR-YD-800..805, RE-YD-870..875,
 * IT-YD-820, BI-YD-700).
 * Mirrors the mock pattern of search-bhava-suchika.test.ts (embedding + qdrant mocks are mandatory
 * because the route calls generateEmbedding on every POST).
 */
import { getServerSession } from "next-auth";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { calculateHoroscope } from "@/lib/calculation";
import { buildChartFacts, computeYogaDoshas, YOGA_DOSHA_VERSION } from "@/lib/yogaDosha/ruleEngine";
import { getTextForBothLanguages } from "@/lib/search/textContent";
import { vocabularySkeleton, YOGA_DOSHA_NAME_WORDS } from "@/lib/search/vocabulary";
import { DOSHA_CATALOG, YOGA_CATALOG } from "@/lib/yogaDosha/catalog";

jest.mock("@/models/Horoscope", () => ({
    Horoscope: { findById: jest.fn(), find: jest.fn() },
}));

jest.mock("@/models/CalculatedDetails", () => ({
    CalculatedDetails: {
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    },
}));

jest.mock("@/models/Chart", () => ({
    Chart: {
        find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    connectDB: jest.fn(),
}));

jest.mock("@/lib/search/embedding", () => ({
    generateEmbedding: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/search/qdrant", () => ({
    ensureCollection: jest.fn().mockResolvedValue(false),
    searchPoints: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
}));

const mockGetServerSession = getServerSession as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("search: Yoga/Dosha catalog names (SR-YD-800..805)", () => {
    async function search(query: string) {
        mockGetServerSession.mockResolvedValue({ user: { id: "owner-1", role: "student" } });

        const { POST } = await import("@/app/api/search/route");

        const req = {
            json: jest.fn().mockResolvedValue({ query }),
        };

        return POST(req as never);
    }

    const makeHoroscope = (overrides: Record<string, unknown> = {}) => ({
        _id: "horo-1",
        id: "horo-1",
        name: "John Doe",
        owner: { id: "owner-1" },
        displayName: true,
        isPublic: true,
        ...overrides,
    });

    const withCalculated = (calc: Record<string, unknown>) => {
        (Horoscope.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([makeHoroscope()]),
        });
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(calc),
        });
        (Chart.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
    };

    /** Fact-planets for a present Shani-Mangala conjunction (Saturn + Mars, house 7 / sign 7). */
    const saturnMarsConjunctPlanets = () => [
        { name: 7, sign: 7, house: 7, degree: 15, absoluteDegree: 195, strength: PlanetaryStrength.SAMA, navamsaSign: 7, navamsaStrength: PlanetaryStrength.SAMA, nakshatra: 14, aspects: [{ planetName: 3, aspectType: 0, degreeGap: 0 }] },
        { name: 3, sign: 7, house: 7, degree: 15, absoluteDegree: 195, strength: PlanetaryStrength.SAMA, navamsaSign: 7, navamsaStrength: PlanetaryStrength.SAMA, nakshatra: 14, aspects: [{ planetName: 7, aspectType: 0, degreeGap: 0 }] },
    ];

    /** Engine result for a present Shani-Mangala conjunction fixture (house 7), stored shape. */
    const presentShaniMangalaFixture = () => {
        const result = computeYogaDoshas(
            buildChartFacts({
                ascendantSign: 1,
                source: "auto",
                planets: saturnMarsConjunctPlanets(),
            }),
        );
        expect(result.yogas).toEqual([]);
        expect(result.doshas[0].isPresent).toBe(true);
        expect(result.doshas[0].id).toBe("shaniMangala");
        return {
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: result.yogas,
            doshas: { doshas: result.doshas },
        };
    };

    const presentManglikFixture = () => [
        {
            id: "manglik",
            kind: "dosha",
            isPresent: true,
            tradition: "MAIN_STREAM",
            formation: {
                rulesTriggered: ["manglik.mk01"],
                primaryRule: "manglik.mk01",
                strength: 2,
                reasons: [{ rule: "manglik.mk01", reasonKey: "rule.mk01", params: { house: 7 } }],
            },
            context: { houseImpact: [7] },
            interpretation: { themes: [{ key: "theme.house7", params: { house: 7 } }] },
            mitigation: [],
            cancellation: { status: 1, factors: [] },
            finalAssessment: { severity: 2, expressionKeys: ["expression.partnershipStress"] },
        },
    ];

    test("SR-YD-800: catalog name 'ශනි කුජ' + trigger word resolves a dosha_id exact match", async () => {
        const fixture = presentShaniMangalaFixture();
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...fixture });
        const response = await search("ශනි කුජ යෝග");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "shaniMangala",
        });
    });

    test("SR-YD-801: a stored isPresent:false dosha never matches the id condition", async () => {
        const fixture = presentShaniMangalaFixture();
        const absent = {
            ...fixture,
            doshas: { doshas: fixture.doshas.doshas.map((d) => ({ ...d, isPresent: false })) },
        };
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...absent });
        const response = await search("ශනි කුජ යෝග");
        const body = await response.json();

        expect(body.results).toHaveLength(0);
    });

    test("SR-YD-802/323: EN alias 'shani-mangala yoga' matches the dosha — 'Mangal' must NOT fire manglik", async () => {
        const fixture = presentShaniMangalaFixture();
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...fixture });
        const response = await search("shani-mangala yoga");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        const conditions = body.queryUnderstanding.exactMatch.flat(Infinity) as Array<Record<string, unknown>>;
        // Name-collision precedence (SR-YD-323): the full catalog name wins over the substring
        // "mangal", so a doc WITHOUT a present manglik dosha must still match.
        expect(conditions).toContainEqual({ type: "dosha_id", doshaId: "shaniMangala" });
        expect(conditions).not.toContainEqual({ type: "dosha_id", doshaId: "manglik" });
    });

    test("SR-YD-803: 'මංගල දෝෂ' resolves a dosha_id exact match only for present doshas", async () => {
        const doshaFixture = presentManglikFixture();
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: [],
            doshas: { doshas: doshaFixture },
        });
        const response = await search("මංගල දෝෂ");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "manglik",
        });

        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: [],
            doshas: { doshas: doshaFixture.map((d) => ({ ...d, isPresent: false })) },
        });
        const absentResponse = await search("මංගල දෝෂ");
        expect((await absentResponse.json()).results).toHaveLength(0);
    });

    test("SR-YD-804/RE-YD-870: privacy untouched — another user's private chart with a present dosha never returned", async () => {
        const fixture = presentShaniMangalaFixture();
        const docs = [makeHoroscope({ _id: "a", id: "a", owner: { id: "other-1" }, isPublic: false })];
        (Horoscope.find as jest.Mock).mockImplementation((filter: unknown) => ({
            lean: jest.fn().mockResolvedValue(
                docs.filter((h) =>
                    (filter as { $or: Array<Record<string, boolean | string>> }).$or.some(
                        (c) =>
                            (c["owner.id"] === "owner-1" && h.owner.id === "owner-1") || (c.isPublic && h.isPublic),
                    ),
                ),
            ),
        }));
        (CalculatedDetails.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ ascendant: { sign: 4, degree: 4.76 }, ...fixture }),
        });
        (Chart.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const response = await search("ශනි කුජ යෝග");
        const body = await response.json();

        expect(Horoscope.find).toHaveBeenCalledWith({
            $or: [{ "owner.id": "owner-1" }, { isPublic: true }],
        });
        expect(body.results).toHaveLength(0);
    });

    test("SR-YD-805: generic trigger without a catalog name stays in keyword scoring", async () => {
        const fixture = presentShaniMangalaFixture();
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...fixture });
        const response = await search("දෝෂ ශනි");
        const body = await response.json();

        const exactMatch = body.queryUnderstanding.exactMatch.flat(Infinity);
        expect(exactMatch).not.toContainEqual({ type: "dosha_id", doshaId: "shaniMangala" });
        // "ශනි"/"දෝෂ" alone are not registered catalog words → only the generic dosha trigger scores.
        expect(body.results).toHaveLength(1);
    });

    test("SR-YD-808: legacy discovery doc (no stored evaluations, no version) matches by dosha name via render-time recompute", async () => {
        // A pre-feature doc: chart facts stored, but no `yogas`/`doshas`/`yogaDoshaVersion`.
        // The detail panel shows the Shani Mangala Dosha tag because resolveDoshas recomputes —
        // search must agree with the rendered view.
        withCalculated({ ascendant: { sign: 1 }, planets: saturnMarsConjunctPlanets() });
        const response = await search("shani mangala");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "shaniMangala",
        });

        // A legacy doc WITHOUT the formation must stay excluded (no false positives).
        withCalculated({
            ascendant: { sign: 1 },
            planets: saturnMarsConjunctPlanets().map((p, i) => ({ ...p, sign: i === 0 ? 10 : 6, house: i === 0 ? 10 : 6 })),
        });
        const absentResponse = await search("shani mangala");
        expect((await absentResponse.json()).results).toHaveLength(0);
    });

    test("SR-YD-809: v1 stored doc (shaniMangala carried inside yogas) recomputes to the dosha view and matches by name", async () => {
        // Pre-reclassification (v1) docs stored shaniMangala under `yogas`; version-downgraded
        // stored shapes are ignored by resolve and re-derived, exactly like the render path.
        const factPlanets = saturnMarsConjunctPlanets();
        withCalculated({
            ascendant: { sign: 1 },
            planets: factPlanets,
            yogaDoshaVersion: 1,
            yogas: [{ id: "shaniMangala", isPresent: true }],
            doshas: { doshas: [] },
        });
        const response = await search("shani mangala");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        expect(body.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "shaniMangala",
        });
    });

    test("SR-YD-810: 'ශනි මංගල දෝෂය' — 'මංගල' inside the dosha name must NOT also fire a manglik condition", async () => {
        // The manglik keyword "මංගල" is a boundary-separated substring of the Shani Mangala
        // name. Longest-span precedence must drop it, otherwise the ANDed conditions demand a
        // present manglik the chart does not have and the result is wrongly excluded.
        const fixture = presentShaniMangalaFixture();
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...fixture });
        const response = await search("ශනි මංගල දෝෂය");
        const body = await response.json();

        expect(body.results).toHaveLength(1);
        const conditions = body.queryUnderstanding.exactMatch.flat(Infinity) as Array<Record<string, unknown>>;
        expect(conditions).toContainEqual({ type: "dosha_id", doshaId: "shaniMangala" });
        expect(conditions).not.toContainEqual({ type: "dosha_id", doshaId: "manglik" });
        // A bare manglik name must still resolve on its own.
        const manglikFixture = presentManglikFixture();
        withCalculated({
            ascendant: { sign: 4, degree: 4.76 },
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: [],
            doshas: { doshas: manglikFixture },
        });
        const mango = await search("මංගල");
        const mangoBody = await mango.json();
        expect(mangoBody.results).toHaveLength(1);
        expect(mangoBody.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "manglik",
        });
    });

    test("SR-YD-811: Agni Marutha resolves as its own dosha — AM-only charts must NOT match Shani Mangala", async () => {
        // Parivartana (sign exchange): Shani Mangala is FALSE (none of SM-1/2/3), Agni Marutha is
        // TRUE via am08 (plus am04/am05 sign ownership) — the doc's central distinction.
        const amOnly = computeYogaDoshas(
            buildChartFacts({
                ascendantSign: 1,
                source: "auto",
                planets: [
                    // Sign exchange (Saturn in Aries / Mars in Capricorn) on a 2/12 house placement —
                    // NOT a 4-10 or 7th pair, so Shani Mangala stays false while AM-04/05/08 fire.
                    { name: 7, sign: 1, house: 1, degree: 15, absoluteDegree: 15, strength: PlanetaryStrength.SAMA, navamsaSign: 1, navamsaStrength: PlanetaryStrength.SAMA, nakshatra: 5, aspects: [] },
                    { name: 3, sign: 10, house: 3, degree: 15, absoluteDegree: 75, strength: PlanetaryStrength.SAMA, navamsaSign: 10, navamsaStrength: PlanetaryStrength.SAMA, nakshatra: 8, aspects: [] },
                ],
            }),
        );
        expect(amOnly.doshas[0].isPresent).toBe(false);
        expect(amOnly.doshas.find((d) => d.id === "agniMarutha")?.isPresent).toBe(true);
        const fixture = {
            yogaDoshaVersion: YOGA_DOSHA_VERSION,
            yogas: amOnly.yogas,
            doshas: { doshas: amOnly.doshas },
        };
        withCalculated({ ascendant: { sign: 4, degree: 4.76 }, ...fixture });

        const amResponse = await search("අග්නි මාරුත දෝෂය");
        const amBody = await amResponse.json();
        expect(amBody.results).toHaveLength(1);
        expect(amBody.queryUnderstanding.exactMatch.flat(Infinity)).toContainEqual({
            type: "dosha_id",
            doshaId: "agniMarutha",
        });

        const enResponse = await search("agni marutha");
        expect((await enResponse.json()).results).toHaveLength(1);

        // The AM-only chart must NOT be surfaced by a Shani Mangala name query.
        const smResponse = await search("shani mangala");
        expect((await smResponse.json()).results).toHaveLength(0);
    });
});

describe("search text content (SR-YD-806..807, BI-YD-700)", () => {
    // 2018-04-02 Colombo lahiri: Saturn conjunct Mars in Libra (0.2° orb) — a genuinely
    // PRESENT Shani-Mangala (sm01 conjunction + sm02 mutual drishti).
    const baseCalculation = () =>
        calculateHoroscope({
            birthDate: "2018-04-02",
            birthTime: "12:00",
            birthPlace: "Colombo",
            latitude: 6.9271,
            longitude: 79.8612,
            timezone: "Asia/Colombo",
            ayanamsa: "lahiri",
        });

    test("SR-YD-806: EN text content names doshas via catalog display names", () => {
        const en = getTextForBothLanguages(baseCalculation());
        // A conjunct pair is both the narrow Shani Mangala Dosha and the broad Agni Marutha Dosha.
        // Mars in the 7th from Lagna adds the active Kuja (Manglik) dosha.
        expect(en.en).toContain("Doshas: Shani Mangala Dosha, Agni Marutha Dosha, Kuja Dosha.");
    });

    test("SR-YD-807: SI text content uses the Sinhala catalog names", () => {
        const { si } = getTextForBothLanguages(baseCalculation());
        expect(si).toContain("දෝෂ: ශනි මංගල දෝෂය, අග්නි මාරුත දෝෂය, කුජ දෝෂය.");
    });

    test("BI-YD-700: absent doshas are never listed in the snippet (no false claims)", () => {
        // 1990-06-15: Saturn (Capricorn) and Mars (Pisces) are ~77° apart — no Shani-Mangala.
        const en = getTextForBothLanguages(
            calculateHoroscope({
                birthDate: "1990-06-15",
                birthTime: "08:30",
                birthPlace: "Colombo",
                latitude: 6.9271,
                longitude: 79.8612,
                timezone: "Asia/Colombo",
                ayanamsa: "lahiri",
            }),
        );
        expect(en.en).not.toContain("Doshas: Shani Mangala Dosha.");
        expect(en.en).not.toContain("Shani Mangala");
    });
});

describe("vocabulary lock-step (UT-YD-004d extension)", () => {
    test("every catalog keyword + alias maps to its catalog id after skeleton folding", () => {
        const expectations: Array<[string, string]> = [];
        for (const entry of [...YOGA_CATALOG, ...DOSHA_CATALOG]) {
            for (const word of ["keywordEn", "keywordSi"] as const) {
                expectations.push([word === "keywordEn" ? entry.keywordEn : entry.keywordSi, entry.id]);
            }
            for (const alias of [...entry.searchAliasesEn, ...entry.searchAliasesSi]) {
                expectations.push([alias, entry.id]);
            }
        }
        expect(expectations.length).toBeGreaterThan(0);
        for (const [word, id] of expectations) {
            const key = vocabularySkeleton(word);
            expect(key.length).toBeGreaterThan(0);
            expect(YOGA_DOSHA_NAME_WORDS[key]).toBe(id);
        }
    });

    test("non-catalog words are absent from the yoga/dosha vocabulary", () => {
        for (const word of ["සූර්ය", "जupiter", "venus yoga"]) {
            expect(YOGA_DOSHA_NAME_WORDS[vocabularySkeleton(word)]).toBeUndefined();
        }
    });
});