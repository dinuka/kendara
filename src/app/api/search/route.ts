import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Chart } from "@/models/Chart";
import { Horoscope } from "@/models/Horoscope";

import { SIGN_LORD, computeAscendantSpecialFlags, getNakshatraLord } from "@/lib/astrology";
import {
    CancellationStatus,
    PLANET_NAMES,
    Planet,
    PlanetaryStrength,
    STRENGTH_LABELS,
    ZODIAC_SIGN_NAMES,
} from "@/lib/astrologyEnums";
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
    normalizeSinhalaSpelling,
    paginateResults,
    stripJoiners,
} from "@/lib/search/utils";
import {
    ASCENDANT_WORDS,
    BHAVA_SUCHIKA_NAMES_EN,
    BHAVA_SUCHIKA_NAMES_SI,
    BHAVA_SUCHIKA_WORDS,
    CLASSIFICATION_NAME_WORDS,
    DOSHA_WORDS,
    ENGLISH_YOGA,
    FAMILY_NAME_WORDS,
    HOUSE_NAMES_SI,
    NAVAMSA_WORDS,
    NEGATION_PREFIX_WORDS,
    NEGATION_SUFFIX_WORDS,
    PLANET_ROLE_WORDS,
    PlanetRoleKey,
    SINHALA_YOGA,
    YOGA_CLASSIFICATIONS,
    YOGA_DOSHA_NAME_WORDS,
    YOGA_FAMILIES,
} from "@/lib/search/vocabulary";
import { DOSHA_CATALOG, YOGA_CATALOG, doshaCatalogEntry, yogaCatalogEntry } from "@/lib/yogaDosha/catalog";
import { resolveYogaDoshas } from "@/lib/yogaDosha/resolve";
import type { DoshaId, YogaId } from "@/lib/yogaDosha/types";

type ExactCondition =
    | { type: "ascendant"; sign: number }
    | { type: "navamsa_ascendant"; sign: number }
    | { type: "planet_in_house"; planet: number; house: number }
    | { type: "planet_in_sign"; planet: number; sign: number }
    | ({ type: "planet_from_planet" } & PlanetRelation)
    | ({ type: "house_lord_in_house" } & HouseLordship)
    | ({ type: "house_exchange" } & HouseExchange)
    | { type: "nakshatra"; nakshatra: number }
    | { type: "ascendant_nakshatra"; nakshatra: number }
    | { type: "planet_nakshatra_lord"; planet: number; lord: number }
    | { type: "planet_strength"; planet: number; strength: PlanetaryStrength }
    | { type: "planet_role"; role: PlanetRoleKey; planet: number }
    | { type: "ascendant_pushkara" }
    | { type: "pushkara_planet_count"; min: number }
    | { type: "bhava_suchika"; value: number }
    | { type: "planet_bhava_suchika"; planet: number; value: number }
    | YogaDoshaCondition;

// `negated` flips a yoga/dosha condition to "absent or cancelled" ("කුජ දෝෂය නැති").
type YogaDoshaCondition =
    | { type: "yoga_id"; yogaId: string; negated?: boolean }
    | { type: "yoga_family"; familyId: string; negated?: boolean }
    | { type: "yoga_classification"; yogaId: string; classification: string; negated?: boolean }
    | { type: "dosha_id"; doshaId: string; negated?: boolean };

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

// Pairs each planet word in the query with the sign word nearest to it, so a query like
// "සඳු වෘශ්චික" yields [{ Moon, Scorpio }] and "සඳු වෘශ්චික කුජ මේෂ" yields
// [{ Moon, Scorpio }, { Mars, Aries }] — each named planet matched to its own sign. A bare
// sign with no nearby planet is left unpaired and is still handled by keyword scoring.
const getPlanetSignPairs = (query: string): Array<{ planet: number; sign: number }> => {
    const q = stripJoiners(query.toLowerCase());

    const planetValueByWord = new Map<string, number>();
    for (const [word, value] of Object.entries(PLANET_NAMES)) {
        planetValueByWord.set(stripJoiners(word.toLowerCase()), value);
    }

    const signValueByWord = new Map<string, number>();
    for (const [word, value] of Object.entries(ZODIAC_SIGN_NAMES)) {
        signValueByWord.set(stripJoiners(word.toLowerCase()), value);
    }

    const planetOccurrences: Array<{ index: number; value: number }> = [];
    const planetRe = new RegExp(buildRegexSource([...planetValueByWord.keys()]), "g");
    for (const m of q.matchAll(planetRe)) {
        const value = planetValueByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            planetOccurrences.push({ index: m.index, value });
        }
    }
    if (planetOccurrences.length === 0) return [];

    const signOccurrences: Array<{ index: number; value: number }> = [];
    const signRe = new RegExp(buildRegexSource([...signValueByWord.keys()]), "g");
    for (const m of q.matchAll(signRe)) {
        const value = signValueByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            signOccurrences.push({ index: m.index, value });
        }
    }
    if (signOccurrences.length === 0) return [];

    const pairs: Array<{ planet: number; sign: number }> = [];
    const usedSigns = new Set<number>();

    for (const p of planetOccurrences) {
        let bestDist = Number.POSITIVE_INFINITY;
        let bestSign: number | null = null;
        for (const s of signOccurrences) {
            if (usedSigns.has(s.value)) continue;
            const dist = Math.abs(s.index - p.index);
            if (dist < bestDist) {
                bestDist = dist;
                bestSign = s.value;
            }
        }

        if (bestSign !== null) {
            pairs.push({ planet: p.value, sign: bestSign });
            usedSigns.add(bestSign);
        }
    }

    return pairs;
};

// Phrases that mean "nakshatra lord" (නැකත් අධිපති). Kept in raw spelling (not the collapsed
// nakshatra skeleton) so "moon nakshatra lord mars" still matches after its repeated letters
// are merged by normalizeNakshatraQuery.
const NAKSHATRA_LORD_PHRASES = [
    "නැකත් අධිපති",
    "නැකත් අධිපතියා",
    "නැකැත් අධිපති",
    "නැකැත් අධිපතියා",
    "නැකත අධිපති",
    "නැකත අධිපතියා",
    "නක්ෂත්ර අධිපති",
    "නක්ෂත්රයේ අධිපති",
    "nakshatra lord",
    "nakshathra lord",
    "nakashatra lord",
    "star lord",
];

// A genitive marker right before a nakshatra word — the possessive "of" form, e.g. "කුජගේ
// නැකතක" (a nakshatra of Mars) or "mars's nakshatra".
const POSSESSIVE_NAKSHATRA_RE = /(ගේ|'s)\s*(?:නැකත්|නැකැත්|නැකත|නක්ෂත්රය|නක්ෂත්ර|nakshatra|nakshathra|nakashatra|star)/;

// Pairs the planet whose nakshatra is meant with the planet that rules it, so "සඳගේ නැකත්
// අධිපති කුජ" and "සඳ කුජගේ නැකතක" both yield { planet: Moon, lord: Mars }. With an
// adipathi/lord word the genitive planet ("Xගේ නැකත් අධිපති Y") is the one inside the
// nakshatra and Y is its lord; without one ("X Yගේ නැකත") the genitive planet is the lord.
const getPlanetNakshatraLord = (query: string): { planet: number; lord: number } | null => {
    const q = stripJoiners(query.toLowerCase());

    const planetByKey = new Map<string, number>();
    for (const [word, value] of Object.entries(PLANET_NAMES)) {
        planetByKey.set(stripJoiners(word.toLowerCase()), value);
    }

    const occurrences: Array<{ index: number; value: number; word: string }> = [];
    const planetRe = new RegExp(buildRegexSource([...planetByKey.keys()]), "g");
    for (const m of q.matchAll(planetRe)) {
        const value = planetByKey.get(m[0]);
        if (value !== undefined && typeof m.index === "number") {
            occurrences.push({ index: m.index, value, word: m[0] });
        }
    }
    if (occurrences.length < 2) return null;

    const genitivePlanets = occurrences.filter((p) => {
        const after = q.slice(p.index + p.word.length);
        return after.startsWith("ගේ") || after.startsWith("'s");
    });

    const hasLordTrigger = NAKSHATRA_LORD_PHRASES.some((phrase) => q.includes(phrase));

    if (hasLordTrigger) {
        if (genitivePlanets.length > 0) {
            const subject = genitivePlanets[0];
            const lord = occurrences.find((p) => p.index !== subject.index);
            if (lord) return { planet: subject.value, lord: lord.value };
        }
        return { planet: occurrences[0].value, lord: occurrences[1].value };
    }

    if (POSSESSIVE_NAKSHATRA_RE.test(q) && genitivePlanets.length > 0) {
        const lord = genitivePlanets[0];
        const subject = occurrences.find((p) => p.index !== lord.index);
        if (subject) return { planet: subject.value, lord: lord.value };
    }

    return null;
};

type PlanetRelation = { planet: number; from: number; distance: number };

const PLANET_WORD_SOURCE = buildRegexSource(Object.keys(PLANET_NAMES));
const ORDINAL_SOURCE = `(?:st|nd|rd|th)?(?:\\s*(?:${buildRegexSource(["වැන්නේ", "වැන්නෙ", "වැනේනේ", "වැනි", "වෙනි", "වැනිව", "වන", "house"])}))?`;
const FROM_MARKER_SOURCE = buildRegexSource(["ගෙන්", "ගේ සිට", "ගෙ සිට", "සිට"]);
const CONJUNCTION_SI_SOURCE = buildRegexSource(["සමගින්", "සමඟින්", "සමග", "සමඟ", "එක්ක", "එක්ව"]);

// Each pattern captures one planet and, when present, the house count. `planetIsReference` says
// whether the captured planet is the one counted from; otherwise the nearest other planet word is.
const RELATION_PATTERNS: Array<{
    re: RegExp;
    planetGroup: number;
    distanceGroup: number | null;
    planetIsReference: boolean;
}> = [
    // "රවි සඳුගෙන් 6 වැන්නේ" — counting from රවි, සඳු is 6th: the ගෙන් planet is the counted one.
    {
        re: new RegExp(`(${PLANET_WORD_SOURCE})\\s*(?:${FROM_MARKER_SOURCE})\\s*(\\d{1,2})${ORDINAL_SOURCE}`, "g"),
        planetGroup: 1,
        distanceGroup: 2,
        planetIsReference: false,
    },
    // "රවි 6 වැන්නේ සඳුගෙන්" — the same relation with the count first.
    {
        re: new RegExp(`(\\d{1,2})${ORDINAL_SOURCE}\\s*(${PLANET_WORD_SOURCE})\\s*(?:${FROM_MARKER_SOURCE})`, "g"),
        planetGroup: 2,
        distanceGroup: 1,
        planetIsReference: false,
    },
    // "moon 6th from sun" / "moon 6th house from the sun" — the planet after "from" is the reference.
    {
        re: new RegExp(`(\\d{1,2})${ORDINAL_SOURCE}\\s+from\\s+(?:the\\s+)?(${PLANET_WORD_SOURCE})`, "g"),
        planetGroup: 2,
        distanceGroup: 1,
        planetIsReference: true,
    },
    // "රාහු රවි සමග" — conjunction, i.e. the 1st house from the reference planet.
    {
        re: new RegExp(`(${PLANET_WORD_SOURCE})\\s*(?:${CONJUNCTION_SI_SOURCE})`, "g"),
        planetGroup: 1,
        distanceGroup: null,
        planetIsReference: true,
    },
    // "rahu with sun" / "rahu conjunct sun".
    {
        re: new RegExp(`(?:^|\\s)(?:conjunct(?:ion)?(?:\\s+with)?|with)\\s+(${PLANET_WORD_SOURCE})`, "g"),
        planetGroup: 1,
        distanceGroup: null,
        planetIsReference: true,
    },
];

// Finds "planet N-th from planet" relations, e.g. "රවි සඳුගෙන් 6 වැන්නේ" → the Moon is 6th from the
// Sun, "කුජ ගුරුගෙන් 8 වැන්නේ" → Jupiter is 8th from Mars, "රාහු රවි සමග" → Rahu with the Sun (1st).
// Returns the matched spans too, so their numbers are not misread as a plain "planet house" query.
const getPlanetRelations = (query: string): { relations: PlanetRelation[]; spans: Array<[number, number]> } => {
    const q = stripJoiners(query.toLowerCase());
    const planetByWord = new Map(Object.entries(PLANET_NAMES).map(([word, value]) => [stripJoiners(word), value]));

    const occurrences: Array<{ index: number; value: number }> = [];
    for (const m of q.matchAll(new RegExp(PLANET_WORD_SOURCE, "g"))) {
        const value = planetByWord.get(m[0]);
        if (value !== undefined && typeof m.index === "number") occurrences.push({ index: m.index, value });
    }

    const relations: PlanetRelation[] = [];
    const spans: Array<[number, number]> = [];

    RELATION_PATTERNS.forEach(({ re, planetGroup, distanceGroup, planetIsReference }) => {
        for (const m of q.matchAll(re)) {
            if (typeof m.index !== "number") continue;
            const start = m.index;
            const end = start + m[0].length;
            if (spans.some(([s, e]) => start < e && end > s)) continue;

            const captured = planetByWord.get(m[planetGroup]);
            const distance = distanceGroup === null ? 1 : parseInt(m[distanceGroup], 10);
            if (captured === undefined || distance < 1 || distance > 12) continue;

            let other: { dist: number; value: number } | null = null;
            for (const { index, value } of occurrences) {
                if (value === captured || (index >= start && index < end)) continue;
                const dist = index < start ? start - index : index - end;
                if (other === null || dist < other.dist) other = { dist, value };
            }
            if (other === null) continue;

            relations.push(
                planetIsReference
                    ? { planet: other.value, from: captured, distance }
                    : { planet: captured, from: other.value, distance },
            );
            spans.push([start, end]);
        }
    });

    return { relations, spans };
};

// The query with its relation phrases cut out, so their counts and words ("8th", the "සම" inside
// "සමග") are not misread as a planet's house or strength.
const withoutPlanetRelations = (query: string): string =>
    getPlanetRelations(query).spans.reduceRight(
        (text, [start, end]) => text.slice(0, start) + text.slice(end),
        stripJoiners(query.toLowerCase()),
    );

const planetWordOf = (planet: number): string =>
    Object.entries(PLANET_NAMES).find(([, value]) => value === planet)?.[0] ?? String(planet);

// The house a planet falls in counted from another planet, inclusively (same sign = 1st).
// Whole-sign counting, so it equals the difference of their Rashi houses.
const matchesPlanetRelation = (
    { planet, from, distance }: PlanetRelation,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
    if (!planets) return false;
    const subject = planets.find(({ name }) => name === planet);
    const reference = planets.find(({ name }) => name === from);
    if (!subject || !reference) return false;
    return ((((subject.sign as number) - (reference.sign as number)) % 12) + 12) % 12 === distance - 1;
};

type HouseLordship = { house: number; inHouse: number };

const LORD_SI_SOURCE = `(?:ා?ධිපති|(?:යේ|ය|ගේ)?\\s*අධිපති)(?:යා)?`;
const LORD_TARGET_SOURCE = `\\s*(?:(?:is\\s+)?in\\s+(?:the\\s+)?)?(\\d{1,2})${ORDINAL_SOURCE}(?:\\s*(?:${buildRegexSource(["භාවයේ", "භාවයෙහි", "භාවය", "ගෘහයේ", "ස්ථානයේ", "හි"])}))?`;
const WORD_START_SOURCE = "(?<![\\p{L}\\p{M}\\d])";

// Each pattern captures the owned house (a number, or a house name looked up in HOUSE_NAMES_SI)
// followed by the house its lord sits in.
const HOUSE_LORD_PATTERNS: Array<{ re: RegExp; houseOf: (captured: string) => number | undefined }> = [
    // "1 අධිපති 12", "4 වන භාවාධිපති 1", "1st lord in 12th", "4th house lord 1".
    {
        re: new RegExp(
            `${WORD_START_SOURCE}(\\d{1,2})${ORDINAL_SOURCE}(?:\\s*(?:භාව|ගෘහ))?(?:${LORD_SI_SOURCE}|\\s*lord)${LORD_TARGET_SOURCE}`,
            "gu",
        ),
        houseOf: (captured) => parseInt(captured, 10),
    },
    // "ලග්නාධිපති 12", "සුඛස්ථානාධිපති 1", "ලග්නයේ අධිපති 12".
    {
        re: new RegExp(
            `${WORD_START_SOURCE}(${buildRegexSource(Object.keys(HOUSE_NAMES_SI))})(?:ස්ථාන)?${LORD_SI_SOURCE}${LORD_TARGET_SOURCE}`,
            "gu",
        ),
        houseOf: (captured) => Object.entries(HOUSE_NAMES_SI).find(([name]) => stripJoiners(name) === captured)?.[1],
    },
    // "lord of the 4th house in 1st", "lord of 1 in 12".
    {
        re: new RegExp(
            `${WORD_START_SOURCE}lord\\s+of\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+house)?${LORD_TARGET_SOURCE}`,
            "gu",
        ),
        houseOf: (captured) => parseInt(captured, 10),
    },
    // "lagna lord in 12th", "ascendant lord 12".
    {
        re: new RegExp(`${WORD_START_SOURCE}(lagna|ascendant)\\s+lord${LORD_TARGET_SOURCE}`, "gu"),
        houseOf: () => 1,
    },
];

// Finds "house N's lord in house M" phrases, e.g. "1 අධිපති 12" or "ලග්නාධිපති 12" → the 1st lord
// in the 12th, "සුඛස්ථානාධිපති 1" → the 4th lord in the 1st. Returns the matched spans so the rest
// of the parser never sees their numbers or the "ලග්න" inside "ලග්නාධිපති".
const getHouseLordships = (query: string): { lordships: HouseLordship[]; spans: Array<[number, number]> } => {
    const q = stripJoiners(query.toLowerCase());
    const lordships: HouseLordship[] = [];
    const spans: Array<[number, number]> = [];

    HOUSE_LORD_PATTERNS.forEach(({ re, houseOf }) => {
        for (const m of q.matchAll(re)) {
            if (typeof m.index !== "number") continue;
            const start = m.index;
            const end = start + m[0].length;
            if (spans.some(([s, e]) => start < e && end > s)) continue;

            const house = houseOf(m[1]);
            const inHouse = parseInt(m[2], 10);
            if (house === undefined || house < 1 || house > 12 || inHouse < 1 || inHouse > 12) continue;

            lordships.push({ house, inHouse });
            spans.push([start, end]);
        }
    });

    return { lordships, spans };
};

type HouseExchange = { house1: number; house2: number };

// One house, as a number ("4", "4 වන භාවය", "4th") or a name with an optional ස්ථාන/ස්තාන
// ("ලග්නස්ථානය", "සුඛස්තාන"). Captures the number or the name.
const HOUSE_TOKEN_SOURCE = `(?:(\\d{1,2})${ORDINAL_SOURCE}(?:\\s*(?:භාවය|භාව))?|(${buildRegexSource(Object.keys(HOUSE_NAMES_SI))})(?:ස්ථාන|ස්තාන)?(?:යේ|ය)?)`;
const HOUSE_PAIR_SOURCE = `${HOUSE_TOKEN_SOURCE}\\s*(?:හා|සහ|and|&)\\s*(?:the\\s+)?${HOUSE_TOKEN_SOURCE}`;
const EXCHANGE_WORD_SOURCE = buildRegexSource(["පරිවර්තනය", "පරිවර්තන", "parivartana", "pariwarthana", "exchange"]);

const HOUSE_EXCHANGE_PATTERNS = [
    // "1 හා 4 පරිවර්තනය", "ලග්නස්ථානය හා සුඛස්තාන පරිවර්තනය", "1st and 4th house exchange".
    new RegExp(`${WORD_START_SOURCE}${HOUSE_PAIR_SOURCE}\\s*(?:අතර\\s*)?(?:${EXCHANGE_WORD_SOURCE})`, "gu"),
    // "parivartana between 1 and 4", "exchange of the 4th and 9th".
    new RegExp(
        `${WORD_START_SOURCE}(?:parivartana|pariwarthana|exchange)\\s+(?:between|of)\\s+(?:the\\s+)?${HOUSE_PAIR_SOURCE}`,
        "gu",
    ),
];

const houseOfToken = (number: string | undefined, name: string | undefined): number | undefined =>
    number !== undefined
        ? parseInt(number, 10)
        : Object.entries(HOUSE_NAMES_SI).find(([houseName]) => stripJoiners(houseName) === name)?.[1];

// Finds "house A and house B exchange" phrases (Parivartana between two houses' lords), e.g.
// "1 හා 4 පරිවර්තනය" or "ලග්නස්ථානය හා සුඛස්තාන පරිවර්තනය" → the 1st and 4th lords swap signs.
const getHouseExchanges = (query: string): { exchanges: HouseExchange[]; spans: Array<[number, number]> } => {
    const q = stripJoiners(query.toLowerCase());
    const exchanges: HouseExchange[] = [];
    const spans: Array<[number, number]> = [];

    HOUSE_EXCHANGE_PATTERNS.forEach((re) => {
        for (const m of q.matchAll(re)) {
            if (typeof m.index !== "number") continue;
            const start = m.index;
            const end = start + m[0].length;
            if (spans.some(([s, e]) => start < e && end > s)) continue;

            const first = houseOfToken(m[1], m[2]);
            const second = houseOfToken(m[3], m[4]);
            if (first === undefined || second === undefined || first === second) continue;
            if (first < 1 || first > 12 || second < 1 || second > 12) continue;

            exchanges.push({ house1: Math.min(first, second), house2: Math.max(first, second) });
            spans.push([start, end]);
        }
    });

    return { exchanges, spans };
};

// The query with its house-lord and house-exchange phrases cut out, so the rest of the parser
// never sees their numbers, the "ලග්න" inside "ලග්නාධිපති" or the "ධන" inside "ධනස්ථානය".
const withoutHousePhrases = (query: string): string =>
    [...getHouseLordships(query).spans, ...getHouseExchanges(query).spans]
        .sort(([a], [b]) => a - b)
        .reduceRight((text, [start, end]) => text.slice(0, start) + text.slice(end), stripJoiners(query.toLowerCase()));

const signOfHouse = (ascendantSign: number, house: number): number => ((ascendantSign + house - 2) % 12) + 1;

// Parivartana between two houses: each house's lord sits in the other house's sign. Counted by
// sign, like the yoga engine, so it agrees with the Parivartana yoga tags.
const matchesHouseExchange = (
    { house1, house2 }: HouseExchange,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    const ascendant = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
    const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
    if (!ascendant || !planets) return false;
    const sign1 = signOfHouse(ascendant.sign as number, house1);
    const sign2 = signOfHouse(ascendant.sign as number, house2);
    const lord1 = SIGN_LORD[sign1];
    const lord2 = SIGN_LORD[sign2];
    if (lord1 === lord2) return false;
    return (
        planets.some(({ name, sign }) => name === lord1 && sign === sign2) &&
        planets.some(({ name, sign }) => name === lord2 && sign === sign1)
    );
};

// Whole-sign houses: house N is the Nth sign from the ascendant, and its lord is that sign's lord.
const matchesHouseLordship = (
    { house, inHouse }: HouseLordship,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    const ascendant = calculatedDetails?.ascendant as Record<string, unknown> | undefined;
    const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;
    if (!ascendant || !planets) return false;
    const lord = SIGN_LORD[(((ascendant.sign as number) + house - 2) % 12) + 1];
    return planets.some((p) => p.name === lord && getEffectivePlanetHouse(p) === inHouse);
};

// Pairs each sign word with the ascendant/navamsa trigger word it refers to, so a query like
// "ලග්නය ධනු නවාංශකය මේෂ" resolves ascendant=Sagittarius alongside navamsa_ascendant=Mesha,
// and its mirror "Mesha lagna Mesha Navanshaka" still yields both Mesha. Signs pair with their
// adjacent trigger in the reduced trigger/sign token sequence (accepting both "SIGN lagna" and
// "lagna SIGN" order), so a sign that falls between the two triggers (the lagna's ධනු sitting
// before නවාංශකය) is never also claimed as the navamsa sign. Leftover triggers fall back to
// their nearest still-unclaimed sign. Returns nulls when no trigger word appears.
const resolveAscendantNavamsaSigns = (query: string): { ascendant: number | null; navamsa: number | null } => {
    const q = stripJoiners(query.toLowerCase());

    const tokenTypeByWord = new Map<string, "ascendant" | "navamsa" | "sign">();
    const signValueByWord = new Map<string, number>();
    for (const w of ASCENDANT_WORDS) tokenTypeByWord.set(stripJoiners(w.toLowerCase()), "ascendant");
    for (const w of NAVAMSA_WORDS) tokenTypeByWord.set(stripJoiners(w.toLowerCase()), "navamsa");
    for (const [word, value] of Object.entries(ZODIAC_SIGN_NAMES)) {
        const skeleton = stripJoiners(word.toLowerCase());
        tokenTypeByWord.set(skeleton, "sign");
        signValueByWord.set(skeleton, value);
    }

    const tokens: Array<{ index: number; type: "ascendant" | "navamsa" | "sign"; value: number | null }> = [];
    const tokenRe = new RegExp(buildRegexSource([...tokenTypeByWord.keys()]), "g");
    for (const m of q.matchAll(tokenRe)) {
        const type = tokenTypeByWord.get(m[0]);
        if (type && typeof m.index === "number") {
            tokens.push({ index: m.index, type, value: type === "sign" ? (signValueByWord.get(m[0]) ?? null) : null });
        }
    }
    if (!tokens.some((t) => t.type !== "sign")) return { ascendant: null, navamsa: null };

    const result: { ascendant: number | null; navamsa: number | null } = { ascendant: null, navamsa: null };
    const claimedSigns = new Set<number>();

    const assign = (trigger: "ascendant" | "navamsa", value: number): void => {
        if (result[trigger] === null) result[trigger] = value;
    };

    for (let i = 0; i + 1 < tokens.length; i += 2) {
        const a = tokens[i];
        const b = tokens[i + 1];
        const sign = a.type === "sign" ? a : b.type === "sign" ? b : null;
        const trigger = a.type === "sign" ? b : b.type === "sign" ? a : null;
        if (sign !== null && sign.value !== null && trigger !== null && trigger.type !== "sign") {
            assign(trigger.type, sign.value);
            claimedSigns.add(sign.index);
        }
    }

    for (const trigger of tokens) {
        if (trigger.type === "sign" || result[trigger.type] !== null) continue;
        let best: { dist: number; index: number; value: number } | null = null;
        for (const s of tokens) {
            if (s.type !== "sign" || s.value === null || claimedSigns.has(s.index)) continue;
            const dist = Math.abs(trigger.index - s.index);
            if (best === null || dist < best.dist) {
                best = { dist, index: s.index, value: s.value };
            }
        }
        if (best !== null) {
            assign(trigger.type, best.value);
            claimedSigns.add(best.index);
        }
    }

    return result;
};

const getNavamsaSignMatch = (query: string): number | null => resolveAscendantNavamsaSigns(query).navamsa;

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

const PUSHKARA_PLANET_WORDS = ["ග්‍රහයන්", "ග්‍රහයින්", "ග්‍රහ", "planets", "planet", "grahas", "graha"];

type PushkaraQuery = { type: "ascendant_pushkara" } | { type: "pushkara_planet_count"; min: number };

// A Pushkara query without a named planet: a count ("pushkara planets 2", "පුෂ්කර ග්‍රහ 2") asks for
// at least that many Pushkara planets, a bare planet word for at least one, and "pushkara" alone
// for a Pushkara lagna.
const getPushkaraQuery = (query: string): PushkaraQuery => {
    const q = stripJoiners(query.toLowerCase());
    const count = q.match(/(?<!\d)(\d{1,2})(?!\d)/);
    if (count) return { type: "pushkara_planet_count", min: Math.max(1, parseInt(count[1], 10)) };
    if (PUSHKARA_PLANET_WORDS.some((word) => q.includes(stripJoiners(word)))) {
        return { type: "pushkara_planet_count", min: 1 };
    }
    return { type: "ascendant_pushkara" };
};

// Older documents predate the stored flag, so it is recomputed from the ascendant like the
// result card does — only when the ascendant degree is known, since the navamsa depends on it.
const isAscendantPushkara = (calculatedDetails: Record<string, unknown> | null): boolean => {
    if (!calculatedDetails) return false;
    if (calculatedDetails.isAscendantPushkara === true) return true;
    const ascendant = calculatedDetails.ascendant as Record<string, unknown> | undefined;
    if (!ascendant || typeof ascendant.sign !== "number" || typeof ascendant.degree !== "number") return false;
    return computeAscendantSpecialFlags(ascendant.sign, ascendant.degree, 0, 0).isAscendantPushkara;
};

const matchesPushkaraQuery = (
    pushkaraQuery: PushkaraQuery,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    if (pushkaraQuery.type === "ascendant_pushkara") return isAscendantPushkara(calculatedDetails);
    const planets = calculatedDetails?.pushkaraPlanets;
    return Array.isArray(planets) && planets.length >= pushkaraQuery.min;
};

const pushkaraConditionLabel = (pushkaraQuery: PushkaraQuery): string =>
    pushkaraQuery.type === "ascendant_pushkara" ? "pushkara_lagna" : `pushkara_count=${pushkaraQuery.min}`;

// A catalog name is negated when a negation word follows it, optionally after a generic yoga/dosha
// word ("කුජ නැති", "කුජ දෝෂය නොමැති", "Kuja dosha cancelled"), or an English negation word leads
// it ("without Kuja dosha", "no Dhana yoga").
const NEGATION_SUFFIX_RE = new RegExp(
    `^(?:\\s+(?:${buildRegexSource([...DOSHA_WORDS, ...SINHALA_YOGA, ...ENGLISH_YOGA])}))*\\s+(?:${buildRegexSource(NEGATION_SUFFIX_WORDS)})`,
    "u",
);
const NEGATION_PREFIX_RE = new RegExp(
    `(?:^|[^\\p{L}\\p{M}])(?:${buildRegexSource(NEGATION_PREFIX_WORDS)})[\\s-]+$`,
    "u",
);

const isNegatedSpan = (q: string, index: number, word: string): boolean =>
    NEGATION_SUFFIX_RE.test(q.slice(index + word.length)) || NEGATION_PREFIX_RE.test(q.slice(0, index));

const getExactMatch = (fullQuery: string): ExactMatch => {
    const query = withoutHousePhrases(fullQuery);
    const q = stripJoiners(query.toLowerCase());
    const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));
    const planetNakshatraLord = getPlanetNakshatraLord(query);
    const conditions: ExactMatch = [];

    // A nakshatra-lord query uses the nakshatra word as a trigger ("නැකත් අධිපති", "ගේ නැකත"),
    // never as a nakshatra name — skip the name resolver so it can't misread "නැකතක" as a
    // nakshatra id (e.g. Krittika's "කතක" skeleton inside "නැකතක").
    if (planetNakshatraLord === null && hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            conditions.push(
                hasAscendantWord
                    ? { type: "ascendant_nakshatra", nakshatra: nakshatraValue }
                    : { type: "nakshatra", nakshatra: nakshatraValue },
            );
        }
    }

    const planetStrengthPairs = getPlanetStrengthPairs(withoutPlanetRelations(query));
    for (const { planet, strength } of planetStrengthPairs) {
        conditions.push({ type: "planet_strength", planet, strength });
    }

    if (planetNakshatraLord !== null) {
        conditions.push({ type: "planet_nakshatra_lord", ...planetNakshatraLord });
    }

    const planetRole = getPlanetRole(query);
    if (planetRole !== null) {
        const rolePlanets = getPlanetMatches(query);
        for (const planet of rolePlanets) {
            conditions.push({ type: "planet_role", role: planetRole, planet });
        }
        if (planetRole === "pushkara" && rolePlanets.length === 0) {
            conditions.push(getPushkaraQuery(query));
        }
    }

    getPlanetRelations(query).relations.forEach((relation) => {
        conditions.push({ type: "planet_from_planet", ...relation });
    });

    getHouseLordships(fullQuery).lordships.forEach((lordship) => {
        conditions.push({ type: "house_lord_in_house", ...lordship });
    });

    getHouseExchanges(fullQuery).exchanges.forEach((exchange) => {
        conditions.push({ type: "house_exchange", ...exchange });
    });

    const houseQuery = withoutPlanetRelations(query);
    const explicitHouseByPlanet = new Map<number, number>();
    for (const [word, planetValue] of Object.entries(PLANET_NAMES)) {
        const normalizedWord = stripJoiners(word.toLowerCase());
        if (houseQuery.includes(normalizedWord)) {
            const numMatch = houseQuery.match(new RegExp(`${normalizedWord}\\s+(\\d+)`));
            if (numMatch) {
                const house = parseInt(numMatch[1], 10);
                if (house >= 1 && house <= 12) {
                    explicitHouseByPlanet.set(planetValue, house);
                }
            }
        }
    }

    if (hasAscendantWord) {
        const ascendantSignValue = resolveAscendantNavamsaSigns(query).ascendant;
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

    // A bare "planet sign" query (e.g. "සඳු වෘශ්චික", "කුජ මේෂ") means THAT planet is in THAT
    // sign. Skipped when an ascendant or navamsa trigger is present because there the sign words
    // already refer to the lagna/navamsa-lagna instead of a planet's Rashi position.
    if (!hasAscendantWord && navamsaSignValue === null) {
        for (const { planet, sign } of getPlanetSignPairs(query)) {
            conditions.push({ type: "planet_in_sign", planet, sign });
        }
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

    // Yoga/Dosha catalog names + aliases ("ශනි කුජ", "Shani Mangala", "මංගල") resolve to the
    // catalog id (US-YD-011). Generic "යෝග"/"dosha" trigger words alone stay in the keyword
    // scoring path (hasYoga/hasDosha) — no id is known without a name.
    // Name-collision precedence (SR-YD-323): a catalog word matches ONLY at word boundaries (so
    // "Mangal" never fires inside "Shani-Mangala"), AND when a LONGER registered catalog word
    // covers the same span the shorter one is dropped — otherwise "මංගල" (manglik keyword) would
    // fire inside "ශනි මංගල" (Shani Mangala) or "මංගල දෝෂ", and the ANDed conditions would demand
    // a present manglik that no chart carries. The full catalog name wins.
    const UNICODE_LETTER = /\p{L}/u;
    const catalogWordSpans: Array<{ word: string; id: string; index: number }> = [];
    for (const [word, id] of Object.entries({
        ...YOGA_DOSHA_NAME_WORDS,
        ...FAMILY_NAME_WORDS,
        ...CLASSIFICATION_NAME_WORDS,
    })) {
        const index = q.indexOf(word);
        if (index === -1) continue;
        const before = q[index - 1];
        const after = q[index + word.length];
        if (
            (before === undefined || !UNICODE_LETTER.test(before)) &&
            (after === undefined || !UNICODE_LETTER.test(after))
        ) {
            catalogWordSpans.push({ word, id, index });
        }
    }
    for (const match of catalogWordSpans) {
        const overshadowed = catalogWordSpans.some(
            (other) =>
                other.word.length > match.word.length &&
                other.index <= match.index &&
                other.index + other.word.length >= match.index + match.word.length,
        );
        if (overshadowed) continue;
        // Only a negated condition carries the flag, so plain ones keep their existing shape.
        const negation = isNegatedSpan(q, match.index, match.word) ? { negated: true } : {};
        // A bare planet alias ("කුජ" for Kuja dosha) names the planet unless negated ("කුජ නැති"),
        // so "කුජ ගුරුගෙන් 8 වැන්නේ" or "කුජ 10" does not also demand the dosha.
        if (match.word in PLANET_NAMES && !("negated" in negation)) continue;
        if (match.id in YOGA_FAMILIES) {
            conditions.push({ type: "yoga_family", familyId: match.id, ...negation });
        } else if (match.id in YOGA_CLASSIFICATIONS) {
            conditions.push({ type: "yoga_classification", ...YOGA_CLASSIFICATIONS[match.id], ...negation });
        } else if (yogaCatalogEntry(match.id as YogaId)) {
            conditions.push({ type: "yoga_id", yogaId: match.id, ...negation });
        } else if (doshaCatalogEntry(match.id as DoshaId)) {
            conditions.push({ type: "dosha_id", doshaId: match.id, ...negation });
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

const getAstroKeywords = (fullQuery: string): string[] => {
    const query = withoutHousePhrases(fullQuery);
    const q = stripJoiners(query.toLowerCase());
    const keywords: string[] = [];

    const planetNakshatraLord = getPlanetNakshatraLord(query);
    if (planetNakshatraLord === null && hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null) {
            const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));
            keywords.push(hasAscendantWord ? `ascendant_nakshatra:${nakshatraValue}` : `nakshatra:${nakshatraValue}`);
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

    if (planetNakshatraLord !== null) {
        const planetWord =
            Object.entries(PLANET_NAMES).find(([, v]) => v === planetNakshatraLord.planet)?.[0] ||
            planetNakshatraLord.planet;
        const lordWord =
            Object.entries(PLANET_NAMES).find(([, v]) => v === planetNakshatraLord.lord)?.[0] ||
            planetNakshatraLord.lord;
        keywords.push(`planet_nakshatra_lord:${planetWord}:${lordWord}`);
    }

    const strengthMatch = getStrengthMatch(withoutPlanetRelations(query));
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

    const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));
    if (!hasAscendantWord && getNavamsaSignMatch(query) === null) {
        for (const { planet, sign } of getPlanetSignPairs(query)) {
            const planetWord = Object.entries(PLANET_NAMES).find(([, v]) => v === planet)?.[0] || planet;
            const signWord = Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === sign)?.[0] || sign;
            keywords.push(`planet_in_sign:${planetWord}:${signWord}`);
        }
    }

    if (getNavamsaSignMatch(query) !== null) {
        keywords.push("navamsa_ascendant");
    }

    getPlanetRelations(query).relations.forEach(({ planet, from, distance }) => {
        keywords.push(`planet_from_planet:${planetWordOf(planet)}:${planetWordOf(from)}:${distance}`);
    });

    getHouseLordships(fullQuery).lordships.forEach(({ house, inHouse }) => {
        keywords.push(`house_lord_in_house:${house}:${inHouse}`);
    });

    getHouseExchanges(fullQuery).exchanges.forEach(({ house1, house2 }) => {
        keywords.push(`house_exchange:${house1}:${house2}`);
    });

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

// A yoga/dosha counts as formed only when present and not cancelled, so a negated condition
// ("කුජ දෝෂය නැති") matches charts where it is absent OR cancelled.
const isFormedEvaluation = ({ isPresent, cancellation }: Record<string, unknown>): boolean =>
    isPresent === true && (cancellation as { status?: number } | undefined)?.status !== CancellationStatus.CANCELLED;

const matchesYogaDoshaCondition = (
    condition: YogaDoshaCondition,
    calculatedDetails: Record<string, unknown> | null,
): boolean => {
    const evaluations = (
        condition.type === "dosha_id"
            ? (calculatedDetails?.doshas as Record<string, unknown> | undefined)?.doshas
            : calculatedDetails?.yogas
    ) as Array<Record<string, unknown>> | undefined;
    // No evaluations means the chart was never assessed — it neither has nor lacks the yoga/dosha.
    if (!evaluations) return false;

    const isFormed = evaluations.some((evaluation) => {
        if (!isFormedEvaluation(evaluation)) return false;
        switch (condition.type) {
            case "yoga_id":
                return evaluation.id === condition.yogaId;
            case "yoga_family":
                return (YOGA_FAMILIES[condition.familyId] ?? []).includes(evaluation.id as YogaId);
            case "yoga_classification":
                return evaluation.id === condition.yogaId && evaluation.classification === condition.classification;
            case "dosha_id":
                return evaluation.id === condition.doshaId;
        }
    });

    return condition.negated ? !isFormed : isFormed;
};

const scoreHoroscope = (
    h: Record<string, unknown>,
    fullQuery: string,
    calculatedDetails: Record<string, unknown> | null,
): { score: number; matchedConditions: string[] } => {
    const query = withoutHousePhrases(fullQuery);
    let score = 0;
    const q = stripJoiners(query.toLowerCase());
    const matchedConditions: string[] = [];

    const planetNakshatraLord = getPlanetNakshatraLord(query);
    if (planetNakshatraLord === null && hasNakshatraTriggerWord(query)) {
        const nakshatraValue = findNakshatraMatch(query);
        if (nakshatraValue !== null && calculatedDetails?.nakshatra) {
            const nakshatra = calculatedDetails.nakshatra as Record<string, unknown>;
            const moonNakshatra = nakshatra.moonNakshatra as Record<string, unknown> | undefined;
            const ascendantNakshatra = nakshatra.ascendantNakshatra as Record<string, unknown> | undefined;
            const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));

            if (hasAscendantWord) {
                if (ascendantNakshatra?.id === nakshatraValue) {
                    score += 1.0;
                    matchedConditions.push(`ascendant_nakshatra=${nakshatraValue}`);
                }
            } else {
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
    }

    if (planetNakshatraLord !== null) {
        const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
        const planets = calculatedDetails?.planets as Array<Record<string, unknown>> | undefined;

        let lordMatches = false;
        if (planetNakshatraLord.planet === Planet.MOON) {
            const moonNakshatra = nakshatra?.moonNakshatra as Record<string, unknown> | undefined;
            lordMatches = !!moonNakshatra && getNakshatraLord(moonNakshatra.id as number) === planetNakshatraLord.lord;
        } else if (planets) {
            const target = planets.find((p) => p.name === planetNakshatraLord.planet);
            lordMatches = !!target && getNakshatraLord(target.nakshatra as number) === planetNakshatraLord.lord;
        }

        if (lordMatches) {
            score += 1.0;
            const planetWord =
                Object.entries(PLANET_NAMES).find(([, v]) => v === planetNakshatraLord.planet)?.[0] ||
                planetNakshatraLord.planet;
            const lordWord =
                Object.entries(PLANET_NAMES).find(([, v]) => v === planetNakshatraLord.lord)?.[0] ||
                planetNakshatraLord.lord;
            matchedConditions.push(`planet_nakshatra_lord=${planetWord}:${lordWord}`);
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
                        matchedConditions.push(`${word}_in_sign=${signName}_house=${getEffectivePlanetHouse(p)}`);
                    }
                }
            }
        }
    }

    const namedPlanets = getPlanetMatches(query);
    const matchesNamedPlanet = (planetValue: unknown): boolean =>
        namedPlanets.length === 0 || namedPlanets.includes(planetValue as number);

    // A named planet placed in the sign the query pairs it with (e.g. "සඳු වෘශ්චික" → Moon in
    // Scorpio) is the strongest signal for a planet+sign query — a single bonus shared across any
    // matching horoscope rather than one added per duplicate word/alias. Skipped when an ascendant
    // or navamsa trigger is present because there the sign words refer to the lagna/navamsa-lagna.
    const hasAscendantWord = ASCENDANT_WORDS.some((w) => q.includes(stripJoiners(w.toLowerCase())));
    const planetSignPairs = !hasAscendantWord && navamsaSignValue === null ? getPlanetSignPairs(query) : [];
    const matchedPlanetSign = new Set<string>();
    if (planetSignPairs.length > 0 && calculatedDetails?.planets) {
        const planets = calculatedDetails.planets as Array<Record<string, unknown>>;
        for (const { planet, sign } of planetSignPairs) {
            if (matchedPlanetSign.has(`${planet}:${sign}`)) continue;
            if (planets.some((p) => p.name === planet && p.sign === sign)) {
                score += 1.0;
                matchedPlanetSign.add(`${planet}:${sign}`);
                const signWord = Object.entries(ZODIAC_SIGN_NAMES).find(([, v]) => v === sign)?.[0] || sign;
                matchedConditions.push(`planet_in_sign=${planet}_${signWord}`);
            }
        }
    }

    getPlanetRelations(query).relations.forEach((relation) => {
        if (!matchesPlanetRelation(relation, calculatedDetails)) return;
        score += 1.0;
        const { planet, from, distance } = relation;
        matchedConditions.push(`${planetWordOf(planet)}_from_${planetWordOf(from)}=${distance}`);
    });

    getHouseLordships(fullQuery).lordships.forEach((lordship) => {
        if (!matchesHouseLordship(lordship, calculatedDetails)) return;
        score += 1.0;
        matchedConditions.push(`house_${lordship.house}_lord_in=${lordship.inHouse}`);
    });

    getHouseExchanges(fullQuery).exchanges.forEach((exchange) => {
        if (!matchesHouseExchange(exchange, calculatedDetails)) return;
        score += 1.0;
        matchedConditions.push(`house_exchange=${exchange.house1}-${exchange.house2}`);
    });

    const strengthMatch = getStrengthMatch(withoutPlanetRelations(query));

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

    const hasYoga =
        SINHALA_YOGA.some((w) => q.includes(w)) ||
        ENGLISH_YOGA.some((w) => q.includes(w)) ||
        YOGA_CATALOG.some((entry) =>
            [entry.keywordEn, entry.keywordSi, ...entry.searchAliasesEn, ...entry.searchAliasesSi].some((word) =>
                q.includes(stripJoiners(word.toLowerCase())),
            ),
        );

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
        } else if (planetRole === "pushkara") {
            const pushkaraQuery = getPushkaraQuery(query);
            if (matchesPushkaraQuery(pushkaraQuery, calculatedDetails)) {
                score += 0.4;
                matchedConditions.push(pushkaraConditionLabel(pushkaraQuery));
            }
        } else if (hasAnyPlanetRole(planetRole, calculatedDetails)) {
            score += 0.4;
            matchedConditions.push(`${planetRole}_present`);
        }
    }

    if (hasYoga) {
        if (calculatedDetails?.yogas) {
            const yogas = calculatedDetails.yogas as Array<Record<string, unknown>>;
            const presentYogas = yogas.filter(isFormedEvaluation);
            if (presentYogas.length > 0) {
                score += 0.4;
                for (const y of presentYogas) {
                    const catalogEntry = typeof y.id === "string" ? yogaCatalogEntry(y.id as YogaId) : undefined;
                    matchedConditions.push(`yoga=${catalogEntry ? catalogEntry.keywordEn : y.name}`);
                }
            }
        }
    }

    const hasDosha =
        q.includes("දෝෂ") ||
        q.includes("dosha") ||
        q.includes("මංගල") ||
        DOSHA_CATALOG.some((entry) =>
            [entry.keywordEn, entry.keywordSi, ...entry.searchAliasesEn, ...entry.searchAliasesSi].some((word) =>
                q.includes(stripJoiners(word.toLowerCase())),
            ),
        );

    if (hasDosha) {
        if (calculatedDetails?.doshas) {
            const doshas = calculatedDetails.doshas as Record<string, unknown>;
            const doshaList = doshas.doshas as Array<Record<string, unknown>> | undefined;
            if (doshaList && doshaList.length > 0) {
                score += 0.4;
                for (const d of doshaList) {
                    if (isFormedEvaluation(d)) {
                        const catalogEntry = typeof d.id === "string" ? doshaCatalogEntry(d.id as DoshaId) : undefined;
                        matchedConditions.push(`dosha=${catalogEntry ? catalogEntry.keywordEn : d.name}`);
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
                    if (p.name === planetMatch[1] && getEffectivePlanetHouse(p) === houseNum) {
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
    const parsedQuery = normalizeSinhalaSpelling(query);
    const keywords = getAstroKeywords(parsedQuery);

    // Queries can carry several intents, e.g. "මේෂ ලග්නය, කුජ 1 හෝ කුජ 10". A comma
    // splits the query into groups that are ANDed together (all must match); within a
    // group a හෝ (OR) separator splits it into clauses, a group matching if ANY clause
    // matches. A comma-less query is a single group with the existing AND semantics.
    const groups: QueryGroup[] = splitQueryGroups(parsedQuery).map((group) => ({
        clauses: splitQueryClauses(group).map((clause) => ({
            raw: clause,
            exactMatch: getExactMatch(clause),
            keywords: getAstroKeywords(clause),
            detectedLanguage: detectLanguage(clause),
        })),
    }));

    // Negations in single-clause groups must hold for every result (a හෝ clause may be skipped).
    const negatedConditions: YogaDoshaCondition[] = [];
    groups.forEach(({ clauses }) => {
        if (clauses.length !== 1) return;
        clauses[0].exactMatch.forEach((condition) => {
            if ("negated" in condition && condition.negated) negatedConditions.push(condition);
        });
    });

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

        const rawCalculated = await CalculatedDetails.findOne({
            "horoscope.id": hId,
        }).lean();

        // Yoga/dosha name queries match the SAME read-time view the detail panel renders:
        // stored v2 evaluations win; legacy/v1 docs recompute purely from stored chart facts
        // (resolveYogaDoshas). Without this, a pre-v2 horoscope that shows the Shani Mangala
        // Dosha tag could never be found by name. Other fields flow through untouched.
        const resolvedYogaDoshas = resolveYogaDoshas(rawCalculated);
        const calculatedDetails =
            rawCalculated && resolvedYogaDoshas
                ? {
                      ...rawCalculated,
                      yogas: resolvedYogaDoshas.yogas,
                      doshas: { doshas: resolvedYogaDoshas.doshas },
                  }
                : rawCalculated;

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
                                        p.name === condition.planet && getEffectivePlanetHouse(p) === condition.house,
                                );
                            }
                            case "planet_in_sign": {
                                const planets = calculatedDetails?.planets as
                                    Array<Record<string, unknown>> | undefined;
                                if (!planets) return false;
                                return planets.some((p) => p.name === condition.planet && p.sign === condition.sign);
                            }
                            case "planet_from_planet": {
                                return matchesPlanetRelation(
                                    condition,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            }
                            case "house_exchange": {
                                return matchesHouseExchange(
                                    condition,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            }
                            case "house_lord_in_house": {
                                return matchesHouseLordship(
                                    condition,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            }
                            case "nakshatra": {
                                const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
                                const moonNakshatra = nakshatra?.moonNakshatra as Record<string, unknown> | undefined;
                                return !!moonNakshatra && moonNakshatra.id === condition.nakshatra;
                            }
                            case "ascendant_nakshatra": {
                                const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
                                const ascendantNakshatra = nakshatra?.ascendantNakshatra as
                                    Record<string, unknown> | undefined;
                                return !!ascendantNakshatra && ascendantNakshatra.id === condition.nakshatra;
                            }
                            case "planet_nakshatra_lord": {
                                const nakshatra = calculatedDetails?.nakshatra as Record<string, unknown> | undefined;
                                const planets = calculatedDetails?.planets as
                                    Array<Record<string, unknown>> | undefined;

                                if (condition.planet === Planet.MOON) {
                                    const moonNakshatra = nakshatra?.moonNakshatra as
                                        Record<string, unknown> | undefined;
                                    return (
                                        !!moonNakshatra &&
                                        getNakshatraLord(moonNakshatra.id as number) === condition.lord
                                    );
                                }

                                if (!planets) return false;
                                const target = planets.find((p) => p.name === condition.planet);
                                return !!target && getNakshatraLord(target.nakshatra as number) === condition.lord;
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
                            case "ascendant_pushkara":
                            case "pushkara_planet_count":
                                return matchesPushkaraQuery(
                                    condition,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            case "bhava_suchika": {
                                return resolveLagnaBhavaSuchika(calculatedDetails) === condition.value;
                            }
                            case "planet_bhava_suchika": {
                                return (
                                    resolvePlanetBhavaSuchika(calculatedDetails, condition.planet) === condition.value
                                );
                            }
                            case "yoga_id":
                            case "yoga_family":
                            case "yoga_classification":
                            case "dosha_id":
                                return matchesYogaDoshaCondition(
                                    condition,
                                    calculatedDetails as Record<string, unknown> | null,
                                );
                            default:
                                return false;
                        }
                    });
                    if (!passesExact) continue;
                }

                const { score: keywordClauseScore, matchedConditions } = scoreHoroscope(
                    h as unknown as Record<string, unknown>,
                    clause.raw,
                    calculatedDetails as unknown as Record<string, unknown> | null,
                );

                // Keyword scoring only rewards what a chart HAS, so each passed negated yoga/dosha
                // condition ("කුජ දෝෂය නැති") adds its own score — otherwise a chart lacking it
                // could score 0 and drop out.
                let clauseScore = keywordClauseScore;
                clauseExact.forEach((condition) => {
                    if (!("negated" in condition)) return;
                    const { type, negated, ...ids } = condition;
                    if (!negated) return;
                    clauseScore += 0.4;
                    matchedConditions.push(`not_${type}=${Object.values(ids).join(".")}`);
                });

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

        // A vector hit may stand in for a failed keyword match, but never for a chart that has a
        // yoga/dosha the query explicitly excludes ("කුජ දෝෂය නැති").
        const violatesNegation = negatedConditions.some(
            (condition) => !matchesYogaDoshaCondition(condition, calculatedDetails as Record<string, unknown> | null),
        );
        if (violatesNegation || (!allGroupsMatch && !vectorScores.has(hId))) continue;

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
