# ඉන්දු ලග්නය

- Should show in the birth chart as IL.

- How to calculate?

Yes. For your astrology app, I would implement **Indu Lagna (Indu Lagna / Dhana Lagna)** as a deterministic calculation from the **Janma Lagna and Moon sign**, using the classical **Kala values** of the 9th lords. The calculation does **not** require the degrees of the Moon or Ascendant—only their **Rāśi/signs**. ([IndiaDivine.org][1])

## Indu Lagna — AI Agent Implementation Guide

### 1. Required inputs

The agent needs:

```text
Janma Lagna (Ascendant Rāśi)
Moon Rāśi (Janma Rāśi)
Rāśi lord mapping
Planetary Kala values
```

Use the standard seven-graha Kala values:

| Graha               | Kala |
| ------------------- | ---: |
| Sun (Surya)         |   30 |
| Moon (Chandra)      |   16 |
| Mars (Kuja/Mangala) |    6 |
| Mercury (Budha)     |    8 |
| Jupiter (Guru)      |   10 |
| Venus (Shukra)      |   12 |
| Saturn (Shani)      |    1 |

**Rahu and Ketu are not used.** ([IndiaDivine.org][1])

---

## 2. Find the 9th lord from Janma Lagna

Start from the Ascendant sign and count **9 signs inclusively**.

For example:

```text
Lagna = Aries

1 Aries
2 Taurus
3 Gemini
4 Cancer
5 Leo
6 Virgo
7 Libra
8 Scorpio
9 Sagittarius
```

Therefore:

```text
9th sign from Aries = Sagittarius
Lord of Sagittarius = Jupiter
Jupiter Kala = 10
```

The important point for the agent is:

> The "9th lord from Lagna" means the lord of the **9th sign counted from the Lagna sign**, not the planet occupying the 9th house.

---

## 3. Find the 9th lord from Moon

Do exactly the same calculation starting from the **Moon's Rāśi**.

Example:

```text
Moon = Taurus

1 Taurus
2 Gemini
3 Cancer
4 Leo
5 Virgo
6 Libra
7 Scorpio
8 Sagittarius
9 Capricorn
```

Therefore:

```text
9th sign from Taurus = Capricorn
Lord of Capricorn = Saturn
Saturn Kala = 1
```

This gives:

```text
9th lord from Lagna  → Jupiter → 10 Kala
9th lord from Moon   → Saturn → 1 Kala
```

---

## 4. Add the two Kala values

```text
Total Kala =
Kala of 9th lord from Lagna
+
Kala of 9th lord from Moon
```

In our example:

```text
10 + 1 = 11
```

---

## 5. Divide by 12 and obtain the remainder

```text
remainder = totalKala % 12
```

Example:

```text
11 % 12 = 11
```

The remainder is normally `0–11`.

There is an important convention for **remainder = 0**: it is treated as **12**, meaning the 12th sign from the Moon is selected. This convention is explicitly described in several traditional-method explanations. ([Anandamayee][2])

So:

```text
if remainder == 0:
    count = 12
else:
    count = remainder
```

---

## 6. Count from the Moon sign

Now count the resulting number of signs **inclusively from the Moon's sign**.

For the example:

```text
Moon = Taurus
Count = 11
```

Count:

```text
1  Taurus
2  Gemini
3  Cancer
4  Leo
5  Virgo
6  Libra
7  Scorpio
8  Sagittarius
9  Capricorn
10 Aquarius
11 Pisces
```

Therefore:

```text
Indu Lagna = Pisces
```

This inclusive counting rule is important. The Moon's sign itself is counted as **1**, not 0. ([Rohshan][3])

---

# 7. Complete algorithm

You can give your AI coding agent essentially this specification:

```text
INDU LAGNA CALCULATION

INPUT:
    lagnaSign
    moonSign

CONSTANT:
    kala = {
        Sun: 30,
        Moon: 16,
        Mars: 6,
        Mercury: 8,
        Jupiter: 10,
        Venus: 12,
        Saturn: 1
    }

ALGORITHM:

1. Determine the 9th sign from lagnaSign.
2. Determine the lord of that 9th sign.
3. Get the Kala value of that lord.

4. Determine the 9th sign from moonSign.
5. Determine the lord of that 9th sign.
6. Get the Kala value of that lord.

7. totalKala =
       lagna9thLordKala +
       moon9thLordKala

8. remainder = totalKala % 12

9. If remainder == 0:
       count = 12
   Else:
       count = remainder

10. Count `count` signs inclusively from moonSign.

11. The resulting sign is Indu Lagna.

OUTPUT:
    - Lagna sign
    - 9th sign from Lagna
    - 9th lord from Lagna
    - Kala of 9th lord from Lagna
    - Moon sign
    - 9th sign from Moon
    - 9th lord from Moon
    - Kala of 9th lord from Moon
    - Total Kala
    - Remainder
    - Count from Moon
    - Indu Lagna sign
```

---

## 8. Recommended implementation formula

If your internal sign numbering is:

```text
Aries      = 0
Taurus     = 1
Gemini     = 2
Cancer     = 3
Leo        = 4
Virgo      = 5
Libra      = 6
Scorpio    = 7
Sagittarius= 8
Capricorn  = 9
Aquarius   = 10
Pisces     = 11
```

then the calculation becomes very simple.

### 9th sign

Because counting is inclusive:

```python
ninth_sign = (sign + 8) % 12
```

### Indu Lagna

```python
remainder = (lagna_9th_lord_kala + moon_9th_lord_kala) % 12

count = 12 if remainder == 0 else remainder

indu_lagna = (moon_sign + count - 1) % 12
```

The `-1` is essential because the Moon's sign is counted as **1**.

---

# 9. Example for testing

Use this as an automated test case:

```text
Lagna = Aries
Moon = Taurus

9th from Lagna:
    Sagittarius
    Lord = Jupiter
    Kala = 10

9th from Moon:
    Capricorn
    Lord = Saturn
    Kala = 1

Total Kala:
    10 + 1 = 11

Remainder:
    11 % 12 = 11

Count 11 signs from Taurus:

1  Taurus
2  Gemini
3  Cancer
4  Leo
5  Virgo
6  Libra
7  Scorpio
8  Sagittarius
9  Capricorn
10 Aquarius
11 Pisces

Indu Lagna = Pisces
```

This example is also independently documented in current explanations of the traditional calculation. ([ShreeKundli][4])

### One important instruction for your AI agent

I would explicitly tell it:

> **Do not calculate Indu Lagna from planetary degrees, Nakshatra, Navamsa, Bhava cusps, or the physical position of the 9th lord. Indu Lagna is determined from the Rāśi of the Lagna, the Rāśi of the Moon, the lords of the respective 9th signs, their fixed Kala values, and inclusive counting from the Moon sign.**

Also, keep **calculation** separate from **interpretation** in your app. The calculation produces one unambiguous sign; interpretation of the Indu Lagna, its lord, occupants, aspects, and wealth indications should be a separate astrology-analysis module. ([Rohshan][3])

[1]: https://www.indiadivine.org/content/topic/1211104-indu-lagna/?utm_source=chatgpt.com "Indu lagna - Vedic Astrology (Jyotisha) - IndiaDivine.org"
[2]: https://anandamoyee.home.blog/2019/08/18/indu-lagna/?utm_source=chatgpt.com "Indu Lagna – Anandamayee"
[3]: https://www.rohshan.com/tools/indu-lagna-calculator?utm_source=chatgpt.com "Free Indu Lagna Calculator — Find Your Wealth Ascendant"
[4]: https://www.shreekundli.com/vedic-astrology/special-lagnas/indu-lagna?utm_source=chatgpt.com "Indu Lagna in Vedic Astrology - Wealth & Prosperity Calculator | Complete Guide - ShreeKundli"
