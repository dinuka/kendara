# ධර්මකර්මාධිපති යෝගය

Yes. For your astrology AI agent, I would define **Dharma Karmadhipati Yoga (ධර්ම කර්මාධිපති යෝගය)** as a rule-based yoga involving the **9th lord (Dharma)** and **10th lord (Karma)**.

The important part is to make the agent distinguish **formation**, **strength**, and **results**, rather than simply saying the yoga exists whenever the 9th and 10th lords are related.

### Core calculation logic

For a Vedic D1/Rāśi chart:

1. Determine the **Lagna (Ascendant)**.
2. Determine the **9th house** from Lagna.
3. Determine the **10th house** from Lagna.
4. Find the lords of the 9th and 10th houses.
5. Check whether the **9th lord and 10th lord have a qualifying relationship**.

The primary relationships to check are:

* **Conjunction** — 9th lord and 10th lord occupy the same sign/house.
* **Mutual aspect** — 9th lord aspects 10th lord and 10th lord aspects 9th lord (a genuine mutual aspect requires BOTH lords to aspect each other; a one-directional drishti does not qualify).
* **Parivartana (exchange)** — 9th lord occupies the 10th lord's sign and 10th lord occupies the 9th lord's sign.
* Other classical forms of sambandha may be included only if your astrology system explicitly defines them.

### Important distinction

Do **not** identify Dharma Karmadhipati Yoga merely because:

> "The 9th lord is strong"
> or
> "The 10th lord is strong."

Those indicate strength of Dharma/Karma houses but **do not themselves establish the yoga**.

Likewise, don't confuse:

> **9th lord + 10th lord relationship**

with other yogas such as **Rāja Yoga**. Dharma Karmadhipati Yoga specifically emphasizes the relationship between the **9th-house lord and 10th-house lord**.

### Suggested AI-agent rule structure

You can give your agent a structure like this:

```text
Dharma Karmadhipati Yoga

Purpose:
Determine whether the 9th lord (Dharma) and 10th lord (Karma)
form a qualifying sambandha in the D1/Rasi chart.

Step 1:
Identify Lagna.

Step 2:
Identify the 9th house from Lagna.
Find its lord = Dharma Lord (9th Lord).

Step 3:
Identify the 10th house from Lagna.
Find its lord = Karma Lord (10th Lord).

Step 4:
Check the relationship between the 9th Lord and 10th Lord.

Yoga is formed when one of the configured qualifying relationships exists:

A. Conjunction:
   9th Lord and 10th Lord are in the same house/sign.

B. Mutual aspect / qualifying aspect:
   The 9th Lord and 10th Lord mutually aspect each other
   (both directions) via the configured planetary
   aspect relationship.

C. Parivartana:
   The 9th Lord occupies the sign owned by the 10th Lord,
   AND the 10th Lord occupies the sign owned by the 9th Lord.

Step 5:
If none of the configured relationships exists:
   Dharma Karmadhipati Yoga = NOT FORMED.

Step 6:
If a relationship exists:
   Dharma Karmadhipati Yoga = FORMED.

Then separately evaluate:
- dignity of the 9th Lord
- dignity of the 10th Lord
- house placement
- combustion
- retrogression, if your system considers it
- debilitation/exaltation
- affliction
- benefic/malefic influences
- relevant divisional-chart confirmation

Do NOT use these strength factors to create the yoga.
Use them only to determine the strength/quality of an already identified yoga.
```

### One thing I recommend for your AI architecture

Store the result as **formation reasons**, rather than only a boolean:

```json
{
  "yoga": "Dharma Karmadhipati Yoga",
  "exists": true,
  "dharma_lord": "Jupiter",
  "karma_lord": "Venus",
  "formation": [
    {
      "type": "conjunction",
      "reason": "9th lord and 10th lord occupy the same house"
    }
  ],
  "strength": "...",
  "cancellation": [],
  "interpretation": "..."
}
```

This is especially useful for your astrology AI because the agent can later explain **exactly why the yoga exists**, instead of producing a generic interpretation.

If you want, I can also give you a **complete deterministic specification for Dharma Karmadhipati Yoga**, including **all accepted formation conditions, exceptions/cancellation rules, strength grading, and JSON output schema** in the same style as the Shani Mangala / Agni Marutha logic you were building.
