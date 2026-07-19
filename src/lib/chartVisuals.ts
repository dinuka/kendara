/** Single-grapheme (base consonant + vowel sign) planet labels — the shortest unit that still
 *  reads as a complete character and stays distinct from other planets sharing the same initial
 *  consonant (Sun/Rahu both start with ර, Moon/Venus both start with ස, Mars/Ketu both start with ක). */
export const PLANET_SHORT_SI: Record<number, string> = {
    1: "ර", // Sun (රවි)
    2: "ච", // Moon (සඳු)
    3: "කු", // Mars (කුජ)
    4: "බු", // Mercury (බුධ)
    5: "ගු", // Jupiter (ගුරු)
    6: "සි", // Venus (සිකු)
    7: "ශ", // Saturn (ශනි) - no other planet starts with ශ
    8: "රා", // Rahu (රාහු)
    9: "කේ", // Ketu (කේතු)
};

export const SIGN_SHORT_SI: Record<number, string> = {
    1: "මේෂ",
    2: "වෘෂභ",
    3: "මිථුන",
    4: "කටක",
    5: "සිංහ",
    6: "කන්‍යා",
    7: "තුලා",
    8: "වෘශ්චික",
    9: "ධනු",
    10: "මකර",
    11: "කුම්භ",
    12: "මීන",
};

/** 27 nakshatra short names, index 1-27 starting from Ashwini at 0° Aries — matches
 *  src/messages/si.json's astrology.nakshatraNames values. */
export const NAKSHATRA_SHORT_SI: Record<number, string> = {
    1: "අස්විද",
    2: "බෙරණ",
    3: "කැති",
    4: "රෙහෙණ",
    5: "මුවසිරිස",
    6: "අද",
    7: "පුනාවස",
    8: "පුස",
    9: "අස්ලිය",
    10: "මා",
    11: "පුවපල්",
    12: "උත්‍රපල්",
    13: "හත",
    14: "සිත",
    15: "සා",
    16: "විසා",
    17: "අනුර",
    18: "දෙට",
    19: "මූල",
    20: "පුවසල",
    21: "උත්‍රසල",
    22: "සුවන",
    23: "දෙනට",
    24: "සියාවස",
    25: "පුවපුටුප",
    26: "උත්‍රපුටුප",
    27: "රේවතී",
};
