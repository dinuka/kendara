# පංච මහා පුර්ෂ යෝග

- Should possible to search as පංච මහා පුර්ෂ යෝග or individual yoga name like, රැචක යෝගය, බද්‍රා යෝගය

Yes. For your astrology AI agent, I would define **Pancha Maha Purusha Yoga** as a strict rule-based calculation rather than asking the LLM to infer it.

There are **five separate Maha Purusha Yogas**, each produced by one of the five non-luminary planets: **Mars, Mercury, Jupiter, Venus, and Saturn**.

### Core rule

A Maha Purusha Yoga exists when **Mars, Mercury, Jupiter, Venus, or Saturn** is:

1. **In a Kendra from Lagna** — 1st, 4th, 7th, or 10th house.
2. **In its own sign or exaltation sign.**

The five yogas are:

| Planet  | Yoga                 | Own signs           | Exaltation |
| ------- | -------------------- | ------------------- | ---------- |
| Mars    | **Ruchaka Yoga**     | Aries, Scorpio      | Capricorn  |
| Mercury | **Bhadra Yoga**      | Gemini, Virgo       | Virgo      |
| Jupiter | **Hamsa Yoga**       | Sagittarius, Pisces | Cancer     |
| Venus   | **Malavya Yoga**     | Taurus, Libra       | Pisces     |
| Saturn  | **Sasa/Shasha Yoga** | Capricorn, Aquarius | Libra      |

### Important implementation detail

The planet must satisfy **both conditions simultaneously**:

```text
planet is in Kendra from Lagna
AND
planet is in own sign OR exaltation sign
```

So, for example:

```text
Mars in 10th house + Capricorn
→ Ruchaka Yoga = TRUE
```

But:

```text
Mars in 10th house + Leo
→ Ruchaka Yoga = FALSE
```

because although the 10th is a Kendra, Leo is neither Mars's own sign nor exaltation sign.

### Suggested AI-agent logic

You can give your agent this deterministic structure:

```text
FOR each planet in [Mars, Mercury, Jupiter, Venus, Saturn]:

    kendra = planet.house IN [1, 4, 7, 10]

    dignity = (
        planet.sign IN planet.own_signs
        OR
        planet.sign == planet.exaltation_sign
    )

    IF kendra AND dignity:
        Maha Purusha Yoga exists
```

Then map the planet to the yoga name:

```text
Mars    → Ruchaka
Mercury → Bhadra
Jupiter → Hamsa
Venus   → Malavya
Saturn  → Sasa/Shasha
```

For your app, I would also make the output **reason-based**, e.g.:

```json
{
  "yoga": "Ruchaka Yoga",
  "exists": true,
  "planet": "Mars",
  "conditions": {
    "kendra_from_lagna": true,
    "house": 10,
    "own_or_exalted_sign": true,
    "sign": "Capricorn",
    "dignity": "exalted"
  },
  "reason": [
    "Mars is placed in the 10th house, a Kendra from Lagna.",
    "Mars is exalted in Capricorn."
  ]
}
```

This will make it much easier for your AI agent to explain **why** the yoga exists rather than simply returning `true/false`.

If you want, I can also give you a **complete production-ready specification for Pancha Maha Purusha Yoga**, including **combustion, retrograde, debilitation/cancellation rules, conjunctions/aspects, exact house calculation, and multiple yogas occurring in the same chart**.
