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
import { Planet, PlanetaryStrength } from "@/lib/astrologyEnums";
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
    BhadraRuleId,
    ChartFacts,
    DeeptaYogaRuleId,
    DhanaYogaRuleId,
    DharmaKarmadhipatiRuleId,
    HamsaRuleId,
    KalaAmurthaRuleId,
    KalaSarpaRuleId,
    MalavyaRuleId,
    ManglikRuleId,
    NeechaRajaYogaRuleId,
    ParasharaYogaRuleId,
    PlanetFact,
    RuchakaRuleId,
    RuleEvaluation,
    RuleId,
    SashaRuleId,
    ShaniMangalaRuleId,
} from "@/lib/yogaDosha/types";

export const SHANI_MANGALA_PLANETS = [7, 3] as const; // Saturn, Mars
export const AGNI_MARUTHA_PLANETS = [7, 3] as const; // Saturn, Mars
export const KUJA_DOSHA_PLANETS = [3] as const; // Mars

/** Kendra houses (1st, 4th, 7th, 10th) — the Pancha Maha Purusha kendra condition, evaluated
 *  against both the Lagna-based house and the Chandra (Moon) lagna. */
const KENDRA_HOUSES = [1, 4, 7, 10];

/** Pancha Maha Purusha Yoga: planet → [own signs, exaltation sign]. */
const PMP_PLANET_DATA: Record<number, { ownSigns: number[]; exaltSign: number }> = {
    3: { ownSigns: [1, 8], exaltSign: 10 }, // Mars: Aries, Scorpio; exalt Capricorn
    4: { ownSigns: [3, 6], exaltSign: 6 }, // Mercury: Gemini, Virgo; exalt Virgo
    5: { ownSigns: [9, 12], exaltSign: 4 }, // Jupiter: Sagittarius, Pisces; exalt Cancer
    6: { ownSigns: [2, 7], exaltSign: 12 }, // Venus: Taurus, Libra; exalt Pisces
    7: { ownSigns: [10, 11], exaltSign: 7 }, // Saturn: Capricorn, Aquarius; exalt Libra
};

/**
 * Houses that cause Kuja Dosha when Mars occupies them relative to a reference point
 * (docs/kuja-doshaya.md §3): [1, 2, 4, 7, 8, 12]. Explicitly NOT house 3/5/6/9/10/11.
 */
export const KUJA_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];

/** The seven classical planets considered by Kala Sarpa / Kala Amurtha / Deepta Yoga
 *  (docs/kala sarpa dosha.md §1). Rahu (8) and Ketu (9) are the reference points, never counted. */
export const CLASSICAL_PLANETS = [1, 2, 3, 4, 5, 6, 7];

/** Planets capable of producing a Pancha Maha Purusha Yoga / Deepta Yoga (the five non-luminaries).
 *  Sun, Moon, Rahu and Ketu can never be the Deepta Yoga planet. */
export const DEEPTA_YOGA_PLANETS = [3, 4, 5, 6, 7];

/** Deepta Yoga display classifications keyed by planet (docs/kala sarpa dosha.md §2). */
export const DEEPTA_YOGA_NAMES: Record<number, string> = {
    3: "Kuja",
    4: "Budha",
    5: "Guru",
    6: "Shukra",
    7: "Shani",
};

/** Kala Sarpa type classifications keyed by Rahu's house (1..12, docs/kala sarpa dosha.md §5). */
export const KALA_SARPA_NAMES: Record<number, string> = {
    1: "Ananta",
    2: "Kulika",
    3: "Vasuki",
    4: "Shankhapala",
    5: "Padma",
    6: "Mahapadma",
    7: "Takshaka",
    8: "Karkotaka",
    9: "Shankhachooda",
    10: "Ghataka",
    11: "Vishadhara",
    12: "Sheshanaga",
};

/** Upachaya houses (2, 3, 4, 9, 10, 11) for Neecha Raja Yoga (docs/raja-yoga.md).
 *  A debilitated planet in any of these houses forms a Raja Yoga. */
const UPACHAYA_HOUSES = [2, 3, 4, 9, 10, 11];

function absent(rule: RuleId): RuleEvaluation {
    return { rule, triggered: false, strength: 4, reasonKey: "" };
}

function fired(
    rule: RuleId,
    strength: number,
    reasonKey: string,
    params?: RuleEvaluation["params"],
    houseImpact?: number[],
    classification?: string,
): RuleEvaluation {
    return { rule, triggered: true, strength, reasonKey, params, houseImpact, classification };
}

/** Whole-sign house of a planet counted from a reference sign (docs/kuja-doshaya.md §2).
 *  House 1 = same sign as the reference. planetHouse is the planet's Lagna-based house;
 *  referenceSign/ascendantSign are ZodiacSign enums (1..12). */
function houseFromReference(planetHouse: number, referenceSign: number, ascendantSign: number): number {
    const referenceHouse = referenceSign - ascendantSign + 1;
    const normalizedReferenceHouse = ((((referenceHouse - 1) % 12) + 12) % 12) + 1;
    return ((planetHouse - normalizedReferenceHouse + 12) % 12) + 1;
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
            const marsHouse = houseFromReference(mars.house, facts.ascendantSign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk01", { house: marsHouse, reference: "Lagna" }, [marsHouse]);
        }

        // MK-02: Mars in a Kuja Dosha house from the Moon (Chandra).
        case "manglik.mk02": {
            const moon = planetFact(facts, Planet.MOON);
            if (!moon) return absent(rule);
            const marsHouse = houseFromReference(mars.house, moon.sign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk02", { house: marsHouse, reference: "Moon" }, [marsHouse]);
        }

        // MK-03: Mars in a Kuja Dosha house from Venus (Shukra).
        case "manglik.mk03": {
            const venus = planetFact(facts, Planet.VENUS);
            if (!venus) return absent(rule);
            const marsHouse = houseFromReference(mars.house, venus.sign, facts.ascendantSign);
            if (!KUJA_DOSHA_HOUSES.includes(marsHouse)) return absent(rule);
            return fired(rule, 2, "rule.mk03", { house: marsHouse, reference: "Venus" }, [marsHouse]);
        }

        default:
            return absent(rule);
    }
}

/**
 * Parashara Sambandha yogas (docs/parashara-yoga.md): each yoga forms when the lords of a defined
 * pair of adjacent houses — 1-2 Pushkala, 2-3 Raja Chitta, 3-4 Champaka, 4-5 Amathya, 5-6 Dharuka
 * Karma, 6-7 Priyamrityu, 8-9 Bhagya Vyaya, 9-10 Dharma Karmadhipati, 10-11 Bhumi Dravya, 11-12
 * Rina Vyaya, 12-1 Chitta Hani — are CONNECTED through any one of the three qualifying sambandhas:
 *  - Conjunction: both lords in the same sign/house (mutual stored 0° records)
 *  - Mutual aspect: the lords aspect each other on the per-planet orbs (stored graha drishti)
 *  - Parivartana: each lord occupies the sign owned by the other
 * House lordships are evaluated from THREE reference points — Lagna, Moon and Sun (the doc adds
 * "මේවා චන්ද්ර ලග්නයෙන් හා සුර්ය ලග්නයෙන්ද සෑදේ"). A yoga does NOT form when the same planet
 * rules both houses (the doc's "එකම ග්රහයා වුවහොත් මෙය නොයැදේ" — e.g. Saturn owns both Makara and
 * Kumbha, so a reference whose two houses fall on Capricorn/Aquarius can never create a Parashara
 * yoga). Priyamrityu forms from EITHER the 6-7 pair OR the 7-8 pair. Formation only — strength of
 * the lords is NOT used to create the yoga.
 */

/** Whole-sign sign of house N counted from a reference sign (house 1 = the reference sign itself). */
function signOfHouseFromReference(referenceSign: number, house: number): number {
    return ((referenceSign + house - 2) % 12) + 1;
}

/** Lord planet of a whole-sign house counted from a reference sign (via SIGN_LORDS). */
function lordOfSign(referenceSign: number, house: number): number {
    return SIGN_LORDS[signOfHouseFromReference(referenceSign, house)];
}

/** House pairs each Parashara yoga connects (docs/parashara-yoga.md). */
const PARASHARA_YOGA_HOUSE_PAIRS: Record<string, number[][]> = {
    pushkala: [[1, 2]],
    rajaChitta: [[2, 3]],
    champaka: [[3, 4]],
    amathya: [[4, 5]],
    dharukaKarma: [[5, 6]],
    priyamrityu: [
        [6, 7],
        [7, 8],
    ],
    bhagyaVyaya: [[8, 9]],
    dharmaKarmadhipati: [[9, 10]],
    bhumiDravya: [[10, 11]],
    rinaVyaya: [[11, 12]],
    chittaHani: [[12, 1]],
};

/** Parashara sambandha strengths by rule-suffix digits (conjunction 1 / mutual aspect 2 / parivartana 1). */
const PARASHARA_SAMBADHA_STRENGTH: Record<string, number> = { "01": 1, "02": 2, "03": 1 };

/**
 * Generic Parashara sambandha evaluator shared by all eleven yogas (Dharma Karmadhipati's dk01-03
 * fan in here; the doc note "Dharmakarmadipathi is one of Parashara yoga — override it with this"
 * is implemented as DHCP being computed by the same multi-reference, same-lord-excluding rule).
 * `rule` is `<id>.ps01|ps02|ps03` or `dharmaKarmadhipati.dk01-03`; the suffix's final two digits
 * select the sambandha: 01 conjunction, 02 mutual aspect, 03 parivartana. A sambandha is
 * `triggered` when ANY reference (Lagna → Moon → Sun, in that preference order) yields the
 * connection between two DIFFERENT house lords of a qualifying pair.
 */
function evaluateParasharaRule(
    rule: ParasharaYogaRuleId | DharmaKarmadhipatiRuleId,
    facts: ChartFacts,
): RuleEvaluation {
    const id = rule.split(".")[0];
    const reasonKey = rule.split(".")[1];
    const sambandha = reasonKey.slice(-2); // "01" | "02" | "03"
    const pairs = PARASHARA_YOGA_HOUSE_PAIRS[id];
    const strength = PARASHARA_SAMBADHA_STRENGTH[sambandha];
    if (!pairs || !strength || !facts.ascendantSign) return absent(rule);

    const references: Array<{ name: string; sign: number | undefined }> = [
        { name: "Lagna", sign: facts.ascendantSign },
        { name: "Moon", sign: planetFact(facts, 2)?.sign },
        { name: "Sun", sign: planetFact(facts, 1)?.sign },
    ];

    for (const reference of references) {
        if (!reference.sign) continue;
        for (const [house1, house2] of pairs) {
            const lord1 = lordOfSign(reference.sign, house1);
            const lord2 = lordOfSign(reference.sign, house2);
            if (lord1 === lord2) continue; // the same planet owns both houses → the yoga never forms
            const planet1 = planetFact(facts, lord1);
            const planet2 = planetFact(facts, lord2);
            if (!planet1 || !planet2) continue;

            const connected =
                sambandha === "01"
                    ? areConjunct(planet1, planet2)
                    : sambandha === "02"
                      ? hasMutualAspectByDrishti(planet1, planet2)
                      : isParivartana(planet1, planet2);
            if (!connected) continue;

            return fired(
                rule,
                strength,
                `rule.${reasonKey}`,
                { house1, house2, lord1, lord2, reference: reference.name },
                [house1, house2],
            );
        }
    }

    return absent(rule);
}

/** Dharma Karmadhipati Yoga — the 9th (Dharma) & 10th (Karma) lord sambandha, a member of the
 *  Parashara family (docs/parashara-yoga.md overrides docs/dharma-karmadipathi-yogaya.md: evaluated
 *  from Lagna + Moon + Sun with the same-lord exclusion via the generic Parashara rule). */
function evaluateDharmaKarmadhipatiRule(rule: DharmaKarmadhipatiRuleId, facts: ChartFacts): RuleEvaluation {
    return evaluateParasharaRule(rule, facts);
}

/**
 * Pancha Maha Purusha Yoga (docs/pancha-maha-pursha-yoga.md): one of the five non-luminary
 * planets — Mars (Ruchaka), Mercury (Bhadra), Jupiter (Hamsa), Venus (Malavya), Saturn
 * (Sasha/Shasha) — placed in a Kendra AND in its own sign or exaltation sign. Both conditions
 * must hold simultaneously (dignity resolved from the sign, per the §Sashti/own-sign tables):
 * exaltation forms a stronger yoga (strength 1) than own sign (strength 2).
 * The Kendra is satisfied from the Lagna (natal house) OR from the Chandra lagna (the Moon's
 * sign, like Kuja Dosha mk02 / Dhana Yoga): a single rule fires when either reference puts the
 * planet in [1, 4, 7, 10]. `params.kendraFrom` records which reference(s) satisfied the kendra
 * ("Lagna", "Moon", or "Lagna / Moon"); `houseImpact` keeps the reference-relative kendra houses
 * so context/themes stay inside the confirmed kendra set {1, 4, 7, 10}.
 */
function evaluatePanchaMahaPurushaRule(
    rule: RuchakaRuleId | BhadraRuleId | HamsaRuleId | MalavyaRuleId | SashaRuleId,
    facts: ChartFacts,
): RuleEvaluation {
    const planetName = {
        ruchaka: 3,
        bhadra: 4,
        hamsa: 5,
        malavya: 6,
        sasha: 7,
    }[rule.split(".")[0] as "ruchaka" | "bhadra" | "hamsa" | "malavya" | "sasha"];

    const dignities = PMP_PLANET_DATA[planetName];
    const planet = planetFact(facts, planetName);
    if (!planet || !dignities) return absent(rule);

    // Kendra from Lagna: the natal house is already Lagna-relative (whole-sign).
    const kendraFromLagna = KENDRA_HOUSES.includes(planet.house);

    // Kendra from Chandra lagna: the planet's whole-sign house counted from the Moon's sign.
    const moon = planetFact(facts, Planet.MOON);
    const planetHouseFromMoon =
        moon && facts.ascendantSign ? houseFromReference(planet.house, moon.sign, facts.ascendantSign) : undefined;
    const kendraFromMoon = planetHouseFromMoon !== undefined && KENDRA_HOUSES.includes(planetHouseFromMoon);

    if (!kendraFromLagna && !kendraFromMoon) return absent(rule);

    const isExalted = dignities.exaltSign === planet.sign;
    const isOwnSign = dignities.ownSigns.includes(planet.sign);
    if (!isExalted && !isOwnSign) return absent(rule);

    const kendraFrom: Array<"Lagna" | "Moon"> = [];
    if (kendraFromLagna) kendraFrom.push("Lagna");
    if (kendraFromMoon) kendraFrom.push("Moon");

    const houseImpact = [
        ...new Set([
            ...(kendraFromLagna ? [planet.house] : []),
            ...(kendraFromMoon && planetHouseFromMoon !== undefined ? [planetHouseFromMoon] : []),
        ]),
    ].sort((a, b) => a - b);

    return fired(
        rule,
        isExalted ? 1 : 2,
        `rule.${rule.split(".")[1]}`,
        {
            house: planet.house,
            sign: planet.sign,
            dignity: isExalted ? "exalted" : "own",
            kendraFrom: kendraFrom.join(" / "),
        },
        houseImpact,
    );
}

/**
 * Direction helper shared by Kala Sarpa / Kala Amurtha / Deepta Yoga: given Rahu and Ketu
 * (whole-sign zodiacal degrees), compute the angular span of the Rahu→Ketu arc (0..360, the
 * forward/clockwise direction along the zodiac from Rahu to Ketu). A classical planet lies:
 *  - on the Rahu→Ketu arc (Ketu-directed side — heading toward Ketu), or
 *  - on the complementary Ketu→Rahu arc (Rahu-directed side — heading toward Rahu).
 * Absolute degrees are 0..360 so the arc is measured directly on the zodiac circle.
 */
function rahuToKetuArcDegrees(rahu: PlanetFact, ketu: PlanetFact): number {
    return (((ketu.absoluteDegree - rahu.absoluteDegree) % 360) + 360) % 360;
}

/** True when a planet lies on the Rahu→Ketu (Ketu-directed) arc of the zodiac. */
function isOnKetuDirectedSide(planetAbs: number, rahuAbs: number, ketuAbs: number, rahuToKetu: number): boolean {
    return (((planetAbs - rahuAbs) % 360) + 360) % 360 <= rahuToKetu;
}

/**
 * Deepta Yoga (docs/kala sarpa dosha.md §2): of the seven classical planets exactly one lies
 * outside the Kala Sarpa enclosure — six classical planets sit on the Rahu-directed (Ketu → Rahu)
 * arc while the lone planet is on the Ketu-directed (Rahu → Ketu) arc (a 6-1 split). The lone
 * planet must be capable of a Pancha Maha Purusha Yoga (Mars, Mercury, Jupiter, Venus or Saturn);
 * Sun and Moon are never eligible. A 6-1 split with the six on the Ketu-directed side (Kala
 * Amurtha frame) is NOT Deepta — that is the reverse directional configuration.
 */
function evaluateDeeptaYogaRule(rule: DeeptaYogaRuleId, facts: ChartFacts): RuleEvaluation {
    const rahu = planetFact(facts, 8);
    const ketu = planetFact(facts, 9);
    if (!rahu || !ketu) return absent(rule);

    const arc = rahuToKetuArcDegrees(rahu, ketu);
    const classical = facts.planets.filter((p) => CLASSICAL_PLANETS.includes(p.planetName));
    if (classical.length !== CLASSICAL_PLANETS.length) return absent(rule);

    const onKetuSide = classical.filter((p) =>
        isOnKetuDirectedSide(p.absoluteDegree, rahu.absoluteDegree, ketu.absoluteDegree, arc),
    );
    const onRahuSide = classical.filter(
        (p) => !isOnKetuDirectedSide(p.absoluteDegree, rahu.absoluteDegree, ketu.absoluteDegree, arc),
    );

    if (onRahuSide.length !== 6 || onKetuSide.length !== 1) return absent(rule);
    const lone = onKetuSide[0];
    if (!DEEPTA_YOGA_PLANETS.includes(lone.planetName)) return absent(rule);

    const classification = DEEPTA_YOGA_NAMES[lone.planetName];
    return fired(rule, 2, "rule.dy01", { planet: lone.planetName, classification }, [lone.house], classification);
}

/**
 * Kala Sarpa Dosha (docs/kala sarpa dosha.md §4): all seven classical planets lie in the same
 * Rahu–Ketu half of the zodiac, proceeding in the direction of Rahu — i.e. all on the
 * Ketu → Rahu arc (heading toward Rahu). None may be on the opposite (Rahu → Ketu, Ketu-directed)
 * side. The type is classified by Rahu's Lagna-based house (§5).
 */
function evaluateKalaSarpaRule(rule: KalaSarpaRuleId, facts: ChartFacts): RuleEvaluation {
    const rahu = planetFact(facts, 8);
    const ketu = planetFact(facts, 9);
    if (!rahu || !ketu) return absent(rule);

    const arc = rahuToKetuArcDegrees(rahu, ketu);
    const classical = facts.planets.filter((p) => CLASSICAL_PLANETS.includes(p.planetName));
    if (classical.length !== CLASSICAL_PLANETS.length) return absent(rule);

    const allRahuDirected = classical.every(
        (p) => !isOnKetuDirectedSide(p.absoluteDegree, rahu.absoluteDegree, ketu.absoluteDegree, arc),
    );
    if (!allRahuDirected) return absent(rule);

    const classification = KALA_SARPA_NAMES[rahu.house];
    return fired(rule, 1, "rule.ks01", { classification, rahuHouse: rahu.house }, [rahu.house], classification);
}

/**
 * Kala Amurtha Dosha (docs/kala sarpa dosha.md §7): the opposite directional configuration to
 * Kala Sarpa — all seven classical planets lie on the Rahu → Ketu arc (heading toward Ketu).
 */
function evaluateKalaAmurthaRule(rule: KalaAmurthaRuleId, facts: ChartFacts): RuleEvaluation {
    const rahu = planetFact(facts, 8);
    const ketu = planetFact(facts, 9);
    if (!rahu || !ketu) return absent(rule);

    const arc = rahuToKetuArcDegrees(rahu, ketu);
    const classical = facts.planets.filter((p) => CLASSICAL_PLANETS.includes(p.planetName));
    if (classical.length !== CLASSICAL_PLANETS.length) return absent(rule);

    const allKetuDirected = classical.every((p) =>
        isOnKetuDirectedSide(p.absoluteDegree, rahu.absoluteDegree, ketu.absoluteDegree, arc),
    );
    if (!allKetuDirected) return absent(rule);

    return fired(rule, 1, "rule.ka01", undefined, [rahu.house, ketu.house]);
}

/**
 * Dhana Yoga (docs/dhana-yoga.md): the owners of houses 2, 5, 9 and 11 must have a relationship
 * (conjunction, mutual aspect, or parivartana/exchange) with at least one other dhana house lord.
 * Evaluated from three reference points — Lagna, Moon (Chandra Lagna) and Sun (Surya Lagna).
 * Same-lord exclusion applies: if the same planet owns both houses of a pair, that pair is skipped.
 */
const DHANA_HOUSES = [2, 5, 9, 11];

function evaluateDhanaYogaRule(rule: DhanaYogaRuleId, facts: ChartFacts): RuleEvaluation {
    const sambandha = rule.split(".")[1].slice(-2); // "01" | "02" | "03"
    if (!facts.ascendantSign) return absent(rule);

    const references: Array<{ name: string; sign: number | undefined }> = [
        { name: "Lagna", sign: facts.ascendantSign },
        { name: "Moon", sign: planetFact(facts, 2)?.sign },
        { name: "Sun", sign: planetFact(facts, 1)?.sign },
    ];

    const strength = sambandha === "02" ? 2 : 1;

    for (const reference of references) {
        if (!reference.sign) continue;

        for (let i = 0; i < DHANA_HOUSES.length; i++) {
            for (let j = i + 1; j < DHANA_HOUSES.length; j++) {
                const lord1 = lordOfSign(reference.sign, DHANA_HOUSES[i]);
                const lord2 = lordOfSign(reference.sign, DHANA_HOUSES[j]);
                if (lord1 === lord2) continue;

                const planet1 = planetFact(facts, lord1);
                const planet2 = planetFact(facts, lord2);
                if (!planet1 || !planet2) continue;

                const connected =
                    sambandha === "01"
                        ? areConjunct(planet1, planet2)
                        : sambandha === "02"
                          ? hasMutualAspectByDrishti(planet1, planet2)
                          : isParivartana(planet1, planet2);
                if (!connected) continue;

                return fired(
                    rule,
                    strength,
                    `rule.${sambandha === "01" ? "dh01" : sambandha === "02" ? "dh02" : "dh03"}`,
                    {
                        house1: DHANA_HOUSES[i],
                        house2: DHANA_HOUSES[j],
                        lord1,
                        lord2,
                        reference: reference.name,
                    },
                    [DHANA_HOUSES[i], DHANA_HOUSES[j]],
                );
            }
        }
    }

    return absent(rule);
}

/**
 * Neecha Raja Yoga (docs/raja-yoga.md): a debilitated (Neecha) planet placed in an upachaya
 * house (2, 3, 4, 9, 10, or 11) from the Lagna forms a Raja Yoga. Any planet can trigger
 * this yoga — the condition is purely positional (debilitation + house placement).
 */
function evaluateNeechaRajaYogaRule(rule: NeechaRajaYogaRuleId, facts: ChartFacts): RuleEvaluation {
    for (const planet of facts.planets) {
        if (planet.strength !== PlanetaryStrength.NEECHA) continue;
        if (!UPACHAYA_HOUSES.includes(planet.house)) continue;
        return fired(rule, 2, "rule.nr01", { planet: planet.planetName, house: planet.house }, [planet.house]);
    }
    return absent(rule);
}

/** The ten Parashara sub-yogas besides Dharma Karmadhipati (docs/parashara-yoga.md) — their
 *  `ps01..ps03` rules all route to the shared evaluateParasharaRule. */
const PARASHARA_YOGA_IDS = [
    "pushkala",
    "rajaChitta",
    "champaka",
    "amathya",
    "dharukaKarma",
    "priyamrityu",
    "bhagyaVyaya",
    "bhumiDravya",
    "rinaVyaya",
    "chittaHani",
];

/** Evaluates every catalog rule of an entry (catalog order). Triggers dedupe upstream. */
export function evaluateRule(rule: RuleId, facts: ChartFacts): RuleEvaluation {
    if (rule.startsWith("shaniMangala.")) return evaluateShaniMangalaRule(rule as ShaniMangalaRuleId, facts);
    if (rule.startsWith("agniMarutha.")) return evaluateAgniMaruthaRule(rule as AgniMaruthaRuleId, facts);
    if (rule.startsWith("manglik.")) return evaluateManglikRule(rule as ManglikRuleId, facts);
    if (rule.startsWith("kalaSarpa.")) return evaluateKalaSarpaRule(rule as KalaSarpaRuleId, facts);
    if (rule.startsWith("kalaAmurtha.")) return evaluateKalaAmurthaRule(rule as KalaAmurthaRuleId, facts);
    if (rule.startsWith("deeptaYoga.")) return evaluateDeeptaYogaRule(rule as DeeptaYogaRuleId, facts);
    if (rule.startsWith("dhanaYoga.")) return evaluateDhanaYogaRule(rule as DhanaYogaRuleId, facts);
    if (rule.startsWith("neechaRajaYoga.")) return evaluateNeechaRajaYogaRule(rule as NeechaRajaYogaRuleId, facts);
    if (rule.startsWith("dharmaKarmadhipati."))
        return evaluateDharmaKarmadhipatiRule(rule as DharmaKarmadhipatiRuleId, facts);
    if (PARASHARA_YOGA_IDS.some((id) => rule.startsWith(`${id}.`)))
        return evaluateParasharaRule(rule as ParasharaYogaRuleId, facts);
    if (
        rule.startsWith("ruchaka.") ||
        rule.startsWith("bhadra.") ||
        rule.startsWith("hamsa.") ||
        rule.startsWith("malavya.") ||
        rule.startsWith("sasha.")
    )
        return evaluatePanchaMahaPurushaRule(
            rule as RuchakaRuleId | BhadraRuleId | HamsaRuleId | MalavyaRuleId | SashaRuleId,
            facts,
        );
    return absent(rule);
}
