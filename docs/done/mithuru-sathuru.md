# මිතුරු සතුරු 

- The planets table should have 5 columns as අධි මිතුරු, මිතුරු, සම, සතුරු, අධි සතුරු 
- නෛසර්ගික මිතුරු සතුරු අගයන් වෙනස් නොවන බැවින් එය code එකේම පෙර ගණනය කර තබා ගත යුතුයි. 
- තත්කාලීක මිතුරු සතුරු අගයන් කේන්දරය අනුව ගණනය කර සංයුක්ත මිතුරු සතුරු භාවය ගණනය කර පෙර columns වලට දැමිය යුතුයි. 

## How to calculate 

ඔබගේ ජ්‍යොතිෂ මෘදුකාංගයේ මෙය ස්වයංක්‍රීයව ගණනය කිරීමට **Graha Maitri (ග්‍රහ මෛත්‍රී) Calculation Engine** එකක් නිර්මාණය කිරීම සුදුසුයි.

BPHS හි ශ්ලෝක 55–58 අනුව මෙය කොටස් තුනකට වෙන් කර ක්‍රියාත්මක කළ හැකිය.

1. `NaturalRelationship` – නෛසර්ගික මිතුරු සතුරුභාවය.
2. `TemporaryRelationship` – තත්කාලික මිතුරු සතුරුභාවය.
3. `CompoundRelationship` – සංයුක්ත මිතුරු සතුරුභාවය.

මෙහිදී ගණනය සඳහා අවශ්‍ය වන්නේ ග්‍රහයන්ගේ රාශි පිහිටීම් පමණි. ග්‍රහයන්ගේ අංශක අවශ්‍ය නොවේ.

## **1. App එකට අවශ්‍ය Input Data**

සෑම ග්‍රහයකුගේම රාශි අංකය ලබා දෙන්න.

රාශි අංක:

| රාශිය   | අංකය |
| ------- | ---- |
| මේෂ     | 0    |
| වෘෂභ    | 1    |
| මිථුන   | 2    |
| කටක     | 3    |
| සිංහ    | 4    |
| කන්‍යා  | 5    |
| තුලා    | 6    |
| වෘශ්චික | 7    |
| ධනු     | 8    |
| මකර     | 9    |
| කුම්භ   | 10   |
| මීන     | 11   |

උදාහරණ Input:

```
const planetaryPositions = {
  SUN: 4,      // Leo
  MOON: 6,     // Libra
  MARS: 1,     // Taurus
  MERCURY: 5,  // Virgo
  JUPITER: 8,  // Sagittarius
  VENUS: 10,   // Aquarius
  SATURN: 9    // Capricorn
};
```

රාහු සහ කේතු සඳහාද පසුව මෙම ගණනය යෙදිය හැකි නමුත්, පළමු අදියරේදී සප්ත ග්‍රහයන් හත භාවිත කිරීම සුදුසුයි.

## **2. නෛසර්ගික මිතුරු සතුරුභාවය සඳහා Data**

මෙය ජන්ම කේන්ද්‍රය අනුව වෙනස් නොවේ. එබැවින් මෙය ස්ථිර Configuration එකක් ලෙස තබාගත හැකිය.

BPHS සම්ප්‍රදායික වර්ගීකරණය අනුව:

```
const naturalRelationships = {
  SUN: {
    friends: ["MOON", "MARS", "JUPITER"],
    enemies: ["VENUS", "SATURN"],
    neutral: ["MERCURY"]
  },

  MOON: {
    friends: ["SUN", "MERCURY"],
    enemies: [],
    neutral: ["MARS", "JUPITER", "VENUS", "SATURN"]
  },

  MARS: {
    friends: ["SUN", "MOON", "JUPITER"],
    enemies: ["MERCURY"],
    neutral: ["VENUS", "SATURN"]
  },

  MERCURY: {
    friends: ["SUN", "VENUS"],
    enemies: ["MOON"],
    neutral: ["MARS", "JUPITER", "SATURN"]
  },

  JUPITER: {
    friends: ["SUN", "MOON", "MARS"],
    enemies: ["MERCURY", "VENUS"],
    neutral: ["SATURN"]
  },

  VENUS: {
    friends: ["MERCURY", "SATURN"],
    enemies: ["SUN", "MOON"],
    neutral: ["MARS", "JUPITER"]
  },

  SATURN: {
    friends: ["MERCURY", "VENUS"],
    enemies: ["SUN", "MOON", "MARS"],
    neutral: ["JUPITER"]
  }
};
```

මෙය BPHS හි මූලත්‍රිකෝණ රාශි පදනම් කරගත් නීතියෙන් ලබාගත හැකි නෛසර්ගික සම්බන්ධතා වගුවයි.

## **3. තත්කාලික මිතුරු සතුරුභාවය ගණනය කිරීම**

ග්‍රහයන් දෙදෙනාගේ රාශි අංක ලබාගෙන ඒවා අතර රාශි දුර ගණනය කළ යුතුය.

```
function getTemporaryRelationship(signA, signB) {
  const distance = ((signB - signA + 12) % 12) + 1;

  const temporaryFriendHouses = [
    2, 3, 4, 10, 11, 12
  ];

  return temporaryFriendHouses.includes(distance)
    ? "FRIEND"
    : "ENEMY";
}
```

උදාහරණය:

- රවි සිටින්නේ සිංහ රාශියේ (4).
- ගුරු සිටින්නේ ධනු රාශියේ (8).

ගණනය:

\\[ Distance = ((8-4+12)\bmod 12)+1 \\]

\\[ Distance = 5 \\]

5 වැන්න තත්කාලික සතුරු ස්ථානයක් බැවින් රවි සහ ගුරු අතර තත්කාලික සම්බන්ධතාවය `ENEMY` වේ.

## **4. සංයුක්ත මිතුරු සතුරුභාවය ගණනය කිරීම**

දැන් නෛසර්ගික සහ තත්කාලික සම්බන්ධතා දෙක එකතු කළ යුතුය.

```
function getCompoundRelationship(natural, temporary) {

  if (natural === "FRIEND" && temporary === "FRIEND") {
    return "GREAT_FRIEND";
  }

  if (natural === "ENEMY" && temporary === "ENEMY") {
    return "GREAT_ENEMY";
  }

  if (natural === "NEUTRAL" && temporary === "NEUTRAL") {
    return "NEUTRAL";
  }

  if (
    (natural === "FRIEND" && temporary === "ENEMY") ||
    (natural === "ENEMY" && temporary === "FRIEND")
  ) {
    return "NEUTRAL";
  }

  if (
    natural === "NEUTRAL" && temporary === "FRIEND"
  ) {
    return "FRIEND";
  }

  if (
    natural === "FRIEND" && temporary === "NEUTRAL"
  ) {
    return "FRIEND";
  }

  if (
    natural === "NEUTRAL" && temporary === "ENEMY"
  ) {
    return "ENEMY";
  }

  if (
    natural === "ENEMY" && temporary === "NEUTRAL"
  ) {
    return "ENEMY";
  }

  throw new Error("Invalid relationship");
}
```

## **5. සම්පූර්ණ Calculation Function එක**

දැන් ඉහත සියල්ල එකතු කර ප්‍රධාන Function එක නිර්මාණය කරමු.

```
function getNaturalRelationship(planetA, planetB) {
  const relation = naturalRelationships[planetA];

  if (relation.friends.includes(planetB)) return "FRIEND";
  if (relation.enemies.includes(planetB)) return "ENEMY";
  return "NEUTRAL";
}

function getGrahaMaitri(planetA, planetB, positions) {
  const signA = positions[planetA];
  const signB = positions[planetB];

  const natural = getNaturalRelationship(planetA, planetB);

  const temporary = getTemporaryRelationship(
    signA,
    signB
  );

  const compound = getCompoundRelationship(
    natural,
    temporary
  );

  return {
    planetA,
    planetB,
    natural,
    temporary,
    compound
  };
}
```

භාවිත කරන ආකාරය:

```
const result = getGrahaMaitri(
  "SUN",
  "JUPITER",
  planetaryPositions
);

console.log(result);
```

ප්‍රතිඵලය:

```
{
  planetA: "SUN",
  planetB: "JUPITER",
  natural: "FRIEND",
  temporary: "ENEMY",
  compound: "NEUTRAL"
}
```

## **6. ග්‍රහයන් හත්දෙනාගේ සියලු සම්බන්ධතා ලබාගැනීම**

App එකේ සියලුම ග්‍රහයන් අතර සම්බන්ධතා ලබාගැනීමට:

```
function calculateAllGrahaMaitri(positions) {
  const planets = Object.keys(positions);

  const results = [];

  for (const planetA of planets) {
    for (const planetB of planets) {
      if (planetA === planetB) continue;

      results.push(
        getGrahaMaitri(
          planetA,
          planetB,
          positions
        )
      );
    }
  }

  return results;
}
```

මෙයින් ග්‍රහයන් හත්දෙනකු සඳහා සම්බන්ධතා 42ක් ලැබේ. (ග්‍රහයන් දෙදෙනකු අතර සම්බන්ධතාව දෙපසින්ම ගණනය වන නිසා.)

## **7. App එකේ ප්‍රතිඵල පෙන්විය යුතු ආකාරය**

මම නිර්දේශ කරන්නේ එක් එක් ග්‍රහයා තෝරාගත් විට අනෙක් ග්‍රහයන් සමඟ ඇති සම්බන්ධතාව පෙන්වන Table එකක් නිර්මාණය කිරීමයි.

උදාහරණයක් ලෙස රවි තෝරාගත් විට:

**රවි (SUN) – ග්‍රහ මෛත්‍රී**

මිතුරු ග්‍රහයන්

# **2**

චන්ද්‍ර, කුජ

සම ග්‍රහයන්

# **2**

බුධ, ගුරු

අධිමිතුරු

# **2**

චන්ද්‍ර, කුජ

අධිසතුරු

# **2**

සිකුරු, ශනි

| ග්‍රහයා | නෛසර්ගික | තත්කාලික | සංයුක්ත   |
| ------- | -------- | -------- | --------- |
| චන්ද්‍ර | මිතුරු   | මිතුරු   | අධිමිතුරු |
| කුජ     | මිතුරු   | මිතුරු   | අධිමිතුරු |
| බුධ     | සම       | මිතුරු   | මිතුරු    |
| ගුරු    | මිතුරු   | සතුරු    | සම        |
| සිකුරු  | සතුරු    | සතුරු    | අධිසතුරු  |
| ශනි     | සතුරු    | සතුරු    | අධිසතුරු  |

*මෙය ඉහත නිදර්ශන කේන්ද්‍රයේ රවි සඳහා වූ ප්‍රතිඵලයයි.*

## **8. වැදගත් Implementation කරුණු**

ඔබගේ Astrology App එකේ මෙය ක්‍රියාත්මක කරන විට පහත කරුණු සැලකිල්ලට ගන්න.

1. ගණනය සඳහා D1 රාශි කේන්ද්‍රයේ ග්‍රහ පිහිටීම් භාවිත කරන්න.
2. නෛසර්ගික සම්බන්ධතා ස්ථිර Configuration එකක් ලෙස තබන්න.
3. තත්කාලික සම්බන්ධතා එක් එක් ජන්ම කේන්ද්‍රය අනුව ගණනය කරන්න.
4. සංයුක්ත සම්බන්ධතා දෙකේ ප්‍රතිඵල එකතු කර ගණනය කරන්න.
5. රාහු සහ කේතු ඇතුළත් කිරීමේදී ඔබ භාවිත කරන ශාස්ත්‍රීය සම්ප්‍රදාය අනුව වෙනම නීති සකස් කරන්න.

**මගේ නිර්දේශය:** මෙම Module එක `Graha Maitri Engine` ලෙස වෙන් කරන්න. පසුව Shadbala, Graha Bala, Yoga Analysis සහ Planetary Strength Analysis වැනි කොටස් සඳහාද මෙහි ප්‍රතිඵල නැවත භාවිත කළ හැකිය.

සටහන: ඉහත JavaScript එකේ ස්ථිර නෛසර්ගික සම්බන්ධතා වගුව BPHS වර්ගීකරණයට අනුව යොදා ඇත. ඔබගේ අවසාන සංස්කරණයේ ශ්ලෝක පාඨය සමඟ එය සසඳා පරීක්ෂා කිරීමත් සුදුසුයි.