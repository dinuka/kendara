import type { CalculationResult } from "@/lib/astrology";
import {
    NAKSHATRA_LABELS_EN,
    NAKSHATRA_LABELS_SI,
    PLANET_LABELS_EN,
    PLANET_LABELS_SI,
    STRENGTH_DISPLAY_EN,
    STRENGTH_DISPLAY_SI,
    ZODIAC_SIGN_LABELS_EN,
    ZODIAC_SIGN_LABELS_SI,
} from "@/lib/astrologyEnums";

const textPartsEn = (calc: CalculationResult): string[] => {
    const parts: string[] = [];

    const ascSign = ZODIAC_SIGN_LABELS_EN[calc.ascendant.sign] || `Sign ${calc.ascendant.sign}`;
    parts.push(`Ascendant: ${ascSign}.`);

    for (const p of calc.planets) {
        const pName = PLANET_LABELS_EN[p.name] || `Planet ${p.name}`;
        const pSign = ZODIAC_SIGN_LABELS_EN[p.sign] || `Sign ${p.sign}`;
        const strength = STRENGTH_DISPLAY_EN[p.strength] || p.strength;
        parts.push(`${pName} is in ${pSign} in house ${p.house}. Strength: ${strength}.`);
        if (p.retrograde) parts.push(`${pName} is retrograde.`);
        if (p.combustion) parts.push(`${pName} is combust.`);
    }

    const moonNak =
        NAKSHATRA_LABELS_EN[calc.nakshatra.moonNakshatra.id] || `Nakshatra ${calc.nakshatra.moonNakshatra.id}`;
    parts.push(`Moon nakshatra: ${moonNak}, pada ${calc.nakshatra.moonNakshatra.pada}.`);

    const ascNak =
        NAKSHATRA_LABELS_EN[calc.nakshatra.ascendantNakshatra.id] ||
        `Nakshatra ${calc.nakshatra.ascendantNakshatra.id}`;
    parts.push(`Ascendant nakshatra: ${ascNak}, pada ${calc.nakshatra.ascendantNakshatra.pada}.`);

    const houseLords = calc.houses.map((h) => {
        const lordName = PLANET_LABELS_EN[h.lord] || `Planet ${h.lord}`;
        return `House ${h.houseNumber} lord: ${lordName}`;
    });
    parts.push(houseLords.join(". "));

    if (calc.dashas.mahadasha.length > 0) {
        const dashaSeq = calc.dashas.mahadasha.map((m) => {
            const lord = PLANET_LABELS_EN[m.planet] || `Planet ${m.planet}`;
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

    parts.push(`Atmakaraka: ${PLANET_LABELS_EN[calc.atmakaraka] || `Planet ${calc.atmakaraka}`}.`);
    parts.push(`Badhaka planets: ${calc.badhakaPlanet.map((p) => PLANET_LABELS_EN[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(`Maraka planets: ${calc.marakaPlanets.map((p) => PLANET_LABELS_EN[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(
        `Nidhanamsha planets: ${calc.nidhanamshaPlanets.map((p) => PLANET_LABELS_EN[p] || `Planet ${p}`).join(", ")}.`,
    );

    return parts;
};

const textPartsSi = (calc: CalculationResult): string[] => {
    const parts: string[] = [];

    const ascSign = ZODIAC_SIGN_LABELS_SI[calc.ascendant.sign] || `Sign ${calc.ascendant.sign}`;
    parts.push(`ලග්නය: ${ascSign}.`);

    for (const p of calc.planets) {
        const pName = PLANET_LABELS_SI[p.name] || `Planet ${p.name}`;
        const pSign = ZODIAC_SIGN_LABELS_SI[p.sign] || `Sign ${p.sign}`;
        const strength = STRENGTH_DISPLAY_SI[p.strength] || p.strength;
        parts.push(`${pName} ${pSign} රාශියේ ${p.house} වන භාවයේ. බලය: ${strength}.`);
        if (p.retrograde) parts.push(`${pName} වක්‍රය.`);
        if (p.combustion) parts.push(`${pName} දාහය.`);
    }

    const moonNak =
        NAKSHATRA_LABELS_SI[calc.nakshatra.moonNakshatra.id] || `Nakshatra ${calc.nakshatra.moonNakshatra.id}`;
    parts.push(`චන්ද්‍ර නක්ෂත්‍රය: ${moonNak}, පාද ${calc.nakshatra.moonNakshatra.pada}.`);

    const ascNak =
        NAKSHATRA_LABELS_SI[calc.nakshatra.ascendantNakshatra.id] ||
        `Nakshatra ${calc.nakshatra.ascendantNakshatra.id}`;
    parts.push(`ලග්න නක්ෂත්‍රය: ${ascNak}, පාද ${calc.nakshatra.ascendantNakshatra.pada}.`);

    const houseLords = calc.houses.map((h) => {
        const lordName = PLANET_LABELS_SI[h.lord] || `Planet ${h.lord}`;
        return `${h.houseNumber} වන භාව අධිපති: ${lordName}`;
    });
    parts.push(houseLords.join(". "));

    if (calc.dashas.mahadasha.length > 0) {
        const dashaSeq = calc.dashas.mahadasha.map((m) => {
            const lord = PLANET_LABELS_SI[m.planet] || `Planet ${m.planet}`;
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

    parts.push(`ආත්මකාරක: ${PLANET_LABELS_SI[calc.atmakaraka] || `Planet ${calc.atmakaraka}`}.`);
    parts.push(`බාධක ග්‍රහ: ${calc.badhakaPlanet.map((p) => PLANET_LABELS_SI[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(`මාරක ග්‍රහ: ${calc.marakaPlanets.map((p) => PLANET_LABELS_SI[p] || `Planet ${p}`).join(", ")}.`);
    parts.push(
        `නිධනාම්ශ ග්‍රහ: ${calc.nidhanamshaPlanets.map((p) => PLANET_LABELS_SI[p] || `Planet ${p}`).join(", ")}.`,
    );

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
