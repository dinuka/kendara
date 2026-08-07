# Ascendant (Lagna) Wargoththama, Gandantha, Gandamula, Pushkara tags

The Ascendant (Lagna) section in the calculation details shows the Wargoththama tag. Alongside it,
it should also show the Gandantha, GandaMula, and Pushkara tags when they apply to the lagna.

If the ascendant is Wargoththama and also Gandantha or GandaMula, the Wargoththama tag is shown as
strikethrough text (matching the existing planet-table behaviour).

## Rules

- Ascendant Gandantha: lagna falls in the 4th pada of Ashlesha, Jyestha, or Revati nakshatras.
- Ascendant GandaMula: lagna falls in the 1st pada of Ashwini, Magha, or Mula nakshatras.
- Ascendant Pushkara: the lagna's navamsa (D9) sign falls in the Pushkara group assigned to its
  birth-chart sign (1/5/9 → 7/9, 2/6/10/3/7/11 → 2/12, 4/8/12 → 4/6).

## Implementation

- New calculation flags `isAscendantGandantha`, `isAscendantGandamula`, `isAscendantPushkara`
  computed in `src/lib/calculation.ts` (auto pipeline) and `synthesizeOtherDetails` in
  `src/lib/manualChart.ts` (manual pipeline), exposed on `CalculationResult`.
- New schema fields on `CalculatedDetails` (`default: false`) so older documents render safely.
- Render-time fallback: `computeAscendantSpecialFlags(ascSign, ascDegree, ascNakshatraId, ascPada)`
  in `src/lib/astrology.ts` derives the same flags from the always-stored `nakshatra.ascendantNakshatra`
  + `ascendant` fields. Both pages use stored flags when present and fall back to this helper, so
  horoscopes calculated before these fields existed (e.g. auto horoscopes like `6a74acb5a5e25025ca4c1303`,
  Mesha lagna at 2.61° = Ashwini pada 1 → Gandamula) still render correct tags.
- Ascendant tags rendered in `src/app/horoscopes/[id]/page.tsx` and mirrored in the compact view in
  `src/app/search/page.tsx`; the Wargoththama tag uses `line-through` when the lagna is also
  Gandantha or GandaMula.
