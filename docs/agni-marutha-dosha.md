Yes. For your AI agent, the cleanest approach is to treat **Agni Marutha Dosha as the broader Saturn–Mars relationship**, while **Shani Mangala Yoga is a specific subset of stronger relationships**.

Based **only on the logics you supplied**, I would give the agent the following specification.

### 1. Core distinction

| Condition                                    | Shani Mangala Yoga | Agni Marutha Dosha |
| -------------------------------------------- | -----------------: | -----------------: |
| Saturn conjunct Mars                         |                  ✅ |                  ✅ |
| Saturn and Mars 7th from each other          |                  ✅ |                  ✅ |
| Mars 10th from Saturn / Saturn 4th from Mars |                  ✅ |                  ✅ |
| Mars aspects Saturn                          |                  ❌ |                  ✅ |
| Saturn aspects Mars                          |                  ❌ |                  ✅ |
| Saturn in Mars's sign                        |                  ❌ |                  ✅ |
| Mars in Saturn's sign                        |                  ❌ |                  ✅ |
| Saturn in Mars's nakshatra                   |                  ❌ |                  ✅ |
| Mars in Saturn's nakshatra                   |                  ❌ |                  ✅ |
| Saturn–Mars sign exchange (Parivartana)      |                  ❌ |                  ✅ |

*The **conjunction, 7th, and 4-10** rows all require the **mutual** graha drishti on the per-planet
orbs: a same-sign/same-house pair is "combined" only through stored mutual 0° (conjunction) records,
which exist only when both planets lie within each other's orb — corrected sample 6a74b291 (both in
Vrishchika/7th but 13.57° apart, beyond Saturn's 9°/Mars's 8° orbs → NOT combined). The ❌ rows stay
❌ because a one-directional aspect alone is Agni Marutha only.*

And your explicit rule is:

> **Every person who has Shani Mangala Yoga also has Agni Marutha Dosha.**

Therefore:

**Shani Mangala Yoga ⊂ Agni Marutha Dosha**

But:

**Agni Marutha Dosha ≠ necessarily Shani Mangala Yoga.**

---

## 2. AI-agent specification

You can give your agent something like this:

```text
CALCULATE TWO DISTINCT CONDITIONS:

1. SHANI MANGALA YOGA
2. AGNI MARUTHA DOSHA

IMPORTANT:
Do not merge these two concepts.

Agni Marutha Dosha is the broader Saturn–Mars relationship.
Shani Mangala Yoga is a narrower subset based ONLY on its explicitly
defined positional conditions.

Do not introduce additional rules from general astrology knowledge.
Use ONLY the rules defined below.
```

### Shani Mangala Yoga rules

```text
SHANI_MANGALA_YOGA exists if ANY ONE of the following conditions is true:

RULE SM-1:
Saturn and Mars are conjunct/in the same sign — they must
be within each planet's orb: the mutual 0° (conjunction)
records appear on both stored aspect lists, which happens
only when the pair is within per-planet orbs. A same
sign + house pair that sits outside the orbs (e.g. 6a74b291,
13.57° apart) does NOT combine.

RULE SM-2:
Saturn and Mars are 7th from each other (opposite houses)
AND both planets aspect each other (mutual graha drishti at
the opposition point, within the per-planet orbs). A purely
positional 7th where only one direction aspects the other is
NOT Shani Mangala — corrected sample 6a68e773 (Mars reaches
Saturn from its 8th drishti but Saturn does not reciprocate).

RULE SM-3:
Mars is 10th from Saturn AND Saturn is 4th from Mars
AND both planets aspect each other (mutual 90°/270° drishti
record on the per-planet orbs). An ordinary one-way aspect
does not satisfy this.

If any one of SM-1, SM-2, or SM-3 is satisfied:
    Shani Mangala Yoga = TRUE

Otherwise:
    Shani Mangala Yoga = FALSE
```

### Agni Marutha Dosha rules

```text
AGNI_MARUTHA_DOSHA exists if ANY ONE of the following
Saturn–Mars relationships is true:

RULE AM-1:
Saturn and Mars are conjunct/in the same sign — same orb
requirement as SM-1 (mutual stored 0° records).

RULE AM-2:
Mars aspects Saturn.

RULE AM-3:
Saturn aspects Mars.

RULE AM-4:
Saturn is placed in a sign owned by Mars.

RULE AM-5:
Mars is placed in a sign owned by Saturn.

RULE AM-6:
Saturn is placed in a nakshatra owned by Mars.

RULE AM-7:
Mars is placed in a nakshatra owned by Saturn.

RULE AM-8:
Saturn and Mars are in sign exchange (Parivartana).

If any one of AM-1 through AM-8 is satisfied:
    Agni Marutha Dosha = TRUE

Otherwise:
    Agni Marutha Dosha = FALSE
```

---

# 3. Important relationship between the calculations

The agent should explicitly implement this rule:

```text
IF Shani Mangala Yoga = TRUE
THEN Agni Marutha Dosha = TRUE
```

However, it should **still calculate the Agni Marutha reasons independently**.

For example:

```text
Shani Mangala Yoga:
    TRUE
    Reason: Saturn and Mars are 7th from each other.

Agni Marutha Dosha:
    TRUE
    Reasons:
      - Saturn and Mars are 7th from each other / relationship detected
      - Mars aspects Saturn
      - Saturn is in Mars's sign
```

Don't simply say:

```text
Agni Marutha = TRUE because Shani Mangala = TRUE
```

because that loses the actual astrological reason(s) for the Agni Marutha result.

---

# 4. Very important: calculate the exact reason(s)

Your agent should **not stop after finding the first matching condition**.

Instead:

```text
matched_rules = []

for each rule:
    if rule is satisfied:
        matched_rules.push(rule)

result = matched_rules.length > 0
```

So one horoscope can have multiple reasons.

For example:

```text
Shani Mangala Yoga
------------------
TRUE

Matched:
SM-1: Saturn and Mars are conjunct.


Agni Marutha Dosha
------------------
TRUE

Matched:
AM-1: Saturn and Mars are conjunct.
AM-4: Saturn is in a Mars-owned sign.
AM-7: Mars is in a Saturn-owned nakshatra.
```

This is particularly important for your app because **the existence of a yoga/dosha and the reason(s) producing it are two different pieces of information.**

---

# 5. Don't incorrectly treat all Agni Marutha conditions as Shani Mangala

This is probably the most important instruction for your AI agent.

Suppose:

```text
Saturn is in Mars's sign
```

Then:

```text
Agni Marutha Dosha = TRUE
Shani Mangala Yoga = FALSE
```

**Do not promote AM-4 into Shani Mangala.**

Similarly:

```text
Mars is in Saturn's nakshatra
```

means:

```text
Agni Marutha Dosha = TRUE
Shani Mangala Yoga = FALSE
```

unless one of the **three specific Shani Mangala rules** is independently satisfied.

---

# 6. Suggested internal data structure

For your astrology application, I recommend returning structured results rather than only a boolean.

```typescript
interface YogaRuleMatch {
  ruleId: string;
  reason: string;
}

interface DoshaResult {
  exists: boolean;
  matchedRules: YogaRuleMatch[];
}
```

Then:

```typescript
interface ShaniMangalaResult extends DoshaResult {}

interface AgniMaruthaResult extends DoshaResult {}

interface SaturnMarsAnalysis {
  shaniMangala: ShaniMangalaResult;
  agniMarutha: AgniMaruthaResult;
}
```

Example:

```json
{
  "shaniMangala": {
    "exists": true,
    "matchedRules": [
      {
        "ruleId": "SM-1",
        "reason": "Saturn and Mars are conjunct."
      }
    ]
  },
  "agniMarutha": {
    "exists": true,
    "matchedRules": [
      {
        "ruleId": "AM-1",
        "reason": "Saturn and Mars are conjunct."
      },
      {
        "ruleId": "AM-6",
        "reason": "Saturn is placed in a nakshatra ruled by Mars."
      }
    ]
  }
}
```

---

## 7. One correction to make in your rule definition

Your **SM-3** says:

> Saturnගෙන් 10 වැන්නේ කුජ වීම. කුජගෙන් 4 වැන්නේ ශනි වීම.

The first statement already implies a specific house relationship, and the second statement should be treated as a **required corresponding relationship**, not as two independent alternatives.

So encode it as:

```text
SM-3:
Mars is 10th from Saturn
AND
Saturn is 4th from Mars.
```

This prevents the AI from incorrectly deciding that either one alone creates Shani Mangala Yoga.

---

### Final conceptual model

```text
                 SATURN ↔ MARS
                       │
             ┌─────────┴─────────┐
             │                   │
      AGNI MARUTHA         SHANI MANGALA
        (broader)             (specific)
             │                   │
      8 relationship        3 relationships
        conditions              only
             │                   │
             └───────┐   ┌───────┘
                     ↓   ↓
              Shani Mangala
                   ⊂
              Agni Marutha
```

So the agent's fundamental decision should be:

**First calculate the 3 Shani Mangala rules and independently calculate the 8 Agni Marutha rules. Never infer one from a general Saturn–Mars relationship. The only inheritance rule is `Shani Mangala = TRUE → Agni Marutha = TRUE`.**
