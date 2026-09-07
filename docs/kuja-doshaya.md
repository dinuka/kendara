# කුජ දෝෂය

Below is a structured guideline you can give directly to your AI agent. I recommend treating **Kuja Dosha (Manglik Dosha)** as a separate calculation from **Shani Mangala Yoga** and **Agni Marutha Dosha**, because the detection rules and interpretation are different.

## Kuja Dosha (කුජ දෝෂය) — AI Calculation Guideline

### 1. Purpose

Kuja Dosha is a marriage-related dosha caused primarily by the placement of **Mars (Kuja / Mangala)** in certain houses relative to a reference point.

The AI must determine:

1. Whether Kuja Dosha exists.
2. From which reference point it exists.
3. Which exact house placement causes it.
4. Whether cancellation conditions apply.
5. Whether the final result is:

   * No Kuja Dosha
   * Kuja Dosha present
   * Kuja Dosha partially cancelled
   * Kuja Dosha fully cancelled

---

# 2. Reference Points

Kuja Dosha should be evaluated separately from:

* **Lagna / Ascendant**
* **Moon (Chandra)**
* **Venus (Shukra)**

Do not combine these calculations into one house position.

For each reference:

```text
MarsHouseFromReference =
((MarsAbsoluteHouse - ReferenceAbsoluteHouse + 12) % 12) + 1
```

Where:

* House `1` = Mars is in the same sign/house as the reference.
* House `2` = Mars is second from the reference.
* ...
* House `12` = Mars is twelfth from the reference.

The AI should store each result independently.

Example:

```json
{
  "fromLagna": {
    "marsHouse": 7,
    "dosha": true
  },
  "fromMoon": {
    "marsHouse": 3,
    "dosha": false
  },
  "fromVenus": {
    "marsHouse": 8,
    "dosha": true
  }
}
```

---

# 3. Primary Kuja Dosha Houses

For the calculation logic, Mars causes Kuja Dosha when placed in:

* 1st house
* 2nd house
* 4th house
* 7th house
* 8th house
* 12th house

Therefore:

```text
KUJA_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12]
```

Calculation:

```pseudo
IF MarsHouseFromReference IN [1, 2, 4, 7, 8, 12]
    THEN KujaDosha = TRUE
ELSE
    KujaDosha = FALSE
```

The AI must record the **exact house** responsible.

Example:

```json
{
  "reference": "Lagna",
  "marsHouse": 8,
  "kujaDosha": true,
  "reason": "Mars is placed in the 8th house from Lagna."
}
```

---

# 4. Evaluate Each Reference Separately

The AI must not say simply:

> "Kuja Dosha exists."

Instead, it should produce separate findings.

### From Lagna

```text
Mars in 1, 2, 4, 7, 8, or 12 from Lagna
→ Kuja Dosha from Lagna
```

### From Moon

```text
Mars in 1, 2, 4, 7, 8, or 12 from Moon
→ Kuja Dosha from Moon
```

### From Venus

```text
Mars in 1, 2, 4, 7, 8, or 12 from Venus
→ Kuja Dosha from Venus
```

---

# 5. Multiple Reasons

The same person may have Kuja Dosha for more than one reason.

For example:

```text
Mars is 7th from Lagna
AND
Mars is 8th from Venus
```

The AI should return:

```json
{
  "kujaDoshaExists": true,
  "reasons": [
    {
      "reference": "Lagna",
      "marsHouse": 7,
      "reason": "Mars is in the 7th house from Lagna."
    },
    {
      "reference": "Venus",
      "marsHouse": 8,
      "reason": "Mars is in the 8th house from Venus."
    }
  ]
}
```

Do not collapse multiple causes into one generic result.

---

# 6. Important: Dosha Is Not Automatically Stronger Just Because Multiple References Match

The AI should distinguish:

```text
Existence
```

from

```text
Strength / severity
```

For example:

```text
Kuja Dosha exists from:
- Lagna
- Moon
- Venus
```

This means the dosha is found through multiple traditional reference points.

However, the AI should not automatically assign a mathematical severity such as:

```text
3 references = 3× stronger
```

unless your astrology system defines an explicit strength model.

---

# 7. Cancellation Rules

Kuja Dosha calculation should have two stages:

```text
Stage 1 → Detect Kuja Dosha
Stage 2 → Check Kuja Dosha cancellation
```

The AI must never check cancellation before first identifying the actual dosha-causing placement.

Conceptually:

```pseudo
FOR each reference IN [Lagna, Moon, Venus]:

    marsHouse = calculateHouse(Mars, reference)

    IF marsHouse IN [1, 2, 4, 7, 8, 12]:
        create KujaDoshaReason

        cancellationResult =
            checkKujaDoshaCancellation(
                Mars,
                reference,
                marsHouse,
                chart
            )

        attach cancellationResult
```

---

# 8. Result Structure

I suggest using a structure like this:

```json
{
  "dosha": "Kuja Dosha",

  "exists": true,

  "evaluations": [
    {
      "reference": "Lagna",
      "marsHouse": 7,
      "isDosha": true,

      "reason": {
        "type": "HOUSE_PLACEMENT",
        "description": "Mars is placed in the 7th house from Lagna."
      },

      "cancellation": {
        "status": "NONE",
        "reasons": []
      }
    },

    {
      "reference": "Moon",
      "marsHouse": 3,
      "isDosha": false,
      "reason": null,
      "cancellation": null
    },

    {
      "reference": "Venus",
      "marsHouse": 8,
      "isDosha": true,

      "reason": {
        "type": "HOUSE_PLACEMENT",
        "description": "Mars is placed in the 8th house from Venus."
      },

      "cancellation": {
        "status": "PARTIAL",
        "reasons": [
          {
            "rule": "RULE_NAME",
            "description": "Explanation of the applicable cancellation rule."
          }
        ]
      }
    }
  ],

  "summary": {
    "doshaExists": true,
    "totalCauses": 2,
    "fullyCancelled": false,
    "partiallyCancelled": true
  }
}
```

---

# 9. Critical Difference From Shani Mangala Yoga

The AI must **not confuse Kuja Dosha with Shani Mangala Yoga**.

### Kuja Dosha

The primary condition is:

```text
Mars placement in specific houses
relative to Lagna, Moon, or Venus.
```

Mars and Saturn do **not** need to be together.

Example:

```text
Mars = 7th from Lagna
Saturn = anywhere else
```

Kuja Dosha can still exist.

---

### Shani Mangala Yoga

The primary condition involves a relationship between:

```text
Saturn + Mars
```

depending on the rules you define, such as conjunction, mutual aspect, or other specified relationships.

Therefore:

```text
Mars in 7th house
≠ automatically Shani Mangala Yoga
```

and:

```text
Mars + Saturn together
≠ automatically Kuja Dosha
```

Both must be calculated independently.

---

# 10. Recommended AI Decision Flow

```text
START

│
├── Get Lagna position
├── Get Moon position
├── Get Venus position
└── Get Mars position

FOR EACH reference:
│
├── Calculate Mars house from reference
│
├── Is house one of:
│   [1, 2, 4, 7, 8, 12]?
│
│      NO
│      └── No Kuja Dosha from this reference
│
│      YES
│      │
│      ├── Record exact reason
│      │
│      ├── Check applicable cancellation rules
│      │
│      └── Mark:
│             ACTIVE
│             PARTIALLY_CANCELLED
│             FULLY_CANCELLED
│
└── Continue with next reference

END

Generate:
- All active causes
- All cancelled causes
- Exact cancellation reasons
- Final Kuja Dosha status
```

## Recommended rule for your AI agent

The most important principle is:

> **Every Kuja Dosha reason must be independently identified and independently tested for cancellation.**

For example, if:

* Mars is 7th from Lagna → Cause A
* Mars is 8th from Venus → Cause B

and a cancellation rule applies only to Cause A, the AI must **not automatically cancel Cause B**.

The final logic should therefore be:

```text
Kuja Dosha
 ├── Cause 1
 │    ├── Detection rule
 │    └── Cancellation rules
 │
 ├── Cause 2
 │    ├── Detection rule
 │    └── Cancellation rules
 │
 └── Cause 3
      ├── Detection rule
      └── Cancellation rules
```

If you want, the next step is to define the **exact Kuja Dosha Bhanga / cancellation rules** you want to follow and turn everything into a strict **AI-agent specification with rule IDs, conditions, priority, and JSON/pseudocode**. This is important because Kuja Dosha cancellation rules vary considerably between astrological traditions, so your app should explicitly use only the rule set you approve.
