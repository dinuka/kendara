import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { PLANET_NAMES, PlanetaryStrength, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
import { isValidBhavaSuchikaValue, resolveLagnaBhavaSuchika, resolvePlanetBhavaSuchika } from "@/lib/bhavaSuchika";
import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";
import { deriveNavamsaLagnaFromDegree } from "@/lib/manualChart";
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
    BHAVA_SUCHIKA_NAMES_EN,
    BHAVA_SUCHIKA_NAMES_SI,
    BHAVA_SUCHIKA_WORDS,
    DOSHA_WORDS,
    ENGLISH_YOGA,
    NAVAMSA_WORDS,
    PLANET_ROLE_WORDS,
    PlanetRoleKey,
    SINHALA_YOGA,
} from "@/lib/search/vocabulary";

type ExactCondition =
    | { type: "ascendant"; sign: number }
    | { type: "navamsa_ascendant"; sign: number }
    | { type: "planet_in_house"; planet: number; house: number }
    | { type: "nakshatra"; nakshatra: number }
    | { type: "planet_strength"; planet: number; strength: PlanetaryStrength }
    | { type: "planet_role"; role: PlanetRoleKey; planet: number }
    | { type: "bhava_suchika"; value: number }
    | { type: "planet_bhava_suchika"; planet: number; value: number };

type ExactMatch = ExactCondition[];

type QueryClause = {
    raw: string;
    exactMatch: ExactMatch;
    keywords: string[];
    detectedLanguage: "si" | "en";
};

type QueryGroup = {
    clauses: QueryClause[];
};

// A comma splits the query into groups that are ANDed together. Within a group a
// bare "හෝ" (OR) splits it into independent clauses; a group matches if ANY of its
// clauses matches. A comma-less single-group query keeps its current AND semantics.
const COMMA_RE = /\s*,\s*/g;
const OR_SEPARATOR_RE = /හෝ\s+(?!\s*$)/g;

const splitQueryGroups = (query: string): string[] => {
    const groups = query
        .split(COMMA_RE)
        .map((group) => group.trim())
        .filter(Boolean);
    return groups.length > 1 ? groups : [query.trim()];
};

const splitQueryClauses = (group: string): string[] => {
    const parts = group
        .split(OR_SEPARATOR_RE)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length > 1 ? parts : [group.trim()];
};

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
        AthiUchcha: 1.25,
        Uchcha: 1,
        Neecha: -1,
        AthiNeecha: -1.25,
        Moolatrikona: 0.75,
        OwnSign: 0.5,
        Mitra: 0.1,
        Shatru: -0.1,
        Sama: 0,
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

// Pairs a sign word with the trigger word (ascendant/navamsa) it refers to, so a query like
// "Mesha lagna Mesha Navanshaka" yields navamsa_ascendant=Mesha (the sign nearest to the
// navamsa word) alongside ascendant=Mesha. Returns null when no trigger word or sign appears.
const getSignMatchNear = (query: string, triggerWords: string[]): number | null => {
    const q = stripJoiners(query.toLowerCase());

    const triggerSet = new Set(triggerWords.map((w) => stripJoiners(w.toLowerCase())));

    const signValueByWord = new Map<string, number>();
    for (const [word, value] of Object.entries(ZODIAC_SIGN_NAMES)) {
        signValueByWord.set(stripJoiners(word.toLowerCase()), value);
    }

    const triggerOccurrences: number[] = [];
    const triggerRe = new RegExp(buildRegexSource([...triggerSet]), "g");
    for (const m of q.matchAll(triggerRe)) {
        if (typeof m.index === "number") triggerOccurrences.push(m.index);
    }
    if (triggerOccurrences.length === 0) return null;

    const signOccurrences: Array<{ index: number; value: number }> = [];
    const signRe = new RegExp(buildRegexSource([...signValueByWord.keys()]), "g");
    for (const m of q.matchAll(signRe)) {
        const value = signValueByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            signOccurrences.push({ index: m.index, value });
        }
    }
    if (signOccurrences.length === 0) return null;

    let best: { dist: number; value: number } | null = null;
    for (const triggerIndex of triggerOccurrences) {
        for (const s of signOccurrences) {
            const dist = Math.abs(s.index - triggerIndex);
            if (best === null || dist < best.dist) {
                best = { dist, value: s.value };
            }
        }
    }
    return best ? best.value : null;
};

const getNavamsaSignMatch = (query: string): number | null => getSignMatchNear(query, NAVAMSA_WORDS);

type BhavaSuchikaMatch = { type: "lagna"; value: number } | { type: "planet"; planet: number; value: number };

// Detects a Bhava Suchika (භාව සුචික) question in a query clause. A house-index NAME wins
// ("labhamshaka" → 1, "ව්‍යාංශකය" → 12, in either language); otherwise a trigger word
// ("bhava suchika", "භාව සුචික", ...) plus a number 1-12 gives the value. A bare trigger with no
// usable number yields null (RE-BS-464) — same as out-of-range numbers (0/13+). When a planet is
// named the match is per-planet; otherwise it is the Lagna value.
const getBhavaSuchikaMatch = (query: string): BhavaSuchikaMatch | null => {
    const q = stripJoiners(query.toLowerCase());

    const valueByWord = new Map<string, number>();
    for (const [name, value] of Object.entries({ ...BHAVA_SUCHIKA_NAMES_SI, ...BHAVA_SUCHIKA_NAMES_EN })) {
        valueByWord.set(stripJoiners(name.toLowerCase()), value);
    }

    for (const [word, value] of valueByWord) {
        if (q.includes(word)) {
            return buildBhavaSuchikaMatch(query, value);
        }
    }

    const hasTriggerWord = BHAVA_SUCHIKA_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));
    if (!hasTriggerWord) return null;

    const numbers = q.match(/\d+/g);
    const value = numbers ? numbers.map(Number).find((n) => isValidBhavaSuchikaValue(n)) : undefined;
    if (value === undefined) return null;

    return buildBhavaSuchikaMatch(query, value);
};

const buildBhavaSuchikaMatch = (query: string, value: number): BhavaSuchikaMatch => {
    const planets = getPlanetMatches(query);
    if (planets.length > 0) {
        return { type: "planet", planet: planets[0], value };
    }
    return { type: "lagna", value };
};

// Resolves the Navamsa (D9) lagna sign of a horoscope. Manual horoscopes store it directly in
// `manualHousePlacements.navamsaLagna` (or derive it from lagna + lagnaDegree); auto-calculated
// ones derive it from the birth ascendant's sign + degree within sign. Returns null when unknown.
const getNavamsaLagnaSign = (calculatedDetails: Record<string, unknown> | null): number | null => {
    if (!calculatedDetails) return null;

    const manual = calculatedDetails.manualHousePlacements as Record<string, unknown> | undefined;
    if (manual && typeof manual === "object") {
        const navamsaLagna = manual.navamsaLagna;
        if (typeof navamsaLagna === "number" && navamsaLagna >= 1 && navamsaLagna <= 12) {
            return navamsaLagna;
        }
        const lagna = manual.lagna;
        const lagnaDegree = manual.lagnaDegree;
        if (typeof lagna === "number" && typeof lagnaDegree === "number") {
            return deriveNavamsaLagnaFromDegree(lagna, lagnaDegree);
        }
        return null;
    }

    const ascendant = calculatedDetails.ascendant as Record<string, unknown> | undefined;
    if (ascendant && typeof ascendant.sign === "number" && typeof ascendant.degree === "number") {
        return deriveNavamsaLagnaFromDegree(ascendant.sign, ascendant.degree);
    }

    return null;
};

// A planet's house for search matching is its whole-sign Rashi house (p.house — sign relative to
// the ascendant sign), the same value shown in the planets table. Cusp-boundary ranges (house
// start/end degrees) are never considered.
const getEffectivePlanetHouse = (planet: Record<string, unknown>): number => planet.house as number;

const isSinglePlanetRole = (role: PlanetRoleKey): boolean =>
    role === "drekkana" || role === "navamsa" || role === "atmakaraka";

const getRoleField = (role: PlanetRoleKey): string => {
    switch (role) {
        case "ashtamansha":
            return "ashtamanshaPlanets";
        case "nidhanamsha":
            return "nidhanamshaPlanets";
        case "maraka":
            return "marakaPlanets";
        case "badhaka":
            return "badhakaPlanet";
        case "drekkana":
            return "lord22ndDrekkana";
        case "navamsa":
            return "lord64thNavamsa";
        case "atmakaraka":
            return "atmakaraka";
        case "wargoththama":
            return "wargoththamaPlanets";
        case "gandanta":
            return "gandanthaPlanets";
        case "gandamula":
            return "gandamulaPlanets";
        case "pushkara":
            return "pushkaraPlanets";
    }
};

// Detects which varga role words a query asks about (e.g. "බාධක", "ashtamansha",
// "ද්‍රැක්කානාධිපති" / "drekkana"). Returns null when no role concept is mentioned.
const getPlanetRole = (query: string): PlanetRoleKey | null => {
    const q = stripJoiners(query.toLowerCase());
    for (const [role, words] of Object.entries(PLANET_ROLE_WORDS)) {
        for (const word of words) {
            if (q.includes(stripJoiners(word.toLowerCase()))) {
                return role as PlanetRoleKey;
            }
        }
    }
    return null;
};

const hasPlanetRole = (
    role: PlanetRoleKey,
    planet: number,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    if (!calculatedDetails) return false;
    const field = getRoleField(role);

    if (isSinglePlanetRole(role)) {
        return calculatedDetails[field] === planet;
    }

    const arr = calculatedDetails[field];
    return Array.isArray(arr) && arr.includes(planet);
};

// Presence-only check used when a role word appears without a named planet (e.g. just
// "අෂ්ඨමාංශ" or "22nd drekkana lord"). Single-valued lords (drekkana/navamsa/atmakaraka)
// are treated as present whenever they hold a valid planet, so a bare "22nd drekkana
// lord" query still matches a horoscope instead of returning nothing.
const hasAnyPlanetRole = (role: PlanetRoleKey, calculatedDetails: Record<string, unknown> | null): boolean => {
    if (!calculatedDetails) return false;
    const value = calculatedDetails[getRoleField(role)];

    if (isSinglePlanetRole(role)) {
        return typeof value === "number" && value >= 1 && value <= 9;
    }

    return Array.isArray(value) && value.length > 0;
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

    const planetRole = getPlanetRole(query);
    if (planetRole !== null) {
        for (const planet of getPlanetMatches(query)) {
            conditions.push({ type: "planet_role", role: planetRole, planet });
        }
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
        const ascendantSignValue = getSignMatchNear(query, ASCENDANT_WORDS);
        if (ascendantSignValue !== null) {
            conditions.push({ type: "ascendant", sign: ascendantSignValue });
        }

        for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
            if (q.includes(stripJoiners(word.toLowerCase())) && !explicitHouseByPlanet.has(planetValue)) {
                conditions.push({ type: "planet_in_house", planet: planetValue, house: 1 });
            }
        }
    }

    const navamsaSignValue = getNavamsaSignMatch(query);
    if (navamsaSignValue !== null) {
        conditions.push({ type: "navamsa_ascendant", sign: navamsaSignValue });
    }

    const bhavaSuchikaMatch = getBhavaSuchikaMatch(query);
    if (bhavaSuchikaMatch !== null) {
        if (bhavaSuchikaMatch.type === "lagna") {
            conditions.push({ type: "bhava_suchika", value: bhavaSuchikaMatch.value });
        } else {
            conditions.push({
                type: "planet_bhava_suchika",
                planet: bhavaSuchikaMatch.planet,
                value: bhavaSuchikaMatch.value,
            });
        }
    }

    for (const [planetValue, house] of explicitHouseByPlanet) {
        conditions.push({ type: "planet_in_house", planet: planetValue, house });
    }

    const deduped = conditions.filter(
        (c, i, arr) => arr.findIndex((other) => JSON.stringify(other) === JSON.stringify(c)) === i,
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

    const planetRole = getPlanetRole(query);
    if (planetRole !== null) {
        keywords.push(`role:${planetRole}`);
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

    if (getNavamsaSignMatch(query) !== null) {
        keywords.push("navamsa_ascendant");
    }

    const bhavaSuchikaMatch = getBhavaSuchikaMatch(query);
    if (bhavaSuchikaMatch !== null) {
        keywords.push(bhavaSuchikaMatch.type === "lagna" ? "bhava_suchika" : "planet_bhava_suchika");
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

    const navamsaSignValue = getNavamsaSignMatch(query);
    if (navamsaSignValue !== null) {
        const navamsaLagnaSign = getNavamsaLagnaSign(calculatedDetails);
        if (navamsaLagnaSign === navamsaSignValue) {
            score += 1.0;
            const signWord =
                Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === navamsaSignValue)?.[0] || navamsaSignValue;
            matchedConditions.push(`navamsa_ascendant=${signWord}`);
        }
    }

    const bhavaSuchikaMatch = getBhavaSuchikaMatch(query);
    if (bhavaSuchikaMatch !== null) {
        if (bhavaSuchikaMatch.type === "lagna") {
            if (resolveLagnaBhavaSuchika(calculatedDetails) === bhavaSuchikaMatch.value) {
                score += 1.0;
                matchedConditions.push(`bhava_suchika=${bhavaSuchikaMatch.value}`);
            }
        } else if (resolvePlanetBhavaSuchika(calculatedDetails, bhavaSuchikaMatch.planet) === bhavaSuchikaMatch.value) {
            score += 0.5;
            const planetWord =
                Object.entries(PLANET_NAMES).find(([, v]) => v === bhavaSuchikaMatch.planet)?.[0] ||
                bhavaSuchikaMatch.planet;
            matchedConditions.push(`planet_bhava_suchika_${planetWord}=${bhavaSuchikaMatch.value}`);
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
                            `${word}_in_sign=${signName}_house=${getEffectivePlanetHouse(p)}`,
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

    const planetRole = getPlanetRole(query);
    if (planetRole !== null) {
        const rolePlanetMatches = getPlanetMatches(query);
        if (rolePlanetMatches.length > 0) {
            for (const planet of rolePlanetMatches) {
                if (hasPlanetRole(planetRole, planet, calculatedDetails)) {
                    score += 0.5;
                    const planetWord = Object.entries(PLANET_NAMES).find(([, v]) => v === planet)?.[0] || planet;
                    matchedConditions.push(`${planetRole}=${planetWord}`);
                }
            }
        } else if (hasAnyPlanetRole(planetRole, calculatedDetails)) {
            score += 0.4;
            matchedConditions.push(`${planetRole}_present`);
        }
    }

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
                    if (
                        p.name === planetMatch[1] &&
                        getEffectivePlanetHouse(p) === houseNum
                    ) {
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
    const pageSize = Math.min(Math.max(1, parseInt(body.pageSize || "6", 10) || 6), 20);

    if (!query || typeof query !== "string") {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.length > 500) {
        return NextResponse.json({ error: "Query exceeds maximum length of 500 characters." }, { status: 400 });
    }

    logger.info("search query: %s (page=%d, pageSize=%d)", query, page, pageSize);

    const detectedLanguage = detectLanguage(query);
    const keywords = getAstroKeywords(query);

    // Queries can carry several intents, e.g. "මේෂ ලග්නය, කුජ 1 හෝ කුජ 10". A comma
    // splits the query into groups that are ANDed together (all must match); within a
    // group a හෝ (OR) separator splits it into clauses, a group matching if ANY clause
    // matches. A comma-less query is a single group with the existing AND semantics.
    const groups: QueryGroup[] = splitQueryGroups(query).map((group) => ({
        clauses: splitQueryClauses(group).map((clause) => ({
            raw: clause,
            exactMatch: getExactMatch(clause),
            keywords: getAstroKeywords(clause),
            detectedLanguage: detectLanguage(clause),
        })),
    }));

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

        if (groups.length === 0) continue;

        // A horoscope must satisfy every comma-separated group (AND), and within a
        // group it needs only ONE of its හෝ clauses to match (OR).
        const matchedGroupScores: number[] = [];
        const matchedGroupConditions: string[][] = [];
        let allGroupsMatch = true;

        for (const group of groups) {
            let groupBestScore = 0;
            let groupBestConditions: string[] = [];

            for (const clause of group.clauses) {
                const clauseExact = clause.exactMatch;

                if (clauseExact.length > 0) {
                    const passesExact = clauseExact.every((condition) => {
                        switch (condition.type) {
                            case "ascendant": {
                                const asc = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
                                return !!asc && asc.sign === condition.sign;
                            }
                            case "navamsa_ascendant": {
                                return (
                                    getNavamsaLagnaSign(calculatedDetails as Record<string, unknown> | null) ===
                                    condition.sign
                                );
                            }
                            case "planet_in_house": {
                                const planets = calculatedDetails?.planets as
                                    Array<Record<string, unknown>> | undefined;
                                if (!planets) return false;
                                return planets.some(
                                    (p) =>
                                        p.name === condition.planet &&
                                        getEffectivePlanetHouse(p) === condition.house,
                                );
                            }
                            case "nakshatra": {
                                const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
                                const moonNakshatra = nakshatra?.moonNakshatra as Record<string, unknown> | undefined;
                                return !!moonNakshatra && moonNakshatra.id === condition.nakshatra;
                            }
                            case "planet_strength": {
                                const planets = calculatedDetails?.planets as
                                    Array<Record<string, unknown>> | undefined;
                                if (!planets) return false;
                                return planets.some(
                                    (p) =>
                                        p.name === condition.planet &&
                                        getStrengthValue(p.strength) === condition.strength,
                                );
                            }
                            case "planet_role": {
                                return hasPlanetRole(
                                    condition.role,
                                    condition.planet,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            }
                            case "bhava_suchika": {
                                return resolveLagnaBhavaSuchika(calculatedDetails) === condition.value;
                            }
                            case "planet_bhava_suchika": {
                                return (
                                    resolvePlanetBhavaSuchika(calculatedDetails, condition.planet) === condition.value
                                );
                            }
                            default:
                                return false;
                        }
                    });
                    if (!passesExact) continue;
                }

                const { score: clauseScore, matchedConditions } = scoreHoroscope(
                    h as unknown as Record<string, unknown>,
                    clause.raw,
                    calculatedDetails as unknown as Record<string, unknown> | null,
                );

                if (clauseScore > groupBestScore) {
                    groupBestScore = clauseScore;
                    groupBestConditions = matchedConditions;
                }
            }

            if (groupBestScore <= 0) {
                allGroupsMatch = false;
                break;
            }

            matchedGroupScores.push(groupBestScore);
            matchedGroupConditions.push(groupBestConditions);
        }

        if (!allGroupsMatch && !vectorScores.has(hId)) continue;

        const vectorScore = vectorScores.get(hId) ?? 0;

        // Across ANDed groups the best clause score per group is summed, capped so a
        // string of strong matches does not dominate the vector signal.
        const keywordScore = matchedGroupScores.reduce((sum, s) => sum + s, 0);
        const matchedConditions = matchedGroupConditions.flat();

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
            mode:
                groups.length > 1
                    ? "and_groups"
                    : groups[0].clauses.length > 1
                      ? "or_multiple"
                      : groups[0].clauses[0].exactMatch.length === 1
                        ? `exact_${groups[0].clauses[0].exactMatch[0].type}`
                        : groups[0].clauses[0].exactMatch.length > 1
                          ? "exact_multiple"
                          : "basic",
            conditions: keywords,
            language: detectedLanguage,
            understoodAll: true,
            exactMatch: groups.map((g) => g.clauses.map((c) => c.exactMatch)),
            groups: groups.map((g) => ({
                clauses: g.clauses.map((c) => ({
                    query: c.raw,
                    conditions: c.keywords,
                    language: c.detectedLanguage,
                })),
            })),
            vectorSearchUsed,
        },
    });
}
