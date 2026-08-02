import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { House, findHouse } from "@/lib/astrology";
import { PLANET_NAMES, PlanetaryStrength, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";
import { generateEmbedding } from "@/lib/search/embedding";
import { ensureCollection, searchPoints } from "@/lib/search/qdrant";
import {
    detectLanguage,
    findNakshatraMatch,
    hasNakshatraTriggerWord,
    paginateResults,
    stripJoiners,
} from "@/lib/search/utils";
import {
    ASCENDANT_WORDS,
    DOSHA_WORDS,
    ENGLISH_YOGA,
    SINHALA_YOGA,
} from "@/lib/search/vocabulary";

type ExactCondition =
    | { type: "ascendant"; sign: number }
    | { type: "planet_in_house"; planet: number; house: number }
    | { type: "nakshatra"; nakshatra: number }
    | { type: "planet_strength"; planet: number; strength: PlanetaryStrength };

type ExactMatch = ExactCondition[];

const getStrengthMatch = (query: string): PlanetaryStrength | null => {
    const q = stripJoiners(query.toLowerCase());

    const matched = new Set<PlanetaryStrength>();
    for (const [word, strength] of Object.entries(STRENGTH_LABELS)) {
        if (q.includes(stripJoiners(word.toLowerCase()))) {
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
    const q = stripJoiners(query.toLowerCase());
    const planets = new Set<number>();

    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        if (q.includes(stripJoiners(word.toLowerCase()))) {
            planets.add(planetValue);
        }
    }

    return [...planets];
};

const buildRegexSource = (words: string[]): string => {
    return words
        .map((w) => stripJoiners(w.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .sort((a, b) => b.length - a.length)
        .join("|");
};

// Pairs each strength word in the query with the planet it refers to, so a query like
// "කුජ උච්ච සඳු නීච" yields [{ Mars, Uchcha }, { Moon, Neecha }] and both become AND conditions.
// A strength with no planet nearby (e.g. plain "exaltation") is left unpaired and is still
// handled as a global strength by keyword scoring.
const getPlanetStrengthPairs = (query: string): Array<{ planet: number; strength: PlanetaryStrength }> => {
    const q = stripJoiners(query.toLowerCase());

    const planetValueByWord = new Map<string, number>();
    for (const [word, value] of Object.entries(PLANET_NAMES)) {
        planetValueByWord.set(stripJoiners(word.toLowerCase()), value);
    }

    const strengthValueByWord = new Map<string, PlanetaryStrength>();
    for (const [word, value] of Object.entries(STRENGTH_LABELS)) {
        strengthValueByWord.set(stripJoiners(word.toLowerCase()), value);
    }

    const planetOccurrences: Array<{ index: number; value: number }> = [];
    const planetRe = new RegExp(buildRegexSource([...planetValueByWord.keys()]), "g");
    for (const m of q.matchAll(planetRe)) {
        const value = planetValueByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            planetOccurrences.push({ index: m.index, value });
        }
    }

    const strengthOccurrences: Array<{ index: number; value: PlanetaryStrength }> = [];
    const strengthRe = new RegExp(buildRegexSource([...strengthValueByWord.keys()]), "g");
    for (const m of q.matchAll(strengthRe)) {
        const value = strengthValueByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            strengthOccurrences.push({ index: m.index, value });
        }
    }

    const pairs: Array<{ planet: number; strength: PlanetaryStrength }> = [];
    const usedPlanets = new Set<number>();

    for (const strength of strengthOccurrences) {
        let bestIndex = -1;
        let bestPlanet: number | null = null;
        for (const p of planetOccurrences) {
            if (usedPlanets.has(p.value)) continue;
            if (p.index < strength.index && p.index > bestIndex) {
                bestIndex = p.index;
                bestPlanet = p.value;
            }
        }

        if (bestPlanet !== null) {
            pairs.push({ planet: bestPlanet, strength: strength.value });
            usedPlanets.add(bestPlanet);
            continue;
        }

        let nextIndex = Number.POSITIVE_INFINITY;
        let nextPlanet: number | null = null;
        for (const p of planetOccurrences) {
            if (usedPlanets.has(p.value)) continue;
            if (p.index > strength.index && p.index < nextIndex) {
                nextIndex = p.index;
                nextPlanet = p.value;
            }
        }

        if (nextPlanet !== null) {
            pairs.push({ planet: nextPlanet, strength: strength.value });
            usedPlanets.add(nextPlanet);
        }
    }

    return pairs;
};

// A planet's house for search matching is the cusp-based house (same value shown in the
// planets table), not the stored whole-sign house (p.house, relative to the ascendant sign).
// Falls back to the stored house when cusp boundaries are unavailable.
const getEffectivePlanetHouse = (planet: Record<string, unknown>, houses: unknown): number => {
    const absoluteDegree = planet.absoluteDegree;
    if (typeof absoluteDegree === "number" && Array.isArray(houses)) {
        const found = findHouse(absoluteDegree, houses as House[]);
        if (found !== null) return found;
    }
    return planet.house as number;
};

const getExactMatch = (query: string): ExactMatch => {
    const q = stripJoiners(query.toLowerCase());
    const conditions: ExactMatch = [];

    if (hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            conditions.push({ type: "nakshatra", nakshatra: nakshatraValue });
        }
    }

    const planetStrengthPairs = getPlanetStrengthPairs(query);
    for (const { planet, strength } of planetStrengthPairs) {
        conditions.push({ type: "planet_strength", planet, strength });
    }

    const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));

    const explicitHouseByPlanet = new Map<number, number>();
    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        const normalizedWord = stripJoiners(word.toLowerCase());
        if (q.includes(normalizedWord)) {
            const numMatch = q.match(new RegExp(`${normalizedWord}\\s+(\\d+)`));
            if (numMatch) {
                const house = parseInt(numMatch[1], 10);
                if (house >= 1 && house <= 12) {
                    explicitHouseByPlanet.set(planetValue, house);
                }
            }
        }
    }

    if (hasAscendantWord) {
        for (const [word, signValue] of Object.entries(ZODIAC_SIGN_NAMES)) {
            if (q.includes(stripJoiners(word.toLowerCase()))) {
                conditions.push({ type: "ascendant", sign: signValue });
                break;
            }
        }

        for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
            if (q.includes(stripJoiners(word.toLowerCase())) && !explicitHouseByPlanet.has(planetValue)) {
                conditions.push({ type: "planet_in_house", planet: planetValue, house: 1 });
            }
        }
    }

    for (const [planetValue, house] of explicitHouseByPlanet) {
        conditions.push({ type: "planet_in_house", planet: planetValue, house });
    }

    const deduped = conditions.filter(
        (c, i, arr) =>
            arr.findIndex((other) => JSON.stringify(other) === JSON.stringify(c)) === i,
    );

    return deduped;
};

const getAstroKeywords = (query: string): string[] => {
    const q = stripJoiners(query.toLowerCase());
    const keywords: string[] = [];

    if (hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            keywords.push(`nakshatra:${nakshatraValue}`);
        }
    }

    for (const [word] of Object.entries(ZODIAC_SIGN_NAMES)) {
        if (q.includes(stripJoiners(word.toLowerCase()))) {
            keywords.push(`sign:${word}`);
        }
    }

    for (const [word] of Object.entries(PLANET_NAMES)) {
        if (q.includes(stripJoiners(word.toLowerCase()))) {
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
        if (q.includes(stripJoiners(w.toLowerCase()))) {
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
    const q = stripJoiners(query.toLowerCase());
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
        if (q.includes(stripJoiners(word.toLowerCase()))) {
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
        if (q.includes(stripJoiners(word.toLowerCase()))) {
            if (calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.name === planetValue) {
                        score += 0.3;

                        const signName = Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === p.sign)?.[0] || p.sign;
                        matchedConditions.push(
                            `${word}_in_sign=${signName}_house=${getEffectivePlanetHouse(p, calculatedDetails?.houses)}`,
                        );
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
            const planetMatch = Object.entries(PLANET_NAMES).find(([word]) =>
                q.includes(stripJoiners(word.toLowerCase())),
            );
            if (planetMatch && calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.name === planetMatch[1] && getEffectivePlanetHouse(p, calculatedDetails?.houses) === houseNum) {
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

        const calculatedDetails = await CalculatedDetails.findOne({
            "horoscope.id": hId,
        }).lean();

        if (exactMatch.length > 0) {
            const passesExact = exactMatch.every((condition) => {
                switch (condition.type) {
                    case "ascendant": {
                        const asc = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
                        return !!asc && asc.sign === condition.sign;
                    }
                    case "planet_in_house": {
                        const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
                        if (!planets) return false;
                        return planets.some(
                            (p) =>
                                p.name === condition.planet &&
                                getEffectivePlanetHouse(p, calculatedDetails?.houses) === condition.house,
                        );
                    }
                    case "nakshatra": {
                        const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
                        const moonNakshatra = nakshatra?.moonNakshatra as Record<string, unknown> | undefined;
                        return !!moonNakshatra && moonNakshatra.id === condition.nakshatra;
                    }
                    case "planet_strength": {
                        const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
                        if (!planets) return false;
                        return planets.some(
                            (p) => p.name === condition.planet && getStrengthValue(p.strength) === condition.strength,
                        );
                    }
                    default:
                        return false;
                }
            });
            if (!passesExact) continue;
        }

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
            mode: exactMatch.length === 1 ? `exact_${exactMatch[0].type}` : exactMatch.length > 1 ? "exact_multiple" : "basic",
            conditions: keywords,
            language: detectedLanguage,
            understoodAll: true,
            exactMatch,
            vectorSearchUsed,
        },
    });
}
