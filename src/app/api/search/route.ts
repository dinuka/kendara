import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { PLANET_NAMES, PlanetaryStrength, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { getAnonymousPlaceholder } from "@/lib/privacy";
import { detectLanguage, paginateResults } from "@/lib/search/utils";

const SINHALA_EXALTATION = ["උච්ච", "උච්චව", "උච්චත්වය"];
const ENGLISH_EXALTATION = ["exaltation", "exalted", "uchcha"];
const SINHALA_DEBILITATION = ["නීච", "නීචව", "නීචත්වය"];
const ENGLISH_DEBILITATION = ["debilitation", "debilitated", "neecha"];
const SINHALA_YOGA = ["යෝග", "යෝගය", "යෝග තිබෙන"];
const ENGLISH_YOGA = ["yoga", "yogas", "yogic"];

type ExactMatch =
    | { type: "ascendant"; sign: number }
    | { type: "planet_in_house"; planet: number; house: number }
    | null;

const getExactMatch = (query: string): ExactMatch => {
    const q = query.toLowerCase();
    const ascendantWords = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];

    const hasAscendantWord = ascendantWords.some((w) => q.includes(w));

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
            const numMatch = q.match(
                new RegExp(`${word.toLowerCase()}\\s+(\\d+)`),
            );
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

    for (const w of SINHALA_EXALTATION) {
        if (q.includes(w)) {
            keywords.push("strength:exaltation");
            break;
        }
    }

    for (const w of ENGLISH_EXALTATION) {
        if (q.includes(w)) {
            keywords.push("strength:exaltation");
            break;
        }
    }

    for (const w of SINHALA_DEBILITATION) {
        if (q.includes(w)) {
            keywords.push("strength:debilitation");
            break;
        }
    }

    for (const w of ENGLISH_DEBILITATION) {
        if (q.includes(w)) {
            keywords.push("strength:debilitation");
            break;
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

    const ascendantWords = ["ලග්නයේ", "ලග්නය", "ලග්න", "ascendant", "lagna"];
    for (const w of ascendantWords) {
        if (q.includes(w)) {
            keywords.push("ascendant");
            break;
        }
    }

    const doshaWords = ["දෝෂය", "දෝෂ", "dosha", "doshas", "දෝෂ"];
    for (const w of doshaWords) {
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
                        matchedConditions.push(
                            `planet_in_sign=${p.name}_${word}`,
                        );
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

                        const signName =
                            Object.entries(ZODIAC_SIGN_NAMES).find(
                                ([, v]) => v === p.sign,
                            )?.[0] || p.sign;
                        matchedConditions.push(
                            `${word}_in_sign=${signName}_house=${p.house}`,
                        );
                    }
                }
            }
        }
    }

    const hasExaltation =
        SINHALA_EXALTATION.some((w) => q.includes(w)) ||
        ENGLISH_EXALTATION.some((w) => q.includes(w));

    if (hasExaltation) {
        if (calculatedDetails?.planets) {
            const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
            let found = false;
            for (const p of planets) {
                if (
                    p.strength === PlanetaryStrength.UCHCHA ||
                    p.strength === "Uchcha" ||
                    p.strength === 1
                ) {
                    score += 0.5;
                    found = true;
                    const planetName =
                        Object.entries(PLANET_NAMES).find(
                            ([, v]) => v === p.name,
                        )?.[0] || p.name;
                    matchedConditions.push(`${planetName}=Exaltation`);
                }
            }
            if (found) score += 0.3;
        }
    }

    const hasDebilitation =
        SINHALA_DEBILITATION.some((w) => q.includes(w)) ||
        ENGLISH_DEBILITATION.some((w) => q.includes(w));

    if (hasDebilitation) {
        if (calculatedDetails?.planets) {
            const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
            for (const p of planets) {
                if (
                    p.strength === PlanetaryStrength.NEECHA ||
                    p.strength === "Neecha" ||
                    p.strength === -1
                ) {
                    score += 0.5;
                    const planetName =
                        Object.entries(PLANET_NAMES).find(
                            ([, v]) => v === p.name,
                        )?.[0] || p.name;
                    matchedConditions.push(`${planetName}=Debilitation`);
                }
            }
        }
    }

    const hasYoga =
        SINHALA_YOGA.some((w) => q.includes(w)) ||
        ENGLISH_YOGA.some((w) => q.includes(w));

    if (hasYoga) {
        if (calculatedDetails?.yogas) {
            const yogas = calculatedDetails.yogas as Array<Record<string, unknown>>;
            if (yogas.length > 0) {
                score += 0.4;
                matchedConditions.push(`yoga_present=${yogas.length}_yogas`);
            }
        }
    }

    const hasDosha =
        q.includes("දෝෂ") ||
        q.includes("dosha") ||
        q.includes("මංගල");

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
            const planetMatch = Object.entries(PLANET_NAMES).find(
                ([word]) => q.includes(word.toLowerCase()),
            );
            if (planetMatch && calculatedDetails?.planets) {
                const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
                for (const p of planets) {
                    if (p.name === planetMatch[1] && p.house === houseNum) {
                        score += 0.6;
                        matchedConditions.push(
                            `${planetMatch[0]}_in_house=${houseNum}`,
                        );
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
    const pageSize = Math.min(
        Math.max(1, parseInt(body.pageSize || "5", 10) || 5),
        20,
    );

    if (!query || typeof query !== "string") {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.length > 500) {
        return NextResponse.json(
            { error: "Query exceeds maximum length of 500 characters." },
            { status: 400 },
        );
    }

    logger.info("search query: %s (page=%d, pageSize=%d)", query, page, pageSize);

    const detectedLanguage = detectLanguage(query);

    const horoscopes = await Horoscope.find({
        $or: [{ "owner.id": session.user.id }, { isPublic: true }],
    }).lean();

    logger.debug("searching through %d horoscopes", horoscopes.length);

    const keywords = getAstroKeywords(query);
    const exactMatch = getExactMatch(query);

    const scoredResults = [];

    for (const h of horoscopes) {
        const calculatedDetails = await CalculatedDetails.findOne({
            "horoscope.id": h._id.toString(),
        }).lean();

        if (exactMatch?.type === "ascendant") {
            const asc = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
            if (!asc || asc.sign !== exactMatch.sign) continue;
        }

        if (exactMatch?.type === "planet_in_house") {
            const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
            if (!planets) continue;
            const matched = planets.some(
                (p) => p.name === exactMatch.planet && p.house === exactMatch.house,
            );
            if (!matched) continue;
        }

        const { score, matchedConditions } = scoreHoroscope(
            h as unknown as Record<string, unknown>,
            query,
            calculatedDetails as unknown as Record<string, unknown> | null,
        );

        if (score <= 0) continue;

        const charts = await Chart.find({
            "horoscope.id": h._id.toString(),
        }).lean();

        const isOwner = h.owner.id === session?.user?.id;
        const name =
            isOwner || h.displayName
                ? h.name
                : getAnonymousPlaceholder(h._id.toString());

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
            score,
            matchedConditions,
        });
    }

    scoredResults.sort((a, b) => b.score - a.score);
    const paginated = paginateResults(scoredResults, page, pageSize);

    logger.info(
        "search returned %d results (showing %d) for query: %s",
        paginated.total,
        paginated.results.length,
        query,
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
        },
    });
}
