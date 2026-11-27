# ත්‍රිංශාංශකය

- Should show in the D30 tab in the charts tab.

In Vedic astrology, Thinsashankaya (ත්‍රිංශාංශකය) usually refers to Trimshamsha (त्रिंशांश) — the D30 divisional chart. It divides each 30° zodiac sign into five unequal sections and is traditionally used to examine misfortunes, weaknesses, difficulties, and related astrological factors.

The important point is that D30 is not calculated by dividing every sign into 30 equal parts. Its five sections have different sizes, and their ruling planets depend on whether the sign is odd or even.

## 1. Calculation table for Thinsashankaya (D30)

Use the following Parāśara-style method. The degree ranges are measured within the planet's original D1/Rāśi sign, starting at 0°.

| Degree in D1 sign   | Odd sign → D30 sign | Even sign → D30 sign |
| ------------------- | ------------------- | -------------------- |
| 0°–5°               | Aries ♈             | Taurus ♉             |
| 5°–10° / 12°        | Aquarius ♒          | Virgo ♍              |
| 10° / 12°–18° / 20° | Sagittarius ♐       | Pisces ♓             |
| 18° / 20°–25°       | Gemini ♊            | Capricorn ♑          |
| 25°–30°             | Libra ♎             | Scorpio ♏            |

For precise boundaries, use the separate ranges below: odd signs are 0–5°, 5–10°, 10–18°, 18–25°, 25–30°; even signs are 0–5°, 5–12°, 12–20°, 20–25°, 25–30°. The lower boundary is inclusive and the upper boundary exclusive.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://epandit.in\&sz=32)

ePandit

+1

- Odd signs: Aries, Gemini, Leo, Libra, Sagittarius, Aquarius.
- Even signs: Taurus, Cancer, Virgo, Scorpio, Capricorn, Pisces.

## 2. How to calculate a planet's D30 position

Follow these steps for every planet and the Ascendant.

1. Obtain its exact sidereal longitude in the D1 chart.
2. Identify the original Rāśi sign and the degree within that sign.
3. Determine whether the original sign is odd or even.
4. Find the degree range in the appropriate column of the table.
5. Assign the corresponding D30 sign.

### Worked examples

Example A: Mars at 14° Aries

## 14°

D1 Aries

## Sagittarius ♐

D30 sign

Aries is odd. The degree 14° falls within the 10°–18° interval, which maps to Sagittarius in D30.

Example B: Venus at 14° Taurus

## 14°

D1 Taurus

## Pisces ♓

D30 sign

Taurus is even. The degree 14° falls within the 12°–20° interval, which maps to Pisces in D30.

These examples illustrate why you must consider both the degree and the parity of the original sign.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://jagannathhora.com\&sz=32)

Jagannath Hora

+1

## 3. How to draw the D30 chart

Once you calculate the D30 signs, draw a chart in the same format as your usual Rāśi chart, such as the South Indian fixed-sign chart.

## Sample South Indian D30 Chart

Illustrative layout only — sample placements, not a real horoscope.

12

Pisces

1

Aries

Ma

2

Taurus

3

Gemini

Me

11

Aquarius

Sa

4

Cancer

10

Capricorn

### D30

Trimshamsha

5

Leo

9

Sagittarius

Ju

8

Scorpio

7

Libra

Ve

6

Virgo

Ma = Mars, Sa = Saturn, Ju = Jupiter, Me = Mercury, Ve = Venus. Blank signs have no sample planet assigned.

For your actual chart:

- Keep the 12 zodiac signs in their standard South Indian positions.
- Place each planet in the sign calculated for D30, not its original D1 sign.
- Calculate the Ascendant separately from its exact birth-time-dependent longitude and place it in the resulting D30 sign.
- Use the D30 Ascendant as the first house when determining houses by the whole-sign method.

## 4. Important implementation notes for your astrology app

If you're implementing this in Python or guiding an AI coding agent, the calculation can be represented as a simple lookup.

```
ODD_D30 = [    (0, 5, "Aries"),    (5, 10, "Aquarius"),    (10, 18, "Sagittarius"),    (18, 25, "Gemini"),    (25, 30, "Libra"),]EVEN_D30 = [    (0, 5, "Taurus"),    (5, 12, "Virgo"),    (12, 20, "Pisces"),    (20, 25, "Capricorn"),    (25, 30, "Scorpio"),]def calculate_d30_sign(sign_index, degree_in_sign):    # sign_index: Aries=0, Taurus=1, ..., Pisces=11    if not 0 <= sign_index < 12:        raise ValueError("Invalid zodiac sign index")    if not 0 <= degree_in_sign < 30:        raise ValueError("Degree must be in [0, 30)")    ranges = ODD_D30 if sign_index % 2 == 0 else EVEN_D30    for start, end, d30_sign in ranges:        if start <= degree_in_sign < end:            return d30_sign    raise ValueError("Could not determine D30 sign")
```

One important distinction: this function returns the D30 sign, not a complete D30 degree longitude. If your chart engine needs exact divisional longitudes, define and verify the chosen classical convention for assigning degrees within each resulting sign; do not assume that multiplying the original longitude by 30 produces the correct Trimshamsha coordinate.

For reference, see the D30 calculation rules in Bṛhat Parāśara Horā Śāstra and the practical calculation summary at [Trimshamsha D30 guide](https://epandit.in/en/learn/varga/trimshamsa-d30?utm_source=chatgpt.com).&#x20;

[image](https://www.google.com/s2/favicons?domain=https://epandit.in\&sz=32)

ePandit

+1

Would you like me to provide the complete implementation specification for your AI agent, including the D30 Ascendant calculation, all nine grahas, boundary test cases, and drawing the finished South Indian chart?
