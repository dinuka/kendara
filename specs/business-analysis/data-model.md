# Data Model

## Entities

### User

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| googleId | String | Google SSO ID |
| email | String | Email address |
| name | String | Display name |
| role | Enum(student, super-admin) | System role |
| preferredLanguage | Enum(si, en) | UI language (si=Sinhala, en=English) |
| createdAt | DateTime | Account created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- User 1---* Horoscope (owner)
- User 1---* Metadata (creator)
- User 1---* Location (creator)

### Horoscope

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| owner | Object | `{ id: UUID }` — reference to User |
| name | String | Person's name |
| displayName | Boolean | Show/hide name in public |
| birthDate | Date | Date of birth |
| birthTime | Time | Time of birth |
| location | Object | `{ id: UUID }` — reference to Location (saved location selected by user) |
| locationName | String | Human-readable location name (display/cache from selected location) |
| latitude | Float | Latitude (auto-populated from saved location, user can override) |
| longitude | Float | Longitude (auto-populated from saved location, user can override) |
| gender | Enum(male, female, other) | Gender |
| ayanamsha | Enum(lahiri, raman, krishnamurti, yukteshwar) | Ayanamsha system (default: lahiri) |
| isPublic | Boolean | Visibility flag |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- Horoscope *---1 User (owner)
- Horoscope *---1 Location
- Horoscope 1---1 CalculatedDetails
- Horoscope 1---* Metadata
- Horoscope 1---* ShareLink
- Horoscope 1---* Chart

### CalculatedDetails

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| ascendant | String | Ascendant sign with degree |
| houses | JSON | House details — see [Houses](#houses) structure |
| planets | JSON | Planet positions with strengths/aspects — see [Planets](#planets) structure |
| nakshatra | JSON | Lunar Mansion / Nakshatra and Pada — see [Nakshatra](#nakshatra) structure |
| dashas | JSON | Mahadasha, Antardasha, Vidasa, Sukshama, and optional Prana sub-periods — see [Dashas](#dashas) structure |
| lord22ndDrekkana | String | Lord of 22nd Drekkana |
| lord64thNavamsa | String | Lord of 64th Navamsa |
| badhakaPlanet | String | Badhaka planet |
| marakaPlanets | JSON | Maraka planets — see [MarakaPlanets](#marakaplanets) structure |
| atmakaraka | String | Atmakaraka planet |
| yogas | JSON | Yoga formations — see [Yogas](#yogas) structure |
| doshas | JSON | Dosha calculations — see [Doshas](#doshas) structure |
| createdAt | DateTime | Record created |

**Relationships**:

- CalculatedDetails *---1 Horoscope

### Chart

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| type | Enum(birth, house, navamsa-d9, drekkana-d3, dasamsa-d10, shodasha-vargas, chandra-lagna, surya-lagna) | Chart type |
| data | JSON | Chart data (planet positions, houses, etc.) |
| imageUrl | String | Rendered chart image URL (optional) |
| createdAt | DateTime | Record created |

**Relationships**:

- Chart *---1 Horoscope

### Metadata

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| key | String | Label/tag name |
| value | String | Label/tag value |
| isPublic | Boolean | Visible to others |
| createdBy | Object | `{ id: UUID }` — reference to User |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- Metadata *---1 Horoscope
- Metadata *---1 User (creator)

### ShareLink

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| token | String | Unique share token |
| expiresAt | DateTime | Expiration time |
| createdAt | DateTime | Record created |

**Relationships**:

- ShareLink *---1 Horoscope

### SavedFilter

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user | Object | `{ id: UUID }` — reference to User |
| query | String | Search query text |
| filterConfig | JSON | Configured visible sections |
| createdAt | DateTime | Record created |

**Relationships**:

- SavedFilter *---1 User

### Location

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Place name (e.g., "Colombo, Sri Lanka") |
| latitude | Float | Latitude coordinate |
| longitude | Float | Longitude coordinate |
| isPublic | Boolean | Visibility flag — public locations visible to all, private only to creator |
| createdBy | Object | `{ id: UUID }` — reference to User (creator) |
| createdAt | DateTime | Record created |
| updatedAt | DateTime | Last updated |

**Relationships**:

- Location *---1 User (creator)
- Location 1---* Horoscope

### SearchEmbedding

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| horoscope | Object | `{ id: UUID }` — reference to Horoscope |
| embedding | Vector | Vector embedding for RAG search |
| textContent | Text | Full text content for search |
| createdAt | DateTime | Record created |

**Relationships**:

- SearchEmbedding *---1 Horoscope

## Enums

All enums use numeric values for easy i18n. Display names are mapped separately per language.

### Planet

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Sun | රවි |
| 2 | Moon | සඳු |
| 3 | Mars | කුජ |
| 4 | Mercury | බුධ |
| 5 | Jupiter | ගුරු |
| 6 | Venus | සිකුරු |
| 7 | Saturn | ශනි |
| 8 | Rahu | රාහු |
| 9 | Ketu | කේතු |

### Zodiac Sign

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Aries | මේෂ |
| 2 | Taurus | වෘෂභ |
| 3 | Gemini | මිථුන |
| 4 | Cancer | කටක |
| 5 | Leo | සිංහ |
| 6 | Virgo | කන්යා |
| 7 | Libra | තුලා |
| 8 | Scorpio | වෘශ්චික |
| 9 | Sagittarius | ධනු |
| 10 | Capricorn | මකර |
| 11 | Aquarius | කුම්භ |
| 12 | Pisces | මීන |

### Nakshatra

| Value | English | Sinhala |
|-------|---------|---------|
| 1 | Ashwini | අශ්විනි |
| 2 | Bharani | භරණී |
| 3 | Krittika | කෘත්තිකා |
| 4 | Rohini | රෝහිණී |
| 5 | Mrigashira | මෘගශීර්ෂ |
| 6 | Ardra | ආර්ද්රා |
| 7 | Punarvasu | පුනර්වසු |
| 8 | Pushya | පුෂ්ය |
| 9 | Ashlesha | ආශ්ලේෂා |
| 10 | Magha | මාඝ |
| 11 | Purva Phalguni | පූර්ව ඵල්ගුනී |
| 12 | Uttara Phalguni | උත්තර ඵල්ගුනී |
| 13 | Hasta | හස්ත |
| 14 | Chitra | චිත්රා |
| 15 | Swati | ස්වාති |
| 16 | Vishakha | විශාඛා |
| 17 | Anuradha | අනුරාධා |
| 18 | Jyeshtha | ජ්‍යෙෂ්ඨා |
| 19 | Mula | මූල |
| 20 | Purva Ashadha | පූර්ව ආෂාඪ |
| 21 | Uttara Ashadha | උත්තර ආෂාඪ |
| 22 | Shravana | ශ්‍රවණ |
| 23 | Dhanishta | ධනිෂ්ඨා |
| 24 | Shatabhisha | ශතභිෂා |
| 25 | Purva Bhadrapada | පූර්ව භාද්‍රපද |
| 26 | Uttara Bhadrapada | උත්තර භාද්‍රපද |
| 27 | Revati | රේවතී |

### Planetary Strength

| Value | Name | Description |
|-------|------|-------------|
| 1.25  | Athi Uchcha | අති උච්ච |
| 1 | Uchcha (Exaltation) | උච්ච |
| -1 | Neecha (Debilitation) | නීච |
| -1.25  | Athi Neecha (Debilitation) | අති නීච |
| 0.75 | මූලත්‍රිකෝණ ‍| මූල ත්‍රිකෝණ |
| 0.5 | Own Sign ‍| ස්වක්ෂේත්‍ර |
| 0.1 | Mitra (Friend) | මිත්‍ර |
| -0.1 | Shatru (Enemy) | සතුරු |
| 0 | Sama (Neutral) | සම |

### Aspect Type

| Value | Name |
|-------|------|
| 0 | Conjunction |
| 60 | Sextile |
| 90 | Square |
| 120 | Trine |
| 180 | Opposition |

## JSON Structures

### Houses

```json
[
  {
    "houseNumber": 1,
    "startDegree": 0.0,
    "middleDegree": 15.5,
    "endDegree": 30.0,
    "sign": 1,
    "lord": 3
  },
  {
    "houseNumber": 2,
    "startDegree": 30.0,
    "middleDegree": 45.0,
    "endDegree": 60.0,
    "sign": 2,
    "lord": 6
  }
]
```

### Planets

```json
[
  {
    "name": 1,
    "sign": 1,
    "degree": 12.5,
    "house": 1,
    "nakshatra": 1,
    "pada": 2,
    "retrograde": false,
    "combustion": false,
    "strength": 1,
    "absoluteDegree": 12.5,
    "aspects": [
      {
        "planetName": 4,
        "aspectType": 60,
        "planetAbsoluteDegree": 75.0,
        "degreeGap": 2.5,
        "exactAspectDegree": 60.0,
        "isBeneficial": true
      },
      {
        "planetName": 7,
        "aspectType": 180,
        "planetAbsoluteDegree": 192.5,
        "degreeGap": 0.0,
        "exactAspectDegree": 180.0,
        "isBeneficial": false
      }
    ]
  },
  {
    "name": 2,
    "sign": 4,
    "degree": 5.0,
    "house": 4,
    "nakshatra": 8,
    "pada": 1,
    "retrograde": false,
    "combustion": false,
    "strength": 0,
    "absoluteDegree": 95.0,
    "aspects": []
  }
]
```

**Note:** `degreeGap` = longitudinal distance between two planets minus the nearest major aspect angle (Conjunction 0°, Sextile 60°, Square 90°, Trine 120°, Opposition 180°). Maximum valid `degreeGap` is < 30° — beyond this, the aspect is not considered effective. In the example above, Sun (12.5°) to Mercury (75.0°) has a raw distance of 62.5°, and the nearest major aspect is Sextile (60°), so `degreeGap` = 2.5°.

### Nakshatra

```json
{
  "moonNakshatra": {
    "id": 8,
    "pada": 1,
    "lord": 7,
    "startDegree": 93.33,
    "endDegree": 106.66
  },
  "ascendantNakshatra": {
    "id": 1,
    "pada": 2,
    "lord": 9,
    "startDegree": 0.0,
    "endDegree": 13.33
  }
}
```

### Dashas

**Calculation note:** The first Mahadasha period uses the remaining portion of the Moon's Nakshatra (balance of dasha at birth). The starting planet and duration are determined by the Nakshatra lord and the degrees remaining in the Moon's Nakshatra at the time of birth.

```json
{
  "mahadasha": [
    {
      "planet": 1,
      "startDate": "1990-01-15",
      "endDate": "1996-01-15",
      "durationYears": 6,
      "remainingYearsAtBirth": 6.0,
      "antardasha": [
        {
          "planet": 2,
          "startDate": "1990-01-15",
          "endDate": "1990-10-10",
          "durationMonths": 9,
          "vidasa": [
            {
              "planet": 3,
              "startDate": "1990-01-15",
              "endDate": "1990-02-05",
              "durationDays": 21,
              "sukshama": [
                {
                  "planet": 4,
                  "startDate": "1990-01-15",
                  "endDate": "1990-01-18",
                  "durationDays": 3,
                  "prana": [
                    {
                      "planet": 5,
                      "startDate": "1990-01-15",
                      "endDate": "1990-01-16",
                      "durationHours": 12
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "planet": 3,
          "startDate": "1990-10-10",
          "endDate": "1991-07-05",
          "durationMonths": 9,
          "vidasa": [
            {
              "planet": 4,
              "startDate": "1990-10-10",
              "endDate": "1990-11-01",
              "durationDays": 22,
              "sukshama": []
            }
          ]
        }
      ]
    }
  ],
  "currentPeriod": {
    "mahadashaLord": 5,
    "antardashaLord": 6,
    "vidasaLord": 2,
    "sukshamaLord": 8,
    "pranaLord": 4
  }
}
```

**Period hierarchy:**

| Level | Name | Contained Within | Typical Duration |
|-------|------|-----------------|-----------------|
| 1 | Mahadasha | Root | Years |
| 2 | Antardasha | Mahadasha | Months |
| 3 | Vidasa | Antardasha | Days–Weeks |
| 4 | Sukshama | Vidasa | Days |
| 5 | Prana (optional) | Sukshama | Hours |

**Date range rules:**
- Every period at every level must have both `startDate` and `endDate` in ISO date (or ISO datetime for Prana) format
- For a given parent period, the first child period's `startDate` equals the parent's `startDate`
- The last child period's `endDate` equals the parent's `endDate`
- Child periods within the same parent must be contiguous (no gaps, no overlaps)
- Prana periods use `durationHours`; all other levels use the coarsest unit that fits (years for Mahadasha, months for Antardasha, days for Vidasa/Sukshama)

**Empty arrays:** If a period has no sub-periods calculated, the corresponding array MUST be present as an empty array `[]` (not omitted).

### MarakaPlanets

```json
[7, 6, 3]
```

### Yogas

```json
[
  {
    "name": "Parivartana Yoga",
    "description": "Mutual exchange between 1st and 5th lords",
    "planetsInvolved": [1, 5],
    "housesInvolved": [1, 5],
    "isBeneficial": true
  },
  {
    "name": "Dharma-karmadhipati Yoga",
    "description": "Lord of 1st and 9th in mutual aspect",
    "planetsInvolved": [3, 5],
    "housesInvolved": [1, 9],
    "isBeneficial": true
  }
]
```

### Doshas

```json
{
  "doshas": [
    {
      "name": "Manglik Dosha",
      "description": "Mars in 1st, 4th, 7th, 8th, or 12th house",
      "isPresent": true,
      "severity": "Medium",
      "affectingHouses": [1, 7],
      "planetsInvolved": [3]
    }
  ]
}
```

### Chart Data

```json
{
  "houses": [
    {
      "houseNumber": 1,
      "sign": 1,
      "startDegree": 340.0,
      "endDegree": 10.0,
      "planets": [
        {
          "name": 1,
          "degree": 12.5,
          "sign": 1,
          "retrograde": false
        }
      ],
      "lord": 3
    }
  ],
  "currentPlanets": [
    {
      "name": 1,
      "sign": 4,
      "degree": 95.0,
      "absoluteDegree": 95.0,
      "house": 4,
      "nakshatra": 8,
      "pada": 1,
      "retrograde": false,
      "combustion": false,
      "strength": 0
    },
    {
      "name": 7,
      "sign": 9,
      "degree": 200.0,
      "absoluteDegree": 200.0,
      "house": 7,
      "nakshatra": 19,
      "pada": 3,
      "retrograde": true,
      "combustion": false,
      "strength": -1
    }
  ],
  "ascendant": {
    "sign": 1,
    "degree": 5.0,
    "lord": 3,
    "nakshatra": 1
  },
  "lagna": 1,
  "chartType": "Rasi"
}
```

**Notes:**
- `currentPlanets` is an optional array at the top level, present only when the chart supports (and the user has toggled) current planetary position overlay
- Each current planet object uses the same numeric enum fields as birth planets (Planet enum for `name`, Zodiac Sign enum for `sign`, Planetary Strength enum for `strength`, Nakshatra enum for `nakshatra`)
- `house` is determined by which house the current planet falls into based on the birth chart's house cusps
- `currentPlanets` is computed server-side in real-time via ephemeris calculations — it is NOT stored in the database
- The House chart is the primary chart that supports this overlay; other chart types may be extended in the future

### FilterConfig (SavedFilter)

```json
{
  "visibleSections": {
    "birthChart": true,
    "houseChart": false,
    "navamsaD9": true,
    "drekkanaD3": false,
    "dasamsaD10": false,
    "shodashaVargas": false,
    "chandraLagna": false,
    "suryaLagna": false,
    "planetaryStrengths": true,
    "aspects": false,
    "yogas": true,
    "doshas": false,
    "currentPlanetPositions": false
  }
}
```

**Notes:**
- `currentPlanetPositions` controls whether current planetary positions are shown on the House chart when toggled on
- This preference is persisted per user in the SavedFilter config

## Entity Relationship Diagram

```
User (1) ---< (N) Horoscope
User (1) ---< (N) Metadata
User (1) ---< (N) SavedFilter
User (1) ---< (N) Location

Location (1) ---< (N) Horoscope

Horoscope (1) --- (1) CalculatedDetails
Horoscope (1) ---< (N) Chart
Horoscope (1) ---< (N) Metadata
Horoscope (1) ---< (N) ShareLink
Horoscope (1) ---< (N) SearchEmbedding
```
