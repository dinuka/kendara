/**
 * Yoga / Dosha — rule evaluators.
 * Each registered catalog rule (data-model §Rule Catalog) maps to a pure evaluator that inspects
 * ChartFacts and emits a RuleEvaluation. Rules only reuse stored aspect records (US-YD-002 Edge).
 *
 * Domain split (docs/agni-marutha-dosha.md): Shani Mangala (Dosha) is the NARROW subset — exactly
 * SM-1 conjunct / SM-2 7th-from-each-other / SM-3 4-10. SM-2 and SM-3 additionally require the
 * MUTUAL graha drishti record (both planets aspecting each other through the given locations on the
 * per-planet orbs): a purely positional 7th/4-10 placement is NOT Shani Mangala when only one
 * direction aspects the other (corrected case 6a68e773 — Saturn↔Mars one-way). Agni Marutha (Dosha)
 * is the BROAD Saturn–Mars relationship — AM-1..AM-8 (conjunction, one-directional aspects, sign
 * ownership, nakshatra ownership, parivartana). Rules are computed independently for each dosha;
 * every SM result is naturally covered on the AM side, but AM must never promote itself into SM.
 */
import {
    areConjunct,
    aspectsTheOther,
    hasMutualAspectAngle,
    hasMutualFourTenAspect,
    isParivartana,
    nakshatraLord,
    planetFact,
    relativeHouseGap,
    SIGN_LORDS,
} from "@/lib/yogaDosha/relationships";
import {
    AgniMaruthaRuleId,
    ChartFacts,
    ManglikRuleId,
    RuleEvaluation,
    RuleId,
    ShaniMangalaRuleId,
} from "@/lib/yogaDosha/types";

export const SHANI_MANGALA_PLANETS = [7, 3] as const; // Saturn, Mars
export const AGNI_MARUTHA_PLANETS = [7, 3] as const; // Saturn, Mars

const MARRIAGE_HOUSES = [1, 4, 7, 8, 12];

function absent(rule: RuleId): RuleEvaluation {
    return { rule, triggered: false, strength: 4, reasonKey: "" };
}

function fired(
    rule: RuleId,
    strength: number,
    reasonKey: string,
    params?: RuleEvaluation["params"],
    houseImpact?: number[],
): RuleEvaluation {
    return { rule, triggered: true, strength, reasonKey, params, houseImpact };
}

function evaluateShaniMangalaRule(rule: ShaniMangalaRuleId, facts: ChartFacts): RuleEvaluation {
    const saturn = planetFact(facts, SHANI_MANGALA_PLANETS[0]);
    const mars = planetFact(facts, SHANI_MANGALA_PLANETS[1]);
    if (!saturn || !mars) return absent(rule);

    switch (rule) {
        // SM-1: Saturn and Mars are conjunct / in the same sign.
        case "shaniMangala.sm01":
            if (!areConjunct(saturn, mars)) return absent(rule);
            return fired(rule, 1, "rule.sm01", { house: saturn.house }, [saturn.house]);

        // SM-2: Saturn and Mars are 7th from each other (opposite houses) AND both aspect each
        // other on the opposition's per-planet orbs (stored mutual 180° drishti record — a
        // positional-only pair where one direction does not aspect is NOT Shani Mangala).
        case "shaniMangala.sm02": {
            const gap = relativeHouseGap(saturn, mars);
            if (gap !== 6) return absent(rule);
            if (!hasMutualAspectAngle(saturn, mars, 180)) return absent(rule);
            return fired(rule, 2, "rule.sm02", { gap }, [saturn.house, mars.house]);
        }

        // SM-3: Mars is 10th from Saturn AND Saturn is 4th from Mars (the same mutual 4-10
        // relationship — the doc requires both clauses) with the mutual 90°/270° drishti record
        // (both planets aspecting each other on their orbs).
        case "shaniMangala.sm03": {
            const marsFromSaturn = relativeHouseGap(saturn, mars);
            const saturnFromMars = relativeHouseGap(mars, saturn);
            if (marsFromSaturn !== 9 || saturnFromMars !== 3) return absent(rule);
            if (!hasMutualFourTenAspect(saturn, mars)) return absent(rule);
            return fired(rule, 2, "rule.sm03", { gap: marsFromSaturn }, [saturn.house, mars.house]);
        }

        default:
            return absent(rule);
    }
}

function evaluateAgniMaruthaRule(rule: AgniMaruthaRuleId, facts: ChartFacts): RuleEvaluation {
    const saturn = planetFact(facts, AGNI_MARUTHA_PLANETS[0]);
    const mars = planetFact(facts, AGNI_MARUTHA_PLANETS[1]);
    if (!saturn || !mars) return absent(rule);

    switch (rule) {
        // AM-1: Saturn and Mars are conjunct / in the same sign.
        case "agniMarutha.am01":
            if (!areConjunct(saturn, mars)) return absent(rule);
            return fired(rule, 1, "rule.am01", { house: saturn.house }, [saturn.house]);

        // AM-2: Mars aspects Saturn (one-directional, reuses stored drishti records).
        case "agniMarutha.am02":
            if (!aspectsTheOther(mars, saturn.planetName)) return absent(rule);
            return fired(rule, 2, "rule.am02", undefined, [saturn.house, mars.house]);

        // AM-3: Saturn aspects Mars.
        case "agniMarutha.am03":
            if (!aspectsTheOther(saturn, mars.planetName)) return absent(rule);
            return fired(rule, 2, "rule.am03", undefined, [saturn.house, mars.house]);

        // AM-4: Saturn is placed in a sign owned by Mars (Aries/Vrishchika).
        case "agniMarutha.am04":
            if (SIGN_LORDS[saturn.sign] !== 3) return absent(rule);
            return fired(rule, 2, "rule.am04", { sign: saturn.sign }, [saturn.house]);

        // AM-5: Mars is placed in a sign owned by Saturn (Capricorn/Kumbha).
        case "agniMarutha.am05":
            if (SIGN_LORDS[mars.sign] !== 7) return absent(rule);
            return fired(rule, 2, "rule.am05", { sign: mars.sign }, [mars.house]);

        // AM-6: Saturn is placed in a nakshatra owned by Mars.
        case "agniMarutha.am06":
            if (nakshatraLord(saturn.nakshatra) !== 3) return absent(rule);
            return fired(rule, 3, "rule.am06", { nakshatra: saturn.nakshatra }, [saturn.house]);

        // AM-7: Mars is placed in a nakshatra owned by Saturn.
        case "agniMarutha.am07":
            if (nakshatraLord(mars.nakshatra) !== 7) return absent(rule);
            return fired(rule, 3, "rule.am07", { nakshatra: mars.nakshatra }, [mars.house]);

        // AM-8: Saturn and Mars are in sign exchange (parivartana).
        case "agniMarutha.am08":
            if (!isParivartana(saturn, mars)) return absent(rule);
            return fired(rule, 1, "rule.am08", undefined, [saturn.house, mars.house]);

        default:
            return absent(rule);
    }
}

function evaluateManglikRule(rule: ManglikRuleId, facts: ChartFacts): RuleEvaluation {
    switch (rule) {
        case "manglik.mk01": {
            const mars = planetFact(facts, 3);
            if (!mars) return absent(rule);
            if (!MARRIAGE_HOUSES.includes(mars.house)) return absent(rule);
            return fired(rule, 2, "rule.mk01", { house: mars.house }, [mars.house]);
        }
        default:
            return absent(rule);
    }
}

/** Evaluates every catalog rule of an entry (catalog order). Triggers dedupe upstream. */
export function evaluateRule(rule: RuleId, facts: ChartFacts): RuleEvaluation {
    if (rule.startsWith("shaniMangala.")) return evaluateShaniMangalaRule(rule as ShaniMangalaRuleId, facts);
    if (rule.startsWith("agniMarutha.")) return evaluateAgniMaruthaRule(rule as AgniMaruthaRuleId, facts);
    if (rule.startsWith("manglik.")) return evaluateManglikRule(rule as ManglikRuleId, facts);
    return absent(rule);
}