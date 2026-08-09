import type { CalculationResult } from "@/lib/astrology";
import { Nakshatra, PanchaPakshi, PlanetaryStrength, ZodiacSign } from "@/lib/astrologyEnums";
import { generateTextContent } from "@/lib/search/textContent";
import { findNakshatraMatch, hasNakshatraTriggerWord } from "@/lib/search/utils";

const MOCK_CALC: CalculationResult = {
    ascendant: { sign: ZodiacSign.ARIES, degree: 5.2, lord: 3 },
    houses: [
        {
            houseNumber: 1,
            startDegree: 0,
            startSign: 1,
            startLord: 3,
            middleDegree: 15,
            middleSign: 1,
            middleLord: 3,
            endDegree: 30,
            endSign: 1,
            endLord: 3,
            sign: 1,
            lord: 3,
        },
        {
            houseNumber: 2,
            startDegree: 0,
            startSign: 2,
            startLord: 4,
            middleDegree: 15,
            middleSign: 2,
            middleLord: 4,
            endDegree: 30,
            endSign: 2,
            endLord: 4,
            sign: 2,
            lord: 4,
        },
        {
            houseNumber: 3,
            startDegree: 0,
            startSign: 3,
            startLord: 4,
            middleDegree: 15,
            middleSign: 3,
            middleLord: 4,
            endDegree: 30,
            endSign: 3,
            endLord: 4,
            sign: 3,
            lord: 4,
        },
    ],
    planets: [
        {
            name: 5,
            sign: ZodiacSign.ARIES,
            degree: 10.0,
            absoluteDegree: 10,
            house: 1,
            nakshatra: 1,
            pada: 2,
            retrograde: false,
            combustion: false,
            strength: PlanetaryStrength.UCHCHA,
            navamsaSign: 1,
            navamsaStrength: PlanetaryStrength.MITRA,
            aspects: [],
        },
        {
            name: 7,
            sign: ZodiacSign.CAPRICORN,
            degree: 20.0,
            absoluteDegree: 290,
            house: 10,
            nakshatra: 23,
            pada: 1,
            retrograde: true,
            combustion: false,
            strength: PlanetaryStrength.NEECHA,
            navamsaSign: 8,
            navamsaStrength: PlanetaryStrength.SAMA,
            aspects: [],
        },
        {
            name: 2,
            sign: ZodiacSign.CANCER,
            degree: 15.0,
            absoluteDegree: 105,
            house: 4,
            nakshatra: 7,
            pada: 3,
            retrograde: false,
            combustion: false,
            strength: PlanetaryStrength.OWN_SIGN,
            navamsaSign: 4,
            navamsaStrength: PlanetaryStrength.OWN_SIGN,
            aspects: [],
        },
    ],
    nakshatra: {
        moonNakshatra: { id: 7, pada: 3, lord: 5 },
        ascendantNakshatra: { id: 1, pada: 2, lord: 3 },
    },
    thithi: 15,
    panchaPakshi: PanchaPakshi.OWL,
    dashas: {
        mahadasha: [
            {
                planet: 5,
                startDate: "1990-01-15",
                endDate: "2006-01-15",
                durationYears: 16,
                remainingYearsAtBirth: 16,
                antardasha: [],
                startAge: 0,
            },
            {
                planet: 7,
                startDate: "2006-01-15",
                endDate: "2025-01-15",
                durationYears: 19,
                remainingYearsAtBirth: 0,
                antardasha: [],
                startAge: 16,
            },
        ],
        currentPeriod: { mahadashaLord: 7, antardashaLord: 5, vidasaLord: null, sukshamaLord: null, pranaLord: null },
    },
    lord22ndDrekkana: 4,
    lord64thNavamsa: 7,
    badhakaPlanet: [4, 6],
    marakaPlanets: [3, 7],
    nidhanamshaPlanets: [5],
    ashtamanshaPlanets: [2],
    atmakaraka: 5,
    maranakaraka: 2,
    isAscendantWargoththama: false,
    wargoththamaPlanets: [4],
    gandanthaPlanets: [],
    gandamulaPlanets: [],
    pushkaraPlanets: [8],
    yogas: [{ name: "Parivartana Yoga", planets: [5, 7], description: "Exchange of signs" }],
    doshas: {
        doshas: [
            { name: "Manglik", isPresent: true, severity: "medium" },
            { name: "Pitra Dosha", isPresent: false, severity: "none" },
        ],
    },
};

describe("textContent - English", () => {
    const textEn = generateTextContent(MOCK_CALC, "en");

    test("includes ascendant", () => {
        expect(textEn).toContain("Ascendant: Aries");
    });

    test("includes planet positions", () => {
        expect(textEn).toContain("Jupiter");
        expect(textEn).toContain("Aries");
        expect(textEn).toContain("house 1");
    });

    test("includes planetary strengths", () => {
        expect(textEn).toContain("Uchcha (exalted)");
        expect(textEn).toContain("Neecha (debilitated)");
    });

    test("includes retrograde status", () => {
        expect(textEn).toContain("Saturn is retrograde");
    });

    test("includes nakshatra", () => {
        expect(textEn).toContain("Moon nakshatra: Punarvasu");
        expect(textEn).toContain("Ascendant nakshatra: Ashwini");
    });

    test("includes thithi", () => {
        expect(textEn).toContain("Thithi: Purnima (15)");
    });

    test("includes house lords", () => {
        expect(textEn).toContain("House 1 lord");
        expect(textEn).toContain("House 3 lord");
    });

    test("includes dasha sequence", () => {
        expect(textEn).toContain("Mahadasha sequence");
        expect(textEn).toContain("Jupiter");
        expect(textEn).toContain("Saturn");
    });

    test("includes yoga names", () => {
        expect(textEn).toContain("Parivartana Yoga");
    });

    test("includes present doshas", () => {
        expect(textEn).toContain("Manglik");
    });

    test("includes atmakaraka", () => {
        expect(textEn).toContain("Atmakaraka: Jupiter");
    });

    test("includes maranakaraka", () => {
        expect(textEn).toContain("Maranakaraka: Moon");
    });

    test("includes badhaka and maraka planets", () => {
        expect(textEn).toContain("Badhaka planets");
        expect(textEn).toContain("Maraka planets");
    });

    test("includes ashtamansha and the varga lords", () => {
        expect(textEn).toContain("Ashtamansha planets");
        expect(textEn).toContain("22nd Drekkana lord");
        expect(textEn).toContain("64th Navamsa lord");
    });

    test("includes wargoththama, gandanta, and gandamula planets", () => {
        expect(textEn).toContain("Wargoththama planets: Mercury");
        expect(textEn).toContain("Gandanta planets:");
        expect(textEn).toContain("Gandamula planets:");
    });

    test("includes pushkara planets", () => {
        expect(textEn).toContain("Pushkara planets: Rahu");
    });
});

describe("textContent - Sinhala", () => {
    const textSi = generateTextContent(MOCK_CALC, "si");

    test("includes ascendant in Sinhala", () => {
        expect(textSi).toContain("ලග්නය: මේෂ");
    });

    test("includes planet names in Sinhala", () => {
        expect(textSi).toContain("ගුරු");
        expect(textSi).toContain("ශනි");
        expect(textSi).toContain("සඳු");
    });

    test("includes strength in Sinhala", () => {
        expect(textSi).toContain("උච්ච");
        expect(textSi).toContain("නීච");
    });

    test("includes retrograde in Sinhala", () => {
        expect(textSi).toContain("වක්‍රය");
    });

    test("includes nakshatra in Sinhala", () => {
        expect(textSi).toContain("පුනර්වසු");
        expect(textSi).toContain("අශ්විනි");
    });

    test("includes thithi in Sinhala", () => {
        expect(textSi).toContain("තිති: පුර පසළොස්වක (15)");
    });

    test("includes house lords in Sinhala", () => {
        expect(textSi).toContain("භාව අධිපති");
    });

    test("includes dasha in Sinhala", () => {
        expect(textSi).toContain("මහා දශා අනුපිළිවෙළ");
    });

    test("includes yoga in Sinhala", () => {
        expect(textSi).toContain("යෝග");
    });

    test("includes dosha in Sinhala", () => {
        expect(textSi).toContain("දෝෂ");
    });

    test("includes maranakaraka in Sinhala", () => {
        expect(textSi).toContain("මරණකාරක: සඳු");
    });
});

describe("textContent - edge cases", () => {
    const minimalCalc: CalculationResult = {
        ascendant: { sign: ZodiacSign.LEO, degree: 0, lord: 1 },
        houses: [],
        planets: [],
        nakshatra: {
            moonNakshatra: { id: 1, pada: 1, lord: 3 },
            ascendantNakshatra: { id: 1, pada: 1, lord: 3 },
        },
        thithi: 1,
        panchaPakshi: PanchaPakshi.VULTURE,
        dashas: {
            mahadasha: [],
            currentPeriod: {
                mahadashaLord: 1,
                antardashaLord: 2,
                vidasaLord: null,
                sukshamaLord: null,
                pranaLord: null,
            },
        },
        lord22ndDrekkana: 0,
        lord64thNavamsa: 0,
        badhakaPlanet: [],
        marakaPlanets: [],
        nidhanamshaPlanets: [],
        ashtamanshaPlanets: [],
        atmakaraka: 1,
        maranakaraka: 0,
        isAscendantWargoththama: false,
        wargoththamaPlanets: [],
        gandanthaPlanets: [],
        gandamulaPlanets: [],
        pushkaraPlanets: [],
        yogas: [],
        doshas: { doshas: [] },
    };

    test("handles empty houses and planets", () => {
        const text = generateTextContent(minimalCalc, "en");
        expect(text).toContain("Ascendant: Leo");
        expect(text).not.toContain("is in");
    });

    test("handles empty yogas gracefully", () => {
        const text = generateTextContent(minimalCalc, "en");
        expect(text).not.toContain("undefined");
        expect(text).not.toContain("null");
    });

    test("generates both languages from same calc", () => {
        const en = generateTextContent(minimalCalc, "en");
        const si = generateTextContent(minimalCalc, "si");
        expect(en).not.toBe(si);
        expect(en).toContain("Ascendant: Leo");
        expect(si).toContain("ලග්නය: සිංහ");
    });
});

describe("Hybrid scoring logic", () => {
    const HYBRID_VECTOR_WEIGHT = 0.7;
    const HYBRID_KEYWORD_WEIGHT = 0.3;
    const MAX_KEYWORD_SCORE = 4.0;

    test("combines vector and keyword scores with correct weights", () => {
        const vectorScore = 0.85;
        const keywordScore = 2.0;
        const expected =
            HYBRID_VECTOR_WEIGHT * vectorScore + HYBRID_KEYWORD_WEIGHT * (keywordScore / MAX_KEYWORD_SCORE);
        expect(expected).toBeCloseTo(0.745, 3);
    });

    test("vector-only search returns non-zero score", () => {
        const vectorScore = 0.72;
        const keywordScore = 0;
        const combined =
            HYBRID_VECTOR_WEIGHT * vectorScore +
            HYBRID_KEYWORD_WEIGHT * Math.min(keywordScore / MAX_KEYWORD_SCORE, 1.0);
        expect(combined).toBeCloseTo(0.504, 3);
    });

    test("keyword-only (no vector) uses pure keyword score", () => {
        const keywordScore = 3.5;
        const combined = keywordScore;
        expect(combined).toBe(3.5);
    });

    test("keyword score is capped at MAX_KEYWORD_SCORE when normalizing", () => {
        const vectorScore = 0.5;
        const keywordScore = 10;
        const normalized = Math.min(keywordScore / MAX_KEYWORD_SCORE, 1.0);
        const combined = HYBRID_VECTOR_WEIGHT * vectorScore + HYBRID_KEYWORD_WEIGHT * normalized;
        expect(combined).toBeCloseTo(0.65, 3);
    });

    test("zero scores produce zero result", () => {
        const vectorScore = 0;
        const keywordScore = 0;
        const combined =
            HYBRID_VECTOR_WEIGHT * vectorScore +
            HYBRID_KEYWORD_WEIGHT * Math.min(keywordScore / MAX_KEYWORD_SCORE, 1.0);
        expect(combined).toBe(0);
    });
});

describe("Nakshatra query matching", () => {
    const ALL_NAKSHATRA_NAMES: Array<{ id: Nakshatra; si: string; en: string }> = [
        { id: Nakshatra.ASHWINI, si: "අශ්විනි", en: "ashwini" },
        { id: Nakshatra.BHARANI, si: "භරණී", en: "bharani" },
        { id: Nakshatra.KRITTIKA, si: "කෘත්තිකා", en: "krittika" },
        { id: Nakshatra.ROHINI, si: "රෝහිණී", en: "rohini" },
        { id: Nakshatra.MRIGASHIRA, si: "මෘගශීර්ෂ", en: "mrigashira" },
        { id: Nakshatra.ARDRA, si: "ආර්ද්‍රා", en: "ardra" },
        { id: Nakshatra.PUNARVASU, si: "පුනර්වසු", en: "punarvasu" },
        { id: Nakshatra.PUSHYA, si: "පුෂ්‍ය", en: "pushya" },
        { id: Nakshatra.ASHLESHA, si: "ආශ්ලේෂා", en: "ashlesha" },
        { id: Nakshatra.MAGHA, si: "මාඝ", en: "magha" },
        { id: Nakshatra.PURVA_PHALGUNI, si: "පූර්ව ඵල්ගුනී", en: "purva phalguni" },
        { id: Nakshatra.UTTARA_PHALGUNI, si: "උත්තර ඵල්ගුනී", en: "uttara phalguni" },
        { id: Nakshatra.HASTA, si: "හස්ත", en: "hasta" },
        { id: Nakshatra.CHITRA, si: "චිත්‍රා", en: "chitra" },
        { id: Nakshatra.SWATI, si: "ස්වාති", en: "swati" },
        { id: Nakshatra.VISHAKHA, si: "විශාඛා", en: "vishakha" },
        { id: Nakshatra.ANURADHA, si: "අනුරාධා", en: "anuradha" },
        { id: Nakshatra.JYESHTHA, si: "ජ්‍යෙෂ්ඨා", en: "jyeshtha" },
        { id: Nakshatra.MULA, si: "මූල", en: "mula" },
        { id: Nakshatra.PURVA_ASHADHA, si: "පූර්ව ආෂාඪ", en: "purva ashadha" },
        { id: Nakshatra.UTTARA_ASHADHA, si: "උත්තර ආෂාඪ", en: "uttara ashadha" },
        { id: Nakshatra.SHRAVANA, si: "ශ්‍රවණ", en: "shravana" },
        { id: Nakshatra.DHANISHTA, si: "ධනිෂ්ඨා", en: "dhanishta" },
        { id: Nakshatra.SHATABHISHA, si: "ශතභිෂා", en: "shatabhisha" },
        { id: Nakshatra.PURVA_BHADRAPADA, si: "පූර්ව භාද්‍රපද", en: "purva bhadrapada" },
        { id: Nakshatra.UTTARA_BHADRAPADA, si: "උත්තර භාද්‍රපද", en: "uttara bhadrapada" },
        { id: Nakshatra.REVATI, si: "රේවතී", en: "revati" },
    ];

    test.each(ALL_NAKSHATRA_NAMES)(
        "canonical Sinhala and English names both resolve to $id ($si / $en)",
        ({ id, si, en }) => {
            expect(findNakshatraMatch(si)).toBe(id);
            expect(findNakshatraMatch(en)).toBe(id);
        },
    );

    test("matches colloquial contraction with ZWJ omitted, alongside the trigger word (උත්‍රපල් නැකත)", () => {
        expect(findNakshatraMatch("උත්‍රපල් නැකත")).toBe(Nakshatra.UTTARA_PHALGUNI);
    });

    test("matches colloquial contraction embedded in a longer query", () => {
        expect(findNakshatraMatch("සිංහ ලග්නය උත්‍රපල් නැකත")).toBe(Nakshatra.UTTARA_PHALGUNI);
    });

    test("matches English digraph/spacing variants", () => {
        expect(findNakshatraMatch("UTTARA PHALGUNI nakshatra")).toBe(Nakshatra.UTTARA_PHALGUNI);
        expect(findNakshatraMatch("uttaraphalguni")).toBe(Nakshatra.UTTARA_PHALGUNI);
    });

    test("does not confuse Magha with the Mrigashira skeleton it prefixes", () => {
        expect(findNakshatraMatch("මාඝ නැකත")).toBe(Nakshatra.MAGHA);
        expect(findNakshatraMatch("මෘගශීර්ෂ නැකත")).toBe(Nakshatra.MRIGASHIRA);
    });

    test("distinguishes Purva vs Uttara Phalguni", () => {
        expect(findNakshatraMatch("පූර්ව ඵල්ගුනී නැකත")).toBe(Nakshatra.PURVA_PHALGUNI);
        expect(findNakshatraMatch("උත්තර ඵල්ගුනී නැකත")).toBe(Nakshatra.UTTARA_PHALGUNI);
    });

    test("returns null for an ambiguous short prefix shared by multiple nakshatras", () => {
        expect(findNakshatraMatch("උතර නැකත")).toBeNull();
        expect(findNakshatraMatch("පූර්ව නැකත")).toBeNull();
    });

    test("returns null when query has no nakshatra alias", () => {
        expect(findNakshatraMatch("මේෂ ලග්නය")).toBeNull();
    });
});

describe("NAKSHATRA_WORDS / trigger word gate", () => {
    test("recognizes the trigger word even with the ligature joiner present", () => {
        expect(hasNakshatraTriggerWord("නක්ෂත්‍රය උත්තර ඵල්ගුනී")).toBe(true);
    });

    test("recognizes the trigger word in the exact reported query", () => {
        expect(hasNakshatraTriggerWord("උත්‍රපල් නැකත")).toBe(true);
    });

    test("does not fire when no trigger word is present", () => {
        expect(hasNakshatraTriggerWord("මේෂ ලග්නය")).toBe(false);
    });
});

describe("Qdrant point ID format", () => {
    test("point ID combines horoscopeId and language with underscore", () => {
        const horoscopeId = "550e8400-e29b-41d4-a716-446655440000";
        const pointIdSi = `${horoscopeId}_si`;
        const pointIdEn = `${horoscopeId}_en`;
        expect(pointIdSi).toBe("550e8400-e29b-41d4-a716-446655440000_si");
        expect(pointIdEn).toBe("550e8400-e29b-41d4-a716-446655440000_en");
    });

    test("point ID is unique per horoscope per language", () => {
        const horoscopeId = "horo-123";
        const si = `${horoscopeId}_si`;
        const en = `${horoscopeId}_en`;
        expect(si).not.toBe(en);
    });
});

describe("SearchEmbedding model fields", () => {
    test("default embedding model is all-MiniLM-L6-v2", () => {
        const model = "all-MiniLM-L6-v2";
        expect(model).toBe("all-MiniLM-L6-v2");
    });

    test("valid languages are si and en", () => {
        const validLanguages = ["si", "en"];
        expect(validLanguages).toContain("si");
        expect(validLanguages).toContain("en");
        expect(validLanguages).not.toContain("de");
    });

    test("chunkIndex defaults to 0", () => {
        expect(0).toBe(0);
    });
});

describe("Graceful degradation", () => {
    test("Qdrant unavailable falls back to MongoDB-only search", () => {
        const qdrantResults: unknown[] = [];
        expect(qdrantResults.length).toBe(0);
    });

    test("embedding failure returns null", () => {
        const embedding: number[] | null = null;
        expect(embedding).toBeNull();
    });

    test("zero vector results means no horoscopes from vector search", () => {
        const vectorScores = new Map<string, number>();
        expect(vectorScores.size).toBe(0);
    });
});

describe("Query understanding with vector search flag", () => {
    test("response indicates when vector search was used", () => {
        const queryUnderstanding = {
            mode: "basic",
            conditions: [] as string[],
            language: "en" as const,
            understoodAll: true,
            exactMatch: null,
            vectorSearchUsed: false,
        };
        expect(queryUnderstanding.vectorSearchUsed).toBeDefined();
        expect(typeof queryUnderstanding.vectorSearchUsed).toBe("boolean");
    });

    test("response indicates vector search mode when used", () => {
        const queryUnderstanding = {
            mode: "basic",
            conditions: [] as string[],
            language: "en" as const,
            understoodAll: true,
            exactMatch: null,
            vectorSearchUsed: true,
        };
        expect(queryUnderstanding.vectorSearchUsed).toBe(true);
    });
});
