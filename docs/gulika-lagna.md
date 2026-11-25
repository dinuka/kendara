# ගුලික ලග්නය 

- Should show in the birth chart as GL. 
- Should show in the houses table in the other column with its degree. as ග්‍රලික ලග්නය (12° 35′ 20″)

## How to calculate

ඔබගේ ජ්‍යොතිෂ ඇප් එකට **Gulika Lagna (ගුලික ලග්නය)** එකතු කිරීමේදී, එය සාමාන්‍ය ලග්නයක් ගණනය කරන ආකාරයටම ගණනය කළ හැකි නමුත්, වෙනස වන්නේ ගණනය සඳහා භාවිත කරන වේලාවයි.

BPHS හි ශ්ලෝක 66–70 අනුව ගණනය කිරීමේදී ප්‍රධාන වශයෙන් කරුණු තුනක් අවශ්‍ය වේ.

1. උපන් ස්ථානයේ හිරු උදාව සහ හිරු බැසීම.
2. උපන් දිනයට අදාළ ගුලික කාලය.
3. ගුලික කාලය ආරම්භ වන මොහොතේ උදාවන ලග්නය.

**මෙහිදී භාවිත කළ යුත්තේ ගුලික කාලයේ ආරම්භක වේලාවයි.** එම වේලාවට Ascendant ගණනය කිරීමෙන් Gulika Lagna ලබාගත හැකිය.

## **1. ගණනය කිරීමේ මූලික ක්‍රමය**

### **පියවර 1 – දිවා ද රාත්‍රී ද යන්න හඳුනාගැනීම**

ජන්ම වේලාව අනුව ගණනය කළ යුත්තේ:

- හිරු උදාවෙන් පසු සහ හිරු බැසීමට පෙර නම් – දිවා කාලය.
- හිරු බැසීමෙන් පසු සහ ඊළඟ හිරු උදාවට පෙර නම් – රාත්‍රී කාලය.

රාත්‍රී කාලයේදී මධ්‍යම රාත්‍රිය පසු වූ විටත් එම රාත්‍රිය ආරම්භ වූ සතියේ දිනයම භාවිත කළ යුතුය.

### **පියවර 2 – ගුලික කාලය සොයාගැනීම**

ග්‍රහ අනුපිළිවෙළ:

```
const GRAHA_ORDER = [
  "SATURN",
  "JUPITER",
  "MARS",
  "SUN",
  "VENUS",
  "MERCURY",
  "MOON"
];
```

සතියේ දින අධිපතීන්:

```
const WEEKDAY_LORDS = {
  0: "SUN",     // Sunday
  1: "MOON",    // Monday
  2: "MARS",    // Tuesday
  3: "MERCURY", // Wednesday
  4: "JUPITER", // Thursday
  5: "VENUS",   // Friday
  6: "SATURN"   // Saturday
};
```

දිවා කාලයේදී දිනයේ අධිපතියාගෙන් ආරම්භ කරන්න.

රාත්‍රී කාලයේදී දිනයේ අධිපතියාගෙන් පස්වැන්නාගෙන් ආරම්භ කරන්න (අධිපතියා පළමුවැන්නා ලෙස ගණන් කර).

### **පියවර 3 – ගුලික කාලය ගණනය කිරීම**

```
function getGulikaStartTime({
  sunrise,
  sunset,
  nextSunrise,
  weekday,
  isNight
}) {
  const grahaOrder = [
    "SATURN",
    "JUPITER",
    "MARS",
    "SUN",
    "VENUS",
    "MERCURY",
    "MOON"
  ];

  const weekdayLords = [
    "SUN",
    "MOON",
    "MARS",
    "MERCURY",
    "JUPITER",
    "VENUS",
    "SATURN"
  ];

  const dayLord = weekdayLords[weekday];

  // දිවා කාලයේ ආරම්භක ග්‍රහයා
  let startIndex = grahaOrder.indexOf(dayLord);

  // රාත්‍රියේදී පස්වැන්නා ලබාගැනීම
  if (isNight) {
    startIndex = (startIndex + 4) % 7;
  }

  // ගුලික කාලය සොයාගැනීම
  const startPlanet = grahaOrder[startIndex];

  const gulikaIndex = grahaOrder.indexOf("SATURN");

  const slotIndex =
    (gulikaIndex - startIndex + 7) % 7;

  const periodStart = isNight
    ? sunset
    : sunrise;

  const periodEnd = isNight
    ? nextSunrise
    : sunset;

  const totalDuration =
    periodEnd.getTime() - periodStart.getTime();

  const segmentDuration = totalDuration / 8;

  const gulikaStart = new Date(
    periodStart.getTime() +
    slotIndex * segmentDuration
  );

  return {
    startPlanet,
    slotIndex,
    segmentDuration,
    gulikaStart,
    gulikaEnd: new Date(
      gulikaStart.getTime() + segmentDuration
    )
  };
}
```

මෙම function එකට sunrise, sunset, nextSunrise සහ අදාළ රාත්‍රිය ආරම්භ වූ දිනයේ weekday එක ලබාදිය යුතුය.

## **2. පියවර 4 – Gulika Lagna ගණනය කිරීම**

දැන් ලැබුණු `gulikaStart` වේලාව භාවිත කර සාමාන්‍ය ලග්නය ගණනය කරන ඔබගේ පවතින astronomical calculation function එක නැවත භාවිත කළ හැකිය.

උදාහරණයක්:

```
const gulika = getGulikaStartTime({
  sunrise: new Date("2026-11-23T06:00:00+05:30"),
  sunset: new Date("2026-11-23T18:00:00+05:30"),
  nextSunrise: new Date("2026-11-24T06:00:00+05:30"),
  weekday: 1, // Monday
  isNight: false
});

// ඔබගේ දැනට පවතින Ascendant calculation function එක
const gulikaAscendant = calculateAscendant({
  dateTime: gulika.gulikaStart,
  latitude: 6.0535,
  longitude: 80.2210
});

console.log(gulika);
console.log(gulikaAscendant);
```

මෙහි `calculateAscendant()` යනු ඔබගේ ඇප් එකේ දැනට තිබෙන ලග්න ගණනය කිරීමේ function එක ලෙස සලකන්න. එයට නිවැරදි Julian Day, sidereal time සහ Lahiri ayanamsa ආදී ඔබගේ සාමාන්‍ය ලග්න ගණනයේම සැකසුම් යෙදිය යුතුය.

## **3. ඇප් එකෙන් ලබාදිය යුතු ප්‍රතිඵලය**

Gulika Lagna සඳහා පහත ආකාරයේ output එකක් ලබාදීම සුදුසුයි.

**Gulika Details**

Gulika Period Start

**07:30 AM**

Gulika Period End

**09:00 AM**

Gulika Planet

**Saturn**

Duration

**90 Minutes**

**Gulika Lagna**

# **කන්‍යා (Virgo)**

උදාහරණයක් පමණි – සැබෑ රාශිය ගණනය කළ යුතුය.

| අංගය      | අගය          |
| --------- | ------------ |
| Sign      | Virgo        |
| Degree    | 12° 35′ 20″  |
| Longitude | 162° 35′ 20″ |

## **4. ඔබගේ ඇප් එකේ Calculation Architecture**

මම නිර්දේශ කරන්නේ මෙම ගණනයන් වෙන වෙනම functions ලෙස තබාගැනීමයි.

```
Gulika Calculation
       |
       ├── Get Sunrise / Sunset
       |
       ├── Determine Day / Night
       |
       ├── Get Weekday Lord
       |
       ├── Calculate 8 Time Segments
       |
       ├── Find Saturn's Segment
       |
       ├── Get Gulika Start Time
       |
       └── Calculate Ascendant
                 |
                 └── Gulika Lagna
```

**විශේෂයෙන් වැදගත් කරුණක්:** Gulika Lagna සහ Gulika longitude එක දෙකක් ලෙස ඔබගේ ඇප් එකේ තබාගන්න. Gulika Lagna යනු ගුලික කාලයේ ආරම්භයේ උදාවන ලග්නයයි. Gulika longitude යනු එම මොහොතට අදාළ උපග්‍රහ පිහිටීම ගණනය කිරීමයි.

මේ දෙකම වෙන වෙනම ගණනය කර Chart එකට ඇතුළත් කළ හැකිය.