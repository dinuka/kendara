Below is a clean **English rule specification** you can give directly to your AI astrology agent. I have kept the logic faithful to the Sinhala rules you provided and separated **detection**, **classification**, and **interpretation** so the agent does not mix the three concepts.

# Guide: Kala Sarpa Dosha, Kala Amurtha Dosha & Deepta Yoga

## 1. General Rules

The AI agent must calculate these combinations using the **sidereal/Vedic planetary longitudes and zodiacal positions** supplied by the horoscope.

### Planets considered

For Kala Sarpa Dosha, Kala Amurtha Dosha, and Deepta Yoga, consider these **7 classical planets**:

* Sun
* Moon
* Mars
* Mercury
* Jupiter
* Venus
* Saturn

Rahu and Ketu are the two reference points.

**Important:** Do not treat Rahu or Ketu as one of the six planets between them.

---

# 2. Deepta Yoga

## Definition

Deepta Yoga occurs when:

1. Rahu and Ketu divide the zodiac into two sides.
2. Of the **7 classical planets**, exactly **one planet is outside the Rahu–Ketu enclosure**, while the other six are inside.
3. The single planet outside the enclosure must be a planet capable of producing a **Pancha Maha Purusha Yoga**.

**Directional frame:** the "inside" side is the **Kala Sarpa frame** — the six planets sit on the **Rahu-directed** (Ketu → Rahu) arc, and the lone planet is the only one on the **Ketu-directed** (Rahu → Ketu) arc. In other words, Deepta Yoga is the 6-1 split of an otherwise-Kala-Sarpa configuration.

> A 6-1 split where the six planets sit on the **Ketu-directed** side (a Kala **Amurtha** frame) is **NOT** Deepta Yoga — the lone planet on the Rahu side does not produce Deepta. (Reported for horoscope `6a68e36d150a9f9377fad101`: Guru on the Rahu side with the other six in the Kala Amurtha direction is not Guru Deepta Yoga. If the other six planets move to the Rahu side instead, Deepta Yoga applies.)

The single planet is called the **Deepta Yoga planet**.

### Eligible planets

Only these five planets can produce Deepta Yoga:

* Mars → Ruchaka Yoga
* Mercury → Bhadra Yoga
* Jupiter → Hamsa Yoga
* Venus → Malavya Yoga
* Saturn → Sasa Yoga

Therefore:

* Sun cannot be the Deepta Yoga planet.
* Moon cannot be the Deepta Yoga planet.
* Rahu cannot be the Deepta Yoga planet.
* Ketu cannot be the Deepta Yoga planet.

### Example

If all classical planets except Jupiter are positioned between Rahu and Ketu, then:

> **Jupiter Deepta Yoga exists.**

The result should be named according to the planet:

* Mars → **Kuja Deepta Yoga**
* Mercury → **Budha Deepta Yoga**
* Jupiter → **Guru Deepta Yoga**
* Venus → **Shukra Deepta Yoga**
* Saturn → **Shani Deepta Yoga**

## Strength rule

Deepta Yoga is considered stronger when the Deepta Yoga planet itself is strong.

The agent should therefore separately evaluate the planet's dignity/strength rather than automatically assuming that every Deepta Yoga has the same strength.

---

# 3. Deepta Yoga Interpretations

These are the interpretations supplied for the application.

### Kuja Deepta Yoga

Indicates:

* Courage
* Determination
* Ability to recover from setbacks
* Strong independence
* Difficulty progressing while working completely under another person's authority

### Budha Deepta Yoga

Indicates:

* Pleasant and likable personality
* Intelligence
* Ability in accounting and calculation-related work
* Good communication and speaking ability

### Guru Deepta Yoga

Indicates:

* Financial gains
* Fame
* Recognition and praise
* Ability to provide advisory or counseling services

### Shukra Deepta Yoga

Indicates:

* Pleasant personality
* Comforts and luxuries
* Vehicles
* Property/land
* Favorable indications for marriage

### Shani Deepta Yoga

Indicates:

* Life may contain problems, obstacles, and hardships.
* Through those difficulties, the native can eventually reach a significantly higher and better position in life.

---

# 4. Kala Sarpa Dosha

## Detection Rule

Kala Sarpa Dosha exists when:

1. Rahu and Ketu form the two boundaries of the zodiacal axis.
2. **All seven classical planets** are located within the same Rahu–Ketu half of the zodiac.
3. The planets proceed in the **direction of Rahu** from Ketu to Rahu.

In other words:

> All seven classical planets must be contained within the Rahu → Ketu side of the zodiac, with none of the seven planets lying on the opposite side.

### Important distinction

Do not determine Kala Sarpa Dosha merely because all planets appear visually between Rahu and Ketu.

The **direction must also be checked**.

There are two possible planetary paths between Rahu and Ketu:

* Ketu → Rahu
* Rahu → Ketu

If all planets are on the **Rahu-directed side**, classify it as **Kala Sarpa Dosha**.

If all planets are on the **Ketu-directed side**, classify it as **Kala Amurtha Dosha**.

---

# 5. Kala Sarpa Dosha Classification

After confirming that Kala Sarpa Dosha exists, determine its type from the **house occupied by Rahu**.

Use the Ascendant/Lagna-based house number of Rahu.

| Rahu House | Kala Sarpa Type                |
| ---------- | ------------------------------ |
| 1          | Ananta Kala Sarpa Dosha        |
| 2          | Kulika Kala Sarpa Dosha        |
| 3          | Vasuki Kala Sarpa Dosha        |
| 4          | Shankhapala Kala Sarpa Dosha   |
| 5          | Padma Kala Sarpa Dosha         |
| 6          | Mahapadma Kala Sarpa Dosha     |
| 7          | Takshaka Kala Sarpa Dosha      |
| 8          | Karkotaka Kala Sarpa Dosha     |
| 9          | Shankhachooda Kala Sarpa Dosha |
| 10         | Ghataka Kala Sarpa Dosha       |
| 11         | Vishadhara Kala Sarpa Dosha    |
| 12         | Sheshanaga Kala Sarpa Dosha    |

**Important:** The type is determined from **Rahu's house**, not Ketu's house.

---

# 6. Kala Sarpa Dosha Interpretations

The AI agent should return the interpretation corresponding to the identified type.

### 1. Ananta Kala Sarpa Dosha

Possible indications:

* Problems in marriage
* Loss of interest in marriage
* Difficulties or disturbances within married life

### 2. Kulika Kala Sarpa Dosha

Possible indications:

* Health-related problems
* Reduced longevity or concerns regarding lifespan
* Domestic/family-life problems
* Possible unexplained/spiritual disturbances

### 3. Vasuki Kala Sarpa Dosha

Possible indications:

* Problems involving siblings
* Problems involving neighbors
* Efforts may not produce results proportional to the effort invested

### 4. Shankhapala Kala Sarpa Dosha

Possible indications:

* Problems related to home/property
* Employment/career problems
* Vehicle accidents or vehicle-related difficulties

### 5. Padma Kala Sarpa Dosha

Possible indications:

* Difficulties concerning children
* Obstacles in romantic relationships
* Problems with friends
* Financial losses

### 6. Mahapadma Kala Sarpa Dosha

Possible indications:

* Enemies and opposition
* Illness or health difficulties
* Damage to reputation/respect
* Financial losses

### 7. Takshaka Kala Sarpa Dosha

Possible indications:

* Marital conflicts
* Extramarital relationship-related difficulties
* Losses through partnerships or joint activities

### 8. Karkotaka Kala Sarpa Dosha

Possible indications:

* Troubles and misfortunes
* Sudden accidents
* Life-threatening circumstances

### 9. Shankhachooda Kala Sarpa Dosha

Possible indications:

* Reduced inclination toward religion/spiritual matters
* Fortune/luck becoming distant
* Obstacles in education

### 10. Ghataka Kala Sarpa Dosha

Possible indications:

* Career/employment problems
* Difficulties concerning gains or support from the paternal side
* Damage to reputation or public standing

### 11. Vishadhara Kala Sarpa Dosha

Possible indications:

* Conflicts with friends
* Conflicts with elder siblings
* Problems in romantic relationships
* Problems concerning children

### 12. Sheshanaga Kala Sarpa Dosha

Possible indications:

* Problems caused by enemies
* Confinement/imprisonment-related circumstances
* Destruction or loss of property
* Weakness or deterioration of physical health

---

# 7. Kala Amurtha Dosha

## Detection Rule

Kala Amurtha Dosha is the opposite directional configuration to Kala Sarpa Dosha.

It exists when:

1. Rahu and Ketu form the two boundaries.
2. All seven classical planets are located within the same Rahu–Ketu half of the zodiac.
3. The planets are positioned in the **direction of Ketu**.

Therefore:

> If all seven classical planets are contained on the Ketu-directed side of the Rahu–Ketu axis, classify the configuration as **Kala Amurtha Dosha**.

---

# 8. Kala Sarpa vs Kala Amurtha

The agent must explicitly distinguish these two based on **direction**.

| Condition                                                                 | Result                    |
| ------------------------------------------------------------------------- | ------------------------- |
| All 7 planets are on Rahu's directional side                              | **Kala Sarpa Dosha**      |
| All 7 planets are on Ketu's directional side                              | **Kala Amurtha Dosha**    |
| Planets occupy both sides                                                 | **Neither**               |
| Exactly one planet is outside and it is Mars/Mercury/Jupiter/Venus/Saturn | **Potential Deepta Yoga** |

### Critical rule

Do **not** report Kala Sarpa Dosha and Kala Amurtha Dosha simultaneously for the same planetary configuration.

They are mutually exclusive directional classifications.

---

# 9. Kala Amurtha Interpretation

According to the supplied interpretation:

Kala Amurtha Dosha can indicate an area of deficiency or difficulty in life, similar to Kala Sarpa Dosha.

However, the distinction is:

> Kala Sarpa is associated with the influence of Rahu, whereas Kala Amurtha is associated with Ketu.

The Ketu influence is interpreted as something that can be overcome or released through **understanding, awareness, and realization**.

Therefore the AI should not describe Kala Amurtha simply as an identical version of Kala Sarpa Dosha.

---

# 10. Recommended AI Calculation Output

For reliable AI-agent implementation, return the result in this logical structure:

```text
1. Check Rahu–Ketu planetary enclosure.

2. Count the seven classical planets on each side.

3. If all seven are on the Rahu-directed side:
   → Kala Sarpa Dosha = TRUE

4. If all seven are on the Ketu-directed side:
   → Kala Amurtha Dosha = TRUE

5. If neither condition is satisfied:
   → Kala Sarpa Dosha = FALSE
   → Kala Amurtha Dosha = FALSE

6. Independently check Deepta Yoga:
   - Exactly one classical planet must be outside the Rahu–Ketu enclosure.
   - That planet must be Mars, Mercury, Jupiter, Venus, or Saturn.
   - If so, identify the corresponding Deepta Yoga.

7. If Kala Sarpa Dosha exists:
   - Determine Rahu's house from Lagna.
   - Map Rahu's house to the corresponding Kala Sarpa type.
   - Return the specific interpretation.

8. If Kala Amurtha Dosha exists:
   - Report Kala Amurtha Dosha.
   - Do not classify it as Kala Sarpa Dosha.
```

## Important implementation note

For your AI agent, I recommend keeping **three separate layers**:

**Detection → Classification → Interpretation**

For example:

```text
Detection:
Kala Sarpa Dosha = TRUE

Classification:
Rahu = 5th house
→ Padma Kala Sarpa Dosha

Interpretation:
→ Child-related difficulties
→ Romantic relationship obstacles
→ Problems with friends
→ Financial losses
```

This is much safer than asking the LLM to infer the yoga directly from an interpretation paragraph. It also makes your astrology calculation engine easier to test and debug.
