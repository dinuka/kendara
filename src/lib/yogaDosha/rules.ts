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
 *
 * Kuja Dosha (docs/kuja-doshaya.md): Mars placement in houses [1, 2, 4, 7, 8, 12] evaluated
 * independently from three reference points — Lagna (mk01), Moon (mk02), Venus (mk03). Each
 * reference is tested and cancellation-checked independently. houseImpact records the
 * reference-relative dosha house (same value as params.house), keeping context/themes inside
 * the confirmed dosha-house set [1, 2, 4, 7, 8, 12].
 */
import {
    SIGN_LORDS,
    areConjunct,
    aspectsTheOther,
    hasMutualAspectAngle,
    hasMutualAspectByDrishti,
    hasMutualFourTenAspect,
    isParivartana,
    nakshatraLord,
    planetFact,
    relativeHouseGap,
} from "@/lib/yogaDosha/relationships";
import {
    AgniMaruthaRuleId,
    ChartFacts,
    DharmaKarmadhipatiRuleId,
    ManglikRuleId,
    RuleEvaluation,
    RuleId,
    ShaniMangalaRuleId,
} from "@/lib/yogaDosha/types";

export const SHANI_MANGALA_PLANETS = [7, 3] as const; // Saturn, Mars
export const AGNI_MARUTHA_PLANETS = [7, 3] as const; // Saturn, Mars
export const KUJA_DOSHA_PLANETS = [3] as const; // Mars
export const DHARMA_KARMADHIPATI_HOUSES = [9, 10] as const; // Dharma (9th) & Karma (10th)

/**
 * Houses that cause Kuja Dosha when Mars occupies them relative to a reference point
 * (docs/kuja-doshaya.md §3): [1, 2, 4, 7, 8, 12]. Explicitly NOT house 3/5/6/9/10/11.
 */
export const KUJA_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];

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

/** Whole-sign house of Mars counted from a reference sign (docs/kuja-doshaya.md §2).
 *  House 1 = same sign as the reference. referenceSign/marsSign are ZodiacSign enums (1..12). */
function marsHouseFromReference(marsHouse: number, referenceSign: number, ascendantSign: number): number {
    const referenceHouse = referenceSign - ascendantSign + 1;
    const normalizedReferenceHouse = ((((referenceHouse - 1) % 12) + 12) % 12) + 1;
    return ((marsHouse - normalizedReferenceHouse + 12) % 12) + 1;
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

/**
 * Kuja Dosha — evaluated independently per reference point (docs/kuja-doshaya.md §4):
 *  - MK-01 from Lagna
 *  - MK-02 from Moon (Chandra)
 *  - MK-03 from Venus (Shukra)
 * Each reference independently identifies and is independently cancellation-tested.
 */
function evaluateManglikRule(rule: ManglikRuleId, facts: ChartFacts): RuleEvaluation {
    const mars = planetFact(facts, KUJA_DOSHA_PLANETS[0]);
    if (!mars) return absent(rule);

    switch (rule) {
        // MK-01: Mars in a Kuja Dosha house from the Lagna / ascendant.
        case "manglik.mk01": {
            const marsHouse = marsHouseFromReference(mars.house, facts.ascendantSign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk01", { house: marsHouse, reference: "Lagna" }, [marsHouse]);
        }

        // MK-02: Mars in a Kuja Dosha house from the Moon (Chandra).
        case "manglik.mk02": {
            const moon = planetFact(facts, 2);
            if (!moon) return absent(rule);
            const marsHouse = marsHouseFromReference(mars.house, moon.sign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk02", { house: marsHouse, reference: "Moon" }, [marsHouse]);
        }

        // MK-03: Mars in a Kuja Dosha house from Venus (Shukra).
        case "manglik.mk03": {
            const venus = planetFact(facts, 6);
            if (!venus) return absent(rule);
            const marsHouse = marsHouseFromReference(mars.house, venus.sign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk03", { house: marsHouse, reference: "Venus" }, [marsHouse]);
        }

        default:
            return absent(rule);
    }
}

/**
 * Dharma Karmadhipati Yoga — the 9th lord (Dharma) connects with the 10th lord (Karma)
 * via one of the qualifying sambandha relationships (docs/dharma-karmadipathi-yogaya.md):
 *  - DK-01 Conjunction: both lords in the same sign/house
 *  - DK-02 Mutual aspect: the lords aspect each other on the per-planet orbs (stored drishti)
 *  - DK-03 Parivartana: each lord occupies the sign owned by the other
 * Formation only — strength of the lords is NOT used to create the yoga.
 */

/** Whole-sign sign of house N counted from the ascendant (house 1 = ascendant sign). */
function signOfHouseFromAscendant(ascendantSign: number, house: number): number {
    return ((ascendantSign + house - 2) % 12) + 1;
}

/** Lord planet of a whole-sign house from the ascendant (via SIGN_LORDS). */
function lordOfHouse(ascendantSign: number, house: number): number {
    const sign = signOfHouseFromAscendant(ascendantSign, house);
    return SIGN_LORDS[sign];
}

function evaluateDharmaKarmadhipatiRule(rule: DharmaKarmadhipatiRuleId, facts: ChartFacts): RuleEvaluation {
    if (!facts.ascendantSign) return absent(rule);

    const dharmaLord = lordOfHouse(facts.ascendantSign, 9);
    const karmaLord = lordOfHouse(facts.ascendantSign, 10);
    const dharmaPlanet = planetFact(facts, dharmaLord);
    const karmaPlanet = planetFact(facts, karmaLord);
    if (!dharmaPlanet || !karmaPlanet) return absent(rule);

    switch (rule) {
        // DK-01: 9th and 10th lords are conjunct (same sign + house, mutual 0° records in orb).
        case "dharmaKarmadhipati.dk01":
            if (!areConjunct(dharmaPlanet, karmaPlanet)) return absent(rule);
            return fired(rule, 1, "rule.dk01", { dharmaLord, karmaLord }, [
                DHARMA_KARMADHIPATI_HOUSES[0],
                DHARMA_KARMADHIPATI_HOUSES[1],
            ]);

        // DK-02: 9th and 10th lords MUTUALLY aspect each other (docs/dharma-karmadipathi-yogaya.md §19 —
        // "9th lord aspects 10th lord AND 10th lord aspects 9th lord" — both directions required). A
        // 0° conjunction record is yuti, not drishti, so it never satisfies DK-02; conjunction charts
        // report DK-01 only (reported for horoscope 6a68e63506d2d7cd52c6fa9d).
        case "dharmaKarmadhipati.dk02":
            if (!hasMutualAspectByDrishti(dharmaPlanet, karmaPlanet)) return absent(rule);
            return fired(rule, 2, "rule.dk02", { dharmaLord, karmaLord }, [
                DHARMA_KARMADHIPATI_HOUSES[0],
                DHARMA_KARMADHIPATI_HOUSES[1],
            ]);

        // DK-03: 9th and 10th lords exchange signs (parivartana).
        case "dharmaKarmadhipati.dk03":
            if (!isParivartana(dharmaPlanet, karmaPlanet)) return absent(rule);
            return fired(rule, 1, "rule.dk03", { dharmaLord, karmaLord }, [
                DHARMA_KARMADHIPATI_HOUSES[0],
                DHARMA_KARMADHIPATI_HOUSES[1],
            ]);

        default:
            return absent(rule);
    }
}

/** Evaluates every catalog rule of an entry (catalog order). Triggers dedupe upstream. */
export function evaluateRule(rule: RuleId, facts: ChartFacts): RuleEvaluation {
    if (rule.startsWith("shaniMangala.")) return evaluateShaniMangalaRule(rule as ShaniMangalaRuleId, facts);
    if (rule.startsWith("agniMarutha.")) return evaluateAgniMaruthaRule(rule as AgniMaruthaRuleId, facts);
    if (rule.startsWith("manglik.")) return evaluateManglikRule(rule as ManglikRuleId, facts);
    if (rule.startsWith("dharmaKarmadhipati."))
        return evaluateDharmaKarmadhipatiRule(rule as DharmaKarmadhipatiRuleId, facts);
    return absent(rule);
}
