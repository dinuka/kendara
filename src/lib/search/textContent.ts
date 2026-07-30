import type { CalculationResult } from "@/lib/astrology";

const EN_SIGN_NAMES: Record<number, string> = {
    1: "Aries",
    2: "Taurus",
    3: "Gemini",
    4: "Cancer",
    5: "Leo",
    6: "Virgo",
    7: "Libra",
    8: "Scorpio",
    9: "Sagittarius",
    10: "Capricorn",
    11: "Aquarius",
    12: "Pisces",
};

const SI_SIGN_NAMES: Record<number, string> = {
    1: "මේෂ",
    2: "වෘෂභ",
    3: "මිථුන",
    4: "කටක",
    5: "සිංහ",
    6: "කන්යා",
    7: "තුලා",
    8: "වෘශ්චික",
    9: "ධනු",
    10: "මකර",
    11: "කුම්භ",
    12: "මීන",
};

const EN_PLANET_NAMES: Record<number, string> = {
    1: "Sun",
    2: "Moon",
    3: "Mars",
    4: "Mercury",
    5: "Jupiter",
    6: "Venus",
    7: "Saturn",
    8: "Rahu",
    9: "Ketu",
};

const SI_PLANET_NAMES: Record<number, string> = {
    1: "රවි",
    2: "සඳු",
    3: "කුජ",
    4: "බුධ",
    5: "ගුරු",
    6: "සිකුරු",
    7: "ශනි",
    8: "රාහු",
    9: "කේතු",
};

const EN_NAKSHATRA_NAMES: Record<number, string> = {
    1: "Ashwini",
    2: "Bharani",
    3: "Krittika",
    4: "Rohini",
    5: "Mrigashira",
    6: "Ardra",
    7: "Punarvasu",
    8: "Pushya",
    9: "Ashlesha",
    10: "Magha",
    11: "Purva Phalguni",
    12: "Uttara Phalguni",
    13: "Hasta",
    14: "Chitra",
    15: "Swati",
    16: "Vishakha",
    17: "Anuradha",
    18: "Jyeshtha",
    19: "Mula",
    20: "Purva Ashadha",
    21: "Uttara Ashadha",
    22: "Shravana",
    23: "Dhanishta",
    24: "Shatabhisha",
    25: "Purva Bhadrapada",
    26: "Uttara Bhadrapada",
    27: "Revati",
};

const SI_NAKSHATRA_NAMES: Record<number, string> = {
    1: "අශ්විනි",
    2: "භරණී",
    3: "කෘත්තිකා",
    4: "රෝහිණී",
    5: "මෘගශීර්ෂ",
    6: "ආර්ද්‍රා",
    7: "පුනර්වසු",
    8: "පුෂ්‍ය",
    9: "ආශ්ලේෂා",
    10: "මාඝ",
    11: "පූර්ව ඵල්ගුනී",
    12: "උත්තර ඵල්ගුනී",
    13: "හස්ත",
    14: "චිත්‍රා",
    15: "ස්වාති",
    16: "විශාඛා",
    17: "අනුරාධා",
    18: "ජ්‍යෙෂ්ඨා",
    19: "මූල",
    20: "පූර්ව ආශාඩ්",
    21: "උත්තර ආශාඩ්",
    22: "ශ්‍රවණ",
    23: "ධනිෂ්ඨා",
    24: "ශතභිෂා",
    25: "පූර්ව භාද්‍රපදා",
    26: "උත්තර භාද්‍රපදා",
    27: "රේවතී",
};

const EN_STRENGTH_NAMES: Record<string, string> = {
    AthiUchcha: "Athi Uchcha (very exalted)",
    Uchcha: "Uchcha (exalted)",
    Neecha: "Neecha (debilitated)",
    AthiNeecha: "Athi Neecha (very debilitated)",
    Moolatrikona: "Moolatrikona",
    OwnSign: "own sign",
    Mitra: "friend sign",
    Shatru: "enemy sign",
    Sama: "neutral",
};

const SI_STRENGTH_NAMES: Record<string, string> = {
    AthiUchcha: "අති උච්ච",
    Uchcha: "උච්ච",
    Neecha: "නීච",
    AthiNeecha: "අති නීච",
    Moolatrikona: "මූලත්‍රිකෝණ",
    OwnSign: "ස්ව රාශි",
    Mitra: "මිත්‍ර",
    Shatru: "ශත්‍රැ",
    Sama: "සම",
};

const textPartsEn = (calc: CalculationResult): string[] => {
    const parts: string[] = [];

    const ascSign = EN_SIGN_NAMES[calc.ascendant.sign] || `Sign ${calc.ascendant.sign}`;
    parts.push(`Ascendant: ${ascSign}.`);

    for (const p of calc.planets) {
        const pName = EN_PLANET_NAMES[p.name] || `Planet ${p.name}`;
        const pSign = EN_SIGN_NAMES[p.sign] || `Sign ${p.sign}`;
        const strength = EN_STRENGTH_NAMES[p.strength] || p.strength;
        parts.push(`${pName} is in ${pSign} in house ${p.house}. Strength: ${strength}.`);
        if (p.retrograde) parts.push(`${pName} is retrograde.`);
        if (p.combustion) parts.push(`${pName} is combust.`);
    }

    const moonNak =
        EN_NAKSHATRA_NAMES[calc.nakshatra.moonNakshatra.id] || `Nakshatra ${calc.nakshatra.moonNakshatra.id}`;
    parts.push(`Moon nakshatra: ${moonNak}, pada ${calc.nakshatra.moonNakshatra.pada}.`);

    const ascNak =
        EN_NAKSHATRA_NAMES[calc.nakshatra.ascendantNakshatra.id] || `Nakshatra ${calc.nakshatra.ascendantNakshatra.id}`;
    parts.push(`Ascendant nakshatra: ${ascNak}, pada ${calc.nakshatra.ascendantNakshatra.pada}.`);

    const houseLords = calc.houses.map((h) => {
        const lordName = EN_PLANET_NAMES[h.lord] || `Planet ${h.lord}`;
        return `House ${h.houseNumber} lord: ${lordName}`;
    });
    parts.push(houseLords.join(". "));

    if (calc.dashas.mahadasha.length > 0) {
        const dashaSeq = calc.dashas.mahadasha.map((m) => {
            const lord = EN_PLANET_NAMES[m.planet] || `Planet ${m.planet}`;
            return `${lord} (${m.startDate} - ${m.endDate})`;
        });
        parts.push(`Mahadasha sequence: ${dashaSeq.join(", ")}.`);
    }

    if (calc.yogas.length > 0) {
        const yogaNames = calc.yogas.map((y) => (y as Record<string, unknown>).name as string).filter(Boolean);
        if (yogaNames.length > 0) {
            parts.push(`Yogas: ${yogaNames.join(", ")}.`);
        } else {
            parts.push(`${calc.yogas.length} yoga formations present.`);
        }
    }

    if (calc.doshas.doshas?.length > 0) {
        const doshaList = calc.doshas.doshas as Array<Record<string, unknown>>;
        const presentDoshas = doshaList.filter((d) => d.isPresent).map((d) => d.name as string);
        if (presentDoshas.length > 0) {
            parts.push(`Doshas: ${presentDoshas.join(", ")}.`);
        } else {
            parts.push("No doshas present.");
        }
    }

    parts.push(`Atmakaraka: ${EN_PLANET_NAMES[calc.atmakaraka] || `Planet ${calc.atmakaraka}`}.`);
    parts.push(`Badhaka planets: ${calc.badhakaPlanet.map((p) => EN_PLANET_NAMES[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(`Maraka planets: ${calc.marakaPlanets.map((p) => EN_PLANET_NAMES[p] || `Planet ${p}`).join(", ")}.`);

    return parts;
};

const textPartsSi = (calc: CalculationResult): string[] => {
    const parts: string[] = [];

    const ascSign = SI_SIGN_NAMES[calc.ascendant.sign] || `Sign ${calc.ascendant.sign}`;
    parts.push(`ලග්නය: ${ascSign}.`);

    for (const p of calc.planets) {
        const pName = SI_PLANET_NAMES[p.name] || `Planet ${p.name}`;
        const pSign = SI_SIGN_NAMES[p.sign] || `Sign ${p.sign}`;
        const strength = SI_STRENGTH_NAMES[p.strength] || p.strength;
        parts.push(`${pName} ${pSign} රාශියේ ${p.house} වන භාවයේ. බලය: ${strength}.`);
        if (p.retrograde) parts.push(`${pName} වක්‍රය.`);
        if (p.combustion) parts.push(`${pName} දාහය.`);
    }

    const moonNak =
        SI_NAKSHATRA_NAMES[calc.nakshatra.moonNakshatra.id] || `Nakshatra ${calc.nakshatra.moonNakshatra.id}`;
    parts.push(`චන්ද්‍ර නක්ෂත්‍රය: ${moonNak}, පාද ${calc.nakshatra.moonNakshatra.pada}.`);

    const ascNak =
        SI_NAKSHATRA_NAMES[calc.nakshatra.ascendantNakshatra.id] || `Nakshatra ${calc.nakshatra.ascendantNakshatra.id}`;
    parts.push(`ලග්න නක්ෂත්‍රය: ${ascNak}, පාද ${calc.nakshatra.ascendantNakshatra.pada}.`);

    const houseLords = calc.houses.map((h) => {
        const lordName = SI_PLANET_NAMES[h.lord] || `Planet ${h.lord}`;
        return `${h.houseNumber} වන භාව අධිපති: ${lordName}`;
    });
    parts.push(houseLords.join(". "));

    if (calc.dashas.mahadasha.length > 0) {
        const dashaSeq = calc.dashas.mahadasha.map((m) => {
            const lord = SI_PLANET_NAMES[m.planet] || `Planet ${m.planet}`;
            return `${lord} (${m.startDate} - ${m.endDate})`;
        });
        parts.push(`මහා දශා අනුපිළිවෙළ: ${dashaSeq.join(", ")}.`);
    }

    if (calc.yogas.length > 0) {
        const yogaNames = calc.yogas.map((y) => (y as Record<string, unknown>).name as string).filter(Boolean);
        if (yogaNames.length > 0) {
            parts.push(`යෝග: ${yogaNames.join(", ")}.`);
        } else {
            parts.push(`යෝග ${calc.yogas.length} ක් පවතී.`);
        }
    }

    if (calc.doshas.doshas?.length > 0) {
        const doshaList = calc.doshas.doshas as Array<Record<string, unknown>>;
        const presentDoshas = doshaList.filter((d) => d.isPresent).map((d) => d.name as string);
        if (presentDoshas.length > 0) {
            parts.push(`දෝෂ: ${presentDoshas.join(", ")}.`);
        } else {
            parts.push("දෝෂ නොමැත.");
        }
    }

    parts.push(`ආත්මකාරක: ${SI_PLANET_NAMES[calc.atmakaraka] || `Planet ${calc.atmakaraka}`}.`);
    parts.push(`බාධක ග්‍රහ: ${calc.badhakaPlanet.map((p) => SI_PLANET_NAMES[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(`මාරක ග්‍රහ: ${calc.marakaPlanets.map((p) => SI_PLANET_NAMES[p] || `Planet ${p}`).join(", ")}.`);

    return parts;
};

export const generateTextContent = (calc: CalculationResult, language: "si" | "en"): string => {
    const parts = language === "si" ? textPartsSi(calc) : textPartsEn(calc);
    return parts.join(" ");
};

export const getTextForBothLanguages = (calc: CalculationResult): { si: string; en: string } => {
    return {
        si: generateTextContent(calc, "si"),
        en: generateTextContent(calc, "en"),
    };
};
