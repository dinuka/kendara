# Plan: Consolidate strength labels into astrologyEnums.ts

## 1. astrologEnums.ts

### 1a. Change PlanetaryStrength enum values to scores
Old:
```
export enum PlanetaryStrength {
    ATHI_UCHCHA = "AthiUchcha",
    UCHCHA = "Uchcha",
    NEECHA = "Neecha",
    ATHI_NEECHA = "AthiNeecha",
    MOOLATRIKONA = "Moolatrikona",
    OWN_SIGN = "OwnSign",
    MITRA = "Mitra",
    SHATRU = "Shatru",
    SAMA = "Sama",
}
```
New:
```
export enum PlanetaryStrength {
    ATHI_UCHCHA = 1.25,
    UCHCHA = 1,
    NEECHA = -1,
    ATHI_NEECHA = -1.25,
    MOOLATRIKONA = 0.75,
    OWN_SIGN = 0.5,
    MITRA = 0.1,
    SHATRU = -0.1,
    SAMA = 0,
}
```

### 1b. Add STRENGTH_LABELS search map after the enum
Insert after `PlanetaryStrength` enum closing brace, before `PLANET_LABELS_EN`:

```
export const STRENGTH_LABELS: Record<string, PlanetaryStrength> = {
    "උච්ච": PlanetaryStrength.UCHCHA,
    "උච්චව": PlanetaryStrength.UCHCHA,
    "උච්චත්වය": PlanetaryStrength.UCHCHA,
    "exaltation": PlanetaryStrength.UCHCHA,
    "exalted": PlanetaryStrength.UCHCHA,
    "uchcha": PlanetaryStrength.UCHCHA,
    "අති උච්ච": PlanetaryStrength.ATHI_UCHCHA,
    "athi uchcha": PlanetaryStrength.ATHI_UCHCHA,
    "very exalted": PlanetaryStrength.ATHI_UCHCHA,
    "නීච": PlanetaryStrength.NEECHA,
    "නීචව": PlanetaryStrength.NEECHA,
    "නීචත්වය": PlanetaryStrength.NEECHA,
    "debilitation": PlanetaryStrength.NEECHA,
    "debilitated": PlanetaryStrength.NEECHA,
    "neecha": PlanetaryStrength.NEECHA,
    "අති නීච": PlanetaryStrength.ATHI_NEECHA,
    "athi neecha": PlanetaryStrength.ATHI_NEECHA,
    "very debilitated": PlanetaryStrength.ATHI_NEECHA,
    "moolatrikona": PlanetaryStrength.MOOLATRIKONA,
    "මූලත්‍රිකෝණ": PlanetaryStrength.MOOLATRIKONA,
    "own sign": PlanetaryStrength.OWN_SIGN,
    "ස්ව රාශි": PlanetaryStrength.OWN_SIGN,
    "mitra": PlanetaryStrength.MITRA,
    "මිත්‍ර": PlanetaryStrength.MITRA,
    "friend sign": PlanetaryStrength.MITRA,
    "shatru": PlanetaryStrength.SHATRU,
    "ශත්‍රැ": PlanetaryStrength.SHATRU,
    "enemy sign": PlanetaryStrength.SHATRU,
    "sama": PlanetaryStrength.SAMA,
    "සම": PlanetaryStrength.SAMA,
    "neutral": PlanetaryStrength.SAMA,
};
```

### 1c. Rename STRENGTH_LABELS_EN → STRENGTH_DISPLAY_EN
Change keys from string literals to computed enum values, add legacy string fallbacks.

Old:
```
export const STRENGTH_LABELS_EN: Record<string, string> = {
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
```
New:
```
export const STRENGTH_DISPLAY_EN: Record<string, string> = {
    [PlanetaryStrength.ATHI_UCHCHA]: "Athi Uchcha (very exalted)",
    AthiUchcha: "Athi Uchcha (very exalted)",
    [PlanetaryStrength.UCHCHA]: "Uchcha (exalted)",
    Uchcha: "Uchcha (exalted)",
    [PlanetaryStrength.NEECHA]: "Neecha (debilitated)",
    Neecha: "Neecha (debilitated)",
    [PlanetaryStrength.ATHI_NEECHA]: "Athi Neecha (very debilitated)",
    AthiNeecha: "Athi Neecha (very debilitated)",
    [PlanetaryStrength.MOOLATRIKONA]: "Moolatrikona",
    Moolatrikona: "Moolatrikona",
    [PlanetaryStrength.OWN_SIGN]: "own sign",
    OwnSign: "own sign",
    [PlanetaryStrength.MITRA]: "friend sign",
    Mitra: "friend sign",
    [PlanetaryStrength.SHATRU]: "enemy sign",
    Shatru: "enemy sign",
    [PlanetaryStrength.SAMA]: "neutral",
    Sama: "neutral",
};
```

### 1d. Rename STRENGTH_LABELS_SI → STRENGTH_DISPLAY_SI
Same treatment — computed enum keys + legacy string fallbacks.

Old:
```
export const STRENGTH_LABELS_SI: Record<string, string> = {
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
```
New:
```
export const STRENGTH_DISPLAY_SI: Record<string, string> = {
    [PlanetaryStrength.ATHI_UCHCHA]: "අති උච්ච",
    AthiUchcha: "අති උච්ච",
    [PlanetaryStrength.UCHCHA]: "උච්ච",
    Uchcha: "උච්ච",
    [PlanetaryStrength.NEECHA]: "නීච",
    Neecha: "නීච",
    [PlanetaryStrength.ATHI_NEECHA]: "අති නීච",
    AthiNeecha: "අති නීච",
    [PlanetaryStrength.MOOLATRIKONA]: "මූලත්‍රිකෝණ",
    Moolatrikona: "මූලත්‍රිකෝණ",
    [PlanetaryStrength.OWN_SIGN]: "ස්ව රාශි",
    OwnSign: "ස්ව රාශි",
    [PlanetaryStrength.MITRA]: "මිත්‍ර",
    Mitra: "මිත්‍ර",
    [PlanetaryStrength.SHATRU]: "ශත්‍රැ",
    Shatru: "ශත්‍රැ",
    [PlanetaryStrength.SAMA]: "සම",
    Sama: "සම",
};
```

## 2. calculation.ts

Remove the private `STRENGTH_VALUES` block (lines 220-230 in current file).
Old:
```
const STRENGTH_VALUES: Record<PlanetaryStrength, number> = {
    [PlanetaryStrength.ATHI_UCHCHA]: 1.25,
    [PlanetaryStrength.UCHCHA]: 1,
    [PlanetaryStrength.NEECHA]: -1,
    [PlanetaryStrength.ATHI_NEECHA]: -1.25,
    [PlanetaryStrength.MOOLATRIKONA]: 0.75,
    [PlanetaryStrength.OWN_SIGN]: 0.5,
    [PlanetaryStrength.MITRA]: 0.1,
    [PlanetaryStrength.SHATRU]: -0.1,
    [PlanetaryStrength.SAMA]: 0,
};
```
New: remove entirely (enum values are the scores).

## 3. vocabulary.ts

### 3a. Update imports
Old:
```
import { NAKSHATRA_NAMES, PLANET_NAMES, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
```
New:
```
import { NAKSHATRA_NAMES, PLANET_NAMES, STRENGTH_LABELS, ZODIAC_SIGN_NAMES } from "@/lib/astrologyEnums";
```

### 3b. Remove exaltation/debilitation arrays and update TRIGGER_WORDS
Remove lines 4-7 (SINHALA_EXALTATION, ENGLISH_EXALTATION, SINHALA_DEBILITATION, ENGLISH_DEBILITATION).

Remove `...SINHALA_EXALTATION,` and `...ENGLISH_EXALTATION,` and `...SINHALA_DEBILITATION,` and `...ENGLISH_DEBILITATION,` from TRIGGER_WORDS.

Add `...Object.keys(STRENGTH_LABELS),` to TRIGGER_WORDS.

## 4. search/route.ts

### 4a. Update imports
Remove from the vocabulary import: `ENGLISH_DEBILITATION, ENGLISH_EXALTATION, SINHALA_DEBILITATION, SINHALA_EXALTATION,`
Import `STRENGTH_LABELS` from `@/lib/astrologyEnums` (it's already imported alongside `PLANET_NAMES, PlanetaryStrength, ZODIAC_SIGN_NAMES` — add `STRENGTH_LABELS` there).

### 4b. Rewrite getStrengthMatch()
Old:
```
const getStrengthMatch = (query: string): PlanetaryStrength | null => {
    const q = query.toLowerCase();

    if (SINHALA_EXALTATION.some((w) => q.includes(w)) || ENGLISH_EXALTATION.some((w) => q.includes(w))) {
        return PlanetaryStrength.UCHCHA;
    }

    if (SINHALA_DEBILITATION.some((w) => q.includes(w)) || ENGLISH_DEBILITATION.some((w) => q.includes(w))) {
        return PlanetaryStrength.NEECHA;
    }

    return null;
};
```
New:
```
const getStrengthMatch = (query: string): PlanetaryStrength | null => {
    const q = query.toLowerCase();

    const matched = new Set<PlanetaryStrength>();
    for (const [word, strength] of Object.entries(STRENGTH_LABELS)) {
        if (q.includes(word)) {
            matched.add(strength);
        }
    }

    if (matched.has(PlanetaryStrength.UCHCHA) || matched.has(PlanetaryStrength.ATHI_UCHCHA)) {
        return PlanetaryStrength.UCHCHA;
    }
    if (matched.has(PlanetaryStrength.NEECHA) || matched.has(PlanetaryStrength.ATHI_NEECHA)) {
        return PlanetaryStrength.NEECHA;
    }
    return null;
};
```

### 4c. Replace hasExaltation/hasDebilitation bools (around line 248-271)
Old:
```
    const hasExaltation =
        SINHALA_EXALTATION.some((w) => q.includes(w)) || ENGLISH_EXALTATION.some((w) => q.includes(w));

    if (hasExaltation) {
```
New:
```
    const strengthMatch = getStrengthMatch(query);
    if (strengthMatch === PlanetaryStrength.UCHCHA) {
```

And for debilitation:
Old:
```
    const hasDebilitation =
        SINHALA_DEBILITATION.some((w) => q.includes(w)) || ENGLISH_DEBILITATION.some((w) => q.includes(w));

    if (hasDebilitation) {
```
New:
```
    if (strengthMatch === PlanetaryStrength.NEECHA) {
```

Note: This requires declaring `strengthMatch` once and reusing it. Move the `getStrengthMatch(query)` call before the first use and use the result for both. Or call it twice — either works. Cleaner to call once and check the result.

## 5. textContent.ts

Import rename only — change `STRENGTH_LABELS_EN,` to `STRENGTH_DISPLAY_EN,` and `STRENGTH_LABELS_SI,` to `STRENGTH_DISPLAY_SI,` in the import, and update all usages in `textPartsEn` and `textPartsSi`.

---

## Execution order

1. astrologyEnums.ts (enum values, add STRENGTH_LABELS, rename display maps)
2. calculation.ts (remove STRENGTH_VALUES)
3. vocabulary.ts (replace exaltation/debilitation)
4. search/route.ts (use STRENGTH_LABELS)
5. textContent.ts (rename imports)
6. Run tests
