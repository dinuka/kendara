# පංච පක්ෂී

- Need to calculate the Pancha Pakshi
- It should show with the Nakshathra section after the thithi.

In the **Pancha Pakshi Shastra** (பஞ்சபட்சி சாஸ்திரம்), a person's governing bird (Pakshi) is determined primarily from the **Moon's Nakshatra** and whether the birth occurred during the **Shukla Paksha (waxing Moon)** or **Krishna Paksha (waning Moon)**. The **Tithi** is used only to determine whether the Moon is waxing or waning—it is not directly mapped to a bird.

The calculation consists of two steps:

### Step 1: Calculate the Moon's Nakshatra

Determine the Moon's sidereal longitude at birth.

Each Nakshatra spans **13°20' (13.333333°)**.

```
Nakshatra Number = floor(Moon Longitude / 13°20') + 1
```

Example:

- Moon = 48°15'
- 48.25 ÷ 13.3333 = 3.618
- floor = 3
- Nakshatra = 4 = Rohini

---

### Step 2: Determine the Moon Paksha from the Tithi

The Tithi tells you whether the Moon is waxing or waning.

#### Shukla Paksha (Waxing)

Tithi 1–15

- Pratipada
- Dwitiya
- Tritiya
- ...
- Purnima

#### Krishna Paksha (Waning)

Tithi 16–30

(or Krishna Pratipada through Amavasya)

So if:

- Tithi = 8 → Shukla Paksha
- Tithi = 23 → Krishna Paksha

---

## Step 3: Find the Bird

The Nakshatras are divided into five groups.

### During Shukla Paksha

| Bird    | Nakshatras                                                          |
| ------- | ------------------------------------------------------------------- |
| Vulture | Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra               |
| Owl     | Punarvasu, Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni |
| Crow    | Hasta, Chitra, Swati, Vishakha, Anuradha                            |
| Cock    | Jyeshtha, Mula, Purva Ashadha, Uttara Ashadha, Shravana             |
| Peacock | Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati |

---

### During Krishna Paksha

The birds rotate.

| Bird    | Nakshatras                                                          |
| ------- | ------------------------------------------------------------------- |
| Peacock | Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra               |
| Cock    | Punarvasu, Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni |
| Crow    | Hasta, Chitra, Swati, Vishakha, Anuradha                            |
| Owl     | Jyeshtha, Mula, Purva Ashadha, Uttara Ashadha, Shravana             |
| Vulture | Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati |

Notice that the **Crow group remains the same**, while the other four groups rotate between the two Pakshas.

---

## Example

Suppose:

- Moon Nakshatra = Rohini
- Tithi = Shukla Navami

Rohini belongs to the first group.

Since the Moon is in **Shukla Paksha**, the governing bird is:

**Vulture**

---

Another example:

- Moon Nakshatra = Rohini
- Tithi = Krishna Panchami

Same Nakshatra group, but Krishna Paksha.

The governing bird becomes:

**Peacock**

---

## After determining the bird

Once the Pakshi (bird) is known, Pancha Pakshi Shastra then uses:

- Weekday
- Day or Night birth
- Sunrise time
- Time within the day/night
- Five bird activities (Ruling, Eating, Walking, Sleeping, Dying)

to determine the bird's activity at the moment of birth or at any desired time.

This second stage is much more detailed and is what is used for electional astrology (muhurta) and timing predictions.

If you're implementing this in software, I can also provide the complete algorithm (including the weekday, day/night, and activity calculations) in a form suitable for coding.
