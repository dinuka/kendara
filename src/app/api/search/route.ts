import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { PLANET_NAMES, PlanetaryStrength, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";
import { generateEmbedding } from "@/lib/search/embedding";
import { ensureCollection, searchPoints } from "@/lib/search/qdrant";
import { detectLanguage, findNakshatraMatch, hasNakshatraTriggerWord, paginateResults } from "@/lib/search/utils";
import {
    ASCENDANT_WORDS,
    DOSHA_WORDS,
    ENGLISH_YOGA,
    SINHALA_YOGA,
} from "@/lib/search/vocabulary";

type ExactMatch =
    | { type: "ascendant"; sign: number }
    | { type: "planet_in_house"; planet: number; house: number }
    | { type: "nakshatra"; nakshatra: number }
    | { type: "planet_strength"; planet: number; strength: PlanetaryStrength }
    | null;

const getStrengthMatch = (query: string): PlanetaryStrength | null => {
    const q = query.toLowerCase();

    const matched = new Set<PlanetaryStrength>();
    for (const [word, strength] of Object.entries(STRENGTH_LABELS)) {
        if (q.includes(word)) {
            matched.add(strength);
        }
    }

    if (matched.has(PlanetaryStrength.ATHI_UCHCHA)) return PlanetaryStrength.ATHI_UCHCHA;
    if (matched.has(PlanetaryStrength.UCHCHA)) return PlanetaryStrength.UCHCHA;
    if (matched.has(PlanetaryStrength.ATHI_NEECHA)) return PlanetaryStrength.ATHI_NEECHA;
    if (matched.has(PlanetaryStrength.NEECHA)) return PlanetaryStrength.NEECHA;
    if (matched.has(PlanetaryStrength.MOOLATRIKONA)) return PlanetaryStrength.MOOLATRIKONA;
    if (matched.has(PlanetaryStrength.OWN_SIGN)) return PlanetaryStrength.OWN_SIGN;
    if (matched.has(PlanetaryStrength.MITRA)) return PlanetaryStrength.MITRA;
    if (matched.has(PlanetaryStrength.SHATRU)) return PlanetaryStrength.SHATRU;
    if (matched.has(PlanetaryStrength.SAMA)) return PlanetaryStrength.SAMA;

    return null;
};

const STRENGTH_KEYWORD_MAP: Record<number, string> = {
    [PlanetaryStrength.ATHI_UCHCHA]: "athi_uchcha",
    [PlanetaryStrength.UCHCHA]: "exaltation",
    [PlanetaryStrength.ATHI_NEECHA]: "athi_neecha",
    [PlanetaryStrength.NEECHA]: "debilitation",
    [PlanetaryStrength.MOOLATRIKONA]: "moolatrikona",
    [PlanetaryStrength.OWN_SIGN]: "own_sign",
    [PlanetaryStrength.MITRA]: "mitra",
    [PlanetaryStrength.SHATRU]: "shatru",
    [PlanetaryStrength.SAMA]: "sama",
};

const getStrengthValue = (strength: unknown): number => {
    if (typeof strength === "number") return strength;
    const map: Record<string, number> = {
        AthiUchcha: 1.25, Uchcha: 1, Neecha: -1, AthiNeecha: -1.25,
        Moolatrikona: 0.75, OwnSign: 0.5, Mitra: 0.1, Shatru: -0.1, Sama: 0,
    };
    return map[strength as string] ?? 0;
};

const getPlanetMatches = (query: string): number[] => {
    const q = query.toLowerCase();
    const planets = new Set<number>();

    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            planets.add(planetValue);
        }
    }

    return [...planets];
};

const getExactMatch = (query: string): ExactMatch => {
    const q = query.toLowerCase();

    if (hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            return { type: "nakshatra", nakshatra: nakshatraValue };
        }
    }

    const strengthMatch = getStrengthMatch(query);
    if (strengthMatch !== null) {
        const planetMatches = getPlanetMatches(query);
        if (planetMatches.length === 1) {
            return { type: "planet_strength", planet: planetMatches[0], strength: strengthMatch };
        }
    }

    const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(w));

    if (hasAscendantWord) {
        for (const [word, signValue] of Object.entries(ZODIAC_SIGN_NAMES)) {
            if (q.includes(word.toLowerCase())) {
                return { type: "ascendant", sign: signValue };
            }
        }

        for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
            if (q.includes(word.toLowerCase())) {
                return { type: "planet_in_house", planet: planetValue, house: 1 };
            }
        }
    }

    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            const numMatch = q.match(new RegExp(`${word.toLowerCase()}\\s+(\\d+)`));
            if (numMatch) {
                const house = parseInt(numMatch[1], 10);
                if (house >= 1 && house <= 12) {
                    return { type: "planet_in_house", planet: planetValue, house };
                }
            }
        }
    }

    return null;
};

const getAstroKeywords = (query: string): string[] => {
    const q = query.toLowerCase();
    const keywords: string[] = [];

    if (hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            keywords.push(`nakshatra:${nakshatraValue}`);
        }
    }

    for (const [word] of Object.entries(ZODIAC_SIGN_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            keywords.push(`sign:${word}`);
        }
    }

    for (const [word] of Object.entries(PLANET_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            keywords.push(`planet:${word}`);
        }
    }

    const strengthMatch = getStrengthMatch(query);
    if (strengthMatch !== null) {
        const strengthLabel = STRENGTH_KEYWORD_MAP[strengthMatch] || "unknown";
        const planetMatches = getPlanetMatches(query);
        if (planetMatches.length > 0) {
            for (const planetValue of planetMatches) {
                const planetWord = Object.entries(PLANET_NAMES).find(([, v]) => v === planetValue)?.[0];
                keywords.push(`strength:${strengthLabel}:${planetWord}`);
            }
        } else {
            keywords.push(`strength:${strengthLabel}`);
        }
    }

    for (const w of SINHALA_YOGA) {
        if (q.includes(w)) {
            keywords.push("yoga");
            break;
        }
    }

    for (const w of ENGLISH_YOGA) {
        if (q.includes(w)) {
            keywords.push("yoga");
            break;
        }
    }

    for (const w of ASCENDANT_WORDS) {
        if (q.includes(w)) {
            keywords.push("ascendant");
            break;
        }
    }

    for (const w of DOSHA_WORDS) {
        if (q.includes(w)) {
            keywords.push("dosha");
            break;
        }
    }

    return [...new Set(keywords)];
};

const scoreHoroscope = (
    h: Record<string, unknown>,
    query: string,
    calculatedDetails: Record<string, unknown> | null,
): { score: number; matchedConditions: string[] } => {
    let score = 0;
    const q = query.toLowerCase();
    const matchedConditions: string[] = [];

    if (hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null && calculatedDetails?.nakshatra) {
            const nakshatra = calculatedDetails.nakshatra as Record<string, unknown>;
            const moonNakshatra = nakshatra.moonNakshatra as Record<string, unknown> | undefined;
            const ascendantNakshatra = nakshatra.ascendantNakshatra as Record<string, unknown> | undefined;

            if (moonNakshatra?.id === nakshatraValue) {
                score += 1.0;
                matchedConditions.push(`moon_nakshatra=${nakshatraValue}`);
            }

            if (ascendantNakshatra?.id === nakshatraValue) {
                score += 0.5;
                matchedConditions.push(`ascendant_nakshatra=${nakshatraValue}`);
            }
        }
    }

    for (const [word, signValue] of Object.entries(ZODIAC_SIGN_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            if (calculatedDetails?.ascendant) {
                const asc = calculatedDetails.ascendant as Record<string, unknown>;
                if (asc.sign === signValue) {
                    score += 1.0;
                    matchedConditions.push(`ascendant=${word}`);
                }
            }

            if (calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.sign === signValue) {
                        score += 0.3;
                        matchedConditions.push(`planet_in_sign=${p.name}_${word}`);
                    }
                }
            }
        }
    }

    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        if (q.includes(word.toLowerCase())) {
            if (calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.name === planetValue) {
                        score += 0.3;

                        const signName = Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === p.sign)?.[0] || p.sign;
                        matchedConditions.push(`${word}_in_sign=${signName}_house=${p.house}`);
                    }
                }
            }
        }
    }

    const namedPlanets = getPlanetMatches(query);
    const matchesNamedPlanet = (planetValue: unknown): boolean =>
        namedPlanets.length === 0 || namedPlanets.includes(planetValue as number);

    const strengthMatch = getStrengthMatch(query);

    if (strengthMatch !== null && calculatedDetails?.planets) {
        const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
        const strengthLabel = STRENGTH_KEYWORD_MAP[strengthMatch] || "unknown";
        for (const p of planets) {
            if (getStrengthValue(p.strength) === strengthMatch && matchesNamedPlanet(p.name)) {
                score += 0.5;
                const planetName = Object.entries(PLANET_NAMES).find(([, v]) => v === p.name)?.[0] || p.name;
                matchedConditions.push(`${planetName}=${strengthLabel}`);
            }
        }
    }

    const hasYoga = SINHALA_YOGA.some((w) => q.includes(w)) || ENGLISH_YOGA.some((w) => q.includes(w));

    if (hasYoga) {
        if (calculatedDetails?.yogas) {
            const yogas = calculatedDetails.yogas as Array<Record<string, unknown>>;
            if (yogas.length > 0) {
                score += 0.4;
                matchedConditions.push(`yoga_present=${yogas.length}_yogas`);
            }
        }
    }

    const hasDosha = q.includes("දෝෂ") || q.includes("dosha") || q.includes("මංගල");

    if (hasDosha) {
        if (calculatedDetails?.doshas) {
            const doshas = calculatedDetails.doshas as Record<string, unknown>;
            const doshaList = doshas.doshas as Array<Record<string, unknown>> | undefined;
            if (doshaList && doshaList.length > 0) {
                score += 0.4;
                for (const d of doshaList) {
                    if (d.isPresent) {
                        matchedConditions.push(`dosha=${d.name}`);
                    }
                }
            }
        }
    }

    const houseMatch = q.match(/(\d+)\s*(?:වන\s*)?(?:\bභාව\b|\bhouse\b|\bst\b|\bnd\b|\brd\b|\bth\b)/i);
    if (houseMatch) {
        const houseNum = parseInt(houseMatch[1], 10);
        if (houseNum >= 1 && houseNum <= 12) {
            const planetMatch = Object.entries(PLANET_NAMES).find(([word]) => q.includes(word.toLowerCase()));
            if (planetMatch && calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.name === planetMatch[1] && p.house === houseNum) {
                        score += 0.6;
                        matchedConditions.push(`${planetMatch[0]}_in_house=${houseNum}`);
                    }
                }
            }
        }
    }

    return { score: +score.toFixed(2), matchedConditions };
};

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        logger.warn("unauthorized search attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { query } = body;
    const page = Math.max(1, parseInt(body.page || "1", 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(body.pageSize || "5", 10) || 5), 20);

    if (!query || typeof query !== "string") {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.length > 500) {
        return NextResponse.json({ error: "Query exceeds maximum length of 500 characters." }, { status: 400 });
    }

    logger.info("search query: %s (page=%d, pageSize=%d)", query, page, pageSize);

    const detectedLanguage = detectLanguage(query);
    const keywords = getAstroKeywords(query);
    const exactMatch = getExactMatch(query);

    const userId = session.user.id;
    const userRole = session.user.role;

    const horoscopes = await Horoscope.find({
        $or: [{ "owner.id": userId }, { isPublic: true }],
    }).lean();

    logger.debug("searching through %d horoscopes", horoscopes.length);

    const horoscopeIdToDoc = new Map(horoscopes.map((h) => [h._id.toString(), h]));

    let vectorScores: Map<string, number> = new Map();
    let vectorSearchUsed = false;

    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding) {
        const collectionReady = await ensureCollection();
        if (collectionReady) {
            const qdrantResults = await searchPoints(queryEmbedding, userId, 100);
            if (qdrantResults.length > 0) {
                vectorSearchUsed = true;
                for (const r of qdrantResults) {
                    const existing = vectorScores.get(r.horoscopeId) ?? 0;
                    if (r.score > existing) {
                        vectorScores.set(r.horoscopeId, r.score);
                    }
                }
            }
        }
    }

    const scoredResults = [];

    for (const h of horoscopes) {
        const hId = h._id.toString();

        if (exactMatch?.type === "ascendant") {
            const calculatedDetails = await CalculatedDetails.findOne({
                "horoscope.id": hId,
            }).lean();
            const asc = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
            if (!asc || asc.sign !== exactMatch.sign) continue;
        }

        if (exactMatch?.type === "planet_in_house") {
            const calculatedDetails = await CalculatedDetails.findOne({
                "horoscope.id": hId,
            }).lean();
            const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
            if (!planets) continue;
            const matched = planets.some((p) => p.name === exactMatch.planet && p.house === exactMatch.house);
            if (!matched) continue;
        }

        if (exactMatch?.type === "nakshatra") {
            const calculatedDetails = await CalculatedDetails.findOne({
                "horoscope.id": hId,
            }).lean();
            const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
            const moonNakshatra = nakshatra?.moonNakshatra as Record<string, unknown> | undefined;
            if (!moonNakshatra || moonNakshatra.id !== exactMatch.nakshatra) continue;
        }

        if (exactMatch?.type === "planet_strength") {
            const calculatedDetails = await CalculatedDetails.findOne({
                "horoscope.id": hId,
            }).lean();
            const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
            if (!planets) continue;
            const matched = planets.some((p) => {
                if (p.name !== exactMatch.planet) return false;
                return getStrengthValue(p.strength) === exactMatch.strength;
            });
            if (!matched) continue;
        }

        const calculatedDetails = await CalculatedDetails.findOne({
            "horoscope.id": hId,
        }).lean();

        const { score: keywordScore, matchedConditions } = scoreHoroscope(
            h as unknown as Record<string, unknown>,
            query,
            calculatedDetails as unknown as Record<string, unknown> | null,
        );

        if (keywordScore <= 0 && !vectorScores.has(hId)) continue;

        const vectorScore = vectorScores.get(hId) ?? 0;

        const combinedScore = vectorSearchUsed
            ? +(0.7 * vectorScore + 0.3 * Math.min(keywordScore / 4.0, 1.0)).toFixed(3)
            : +keywordScore.toFixed(2);

        if (combinedScore <= 0.01 && !vectorSearchUsed) continue;

        const charts = await Chart.find({
            "horoscope.id": hId,
        }).lean();

        const isOwner = h.owner.id === userId;
        const name = isOwner || h.displayName ? h.name : getAnonymousPlaceholder(hId);

        scoredResults.push({
            horoscope: {
                ...h,
                name,
                calculatedDetails,
                charts: charts.reduce(
                    (acc, c) => {
                        acc[c.type] = c;
                        return acc;
                    },
                    {} as Record<string, unknown>,
                ),
            },
            score: combinedScore,
            vectorScore: vectorSearchUsed ? +vectorScore.toFixed(3) : undefined,
            keywordScore: keywordScore > 0 ? +keywordScore.toFixed(2) : undefined,
            matchedConditions,
        });
    }

    scoredResults.sort((a, b) => b.score - a.score);
    const paginated = paginateResults(scoredResults, page, pageSize);

    logger.info(
        "search returned %d results (showing %d) for query: %s (vectorSearch=%s)",
        paginated.total,
        paginated.results.length,
        query,
        vectorSearchUsed,
    );

    return NextResponse.json({
        results: paginated.results,
        total: paginated.total,
        page: paginated.page,
        pageSize: paginated.pageSize,
        totalPages: paginated.totalPages,
        queryUnderstanding: {
            mode: exactMatch !== null ? `exact_${exactMatch.type}` : "basic",
            conditions: keywords,
            language: detectedLanguage,
            understoodAll: true,
            exactMatch,
            vectorSearchUsed,
        },
    });
}
