# නිශේක කේන්ද්‍රය 

- Should draw a new chart for this. 
- It should same as the Navansaka chart. 

## How to calculate it. 

# **BPHS ශ්ලෝක 27–29 අනුව නිෂේක ලග්නය ගණනය කිරීම – App Implementation**

ඔබගේ Astrology App එකට මෙය ක්‍රියාත්මක කිරීමේදී **ජන්ම කේන්දරය → නිෂේකයට පෙර කාල පරතරය → නිෂේක දිනය හා වේලාව → නිෂේක ලග්නය** යන පියවර හතර භාවිත කරන්න.

මෙහිදී වැදගත් නිවැරදි කිරීමක් තිබෙනවා: BPHS හි සඳහන් අදෘශ්‍ය අර්ධය යනු ලග්න කුණ්ඩලියේ 2–6 හෝ 12 වැනි භාව පමණක් නොවේ. එය නැගෙනහිර ක්ෂිතිජයේ ලග්න ලක්ෂ්‍යයේ සිට බටහිර ක්ෂිතිජයේ සප්තම ලක්ෂ්‍යය දක්වා, ක්ෂිතිජයට පහළින් ඇති අර්ධයයි.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.siva.sh\&sz=32)

siva.sh+1



## **1. අවශ්‍ය Input දත්ත**

| Input                | විස්තරය                 |
| -------------------- | ----------------------- |
| Birth DateTime       | උපන් දිනය හා වේලාව      |
| Birth Latitude       | උපන් ස්ථානයේ අක්ෂාංශ    |
| Birth Longitude      | උපන් ස්ථානයේ දේශාංශ     |
| Lagna Cusp           | ලග්න භාව මධ්‍ය දේශාංශය  |
| 9th House Cusp       | නවම භාව මධ්‍ය දේශාංශය   |
| 7th House Cusp       | සප්තම භාව මධ්‍ය දේශාංශය |
| Saturn Longitude     | ශනිගේ දේශාංශය           |
| Mandi Longitude      | මන්දිගේ දේශාංශය         |
| Lagna Lord Longitude | ලග්නාධිපතියාගේ දේශාංශය  |
| Moon Longitude       | සඳුගේ දේශාංශය           |

**සැලකිල්ල:** භාව මධ්‍ය ලබාගැනීමට Sripati Bhava ක්‍රමය භාවිත කරන්න. සියලු ග්‍රහ දේශාංශ එකම Ayanamsa සහ එකම Zodiac පද්ධතියකින් ලබාගත යුතුයි.

## **2. පියවර 1 – ශනි සහ මන්දි අතර දුර (A)**

ශනි සහ මන්දිගේ දේශාංශ අතර කෝණික අන්තරය ගණනය කරන්න.

\\[ A = |Saturn-Mandi| \\]

මෙය රාශි, අංශක සහ කලා ලෙස තබාගන්න.

## **3. පියවර 2 – ලග්නය සහ නවම භාවය අතර දුර (B)**

\\[ B = (NinthCusp-LagnaCusp)\mod360 \\]

මෙය රාශි චක්‍රයේ ඉදිරි දිශාවට ගණනය කරන්න.

## **4. පියවර 3 – මූලික නිෂේක ප්‍රමාණය (X)**

\\[ X=A+B \\]

මෙය රාශි, අංශක සහ කලා ලෙස පරිවර්තනය කරන්න.

කාලයට පරිවර්තනය කිරීමේදී:

| කෝණික ප්‍රමාණය | කාල ප්‍රමාණය |
| -------------- | ------------ |
| රාශි 1         | මාස 1        |
| අංශක 1         | දින 1        |
| කලා 1 (1′)     | මිනිත්තු 24  |

උදාහරණයක්:

\\[ X=8\text{ රාශි }13^\circ30' \\]

එවිට කාලය:

- මාස 8
- දින 13
- පැය 12

## **5. පියවර 4 – ලග්නාධිපතියා අදෘශ්‍ය අර්ධයේදැයි පරීක්ෂා කිරීම**

මෙය ශ්ලෝකය 28 හි විශේෂ කොන්දේසියයි.

ගණනය:

\\[ D=(LagnaLordLongitude-LagnaCusp)\mod360 \\]

- \\(0 < D < 180^\circ\\) නම් අදෘශ්‍ය අර්ධය.
- \\(180^\circ < D < 360^\circ\\) නම් දෘශ්‍ය අර්ධය.

හරියටම ක්ෂිතිජ සීමාවේ පිහිටීමක් තිබේ නම් එය වෙනම සලකුණු කරන්න.

### **අදෘශ්‍ය අර්ධයේ නම් සඳුගේ අංශක එකතු කිරීම**

සඳුගේ දේශාංශය තුළ එය පිහිටි රාශියේ ගමන් කර ඇති ප්‍රමාණය ගන්න.

\\[ C=MoonLongitude\mod30^\circ \\]

ඉන්පසු:

\\[ X=A+B+C \\]

ලග්නාධිපතියා දෘශ්‍ය අර්ධයේ නම්:

\\[ X=A+B \\]

මෙහි \\(C\\) එකතු කරන්නේ අදෘශ්‍ය අර්ධයේ සිටින විට පමණයි.

## **6. පියවර 5 – නිෂේක දිනය හා වේලාව සෙවීම**

ලැබුණු \\(X\\) කාලයට පරිවර්තනය කරන්න.

ඉන්පසු:

\\[ NishekaDateTime=BirthDateTime-X \\]

මෙහිදී මාස අඩු කිරීම සඳහා දින 30ක් යොදාගෙන සරලව අඩු නොකර, Calendar Month ක්‍රමය භාවිත කරන්න.

උදාහරණයක්:

| විස්තරය      | අගය                   |
| ------------ | --------------------- |
| උපන් දිනය    | 2026-11-25            |
| උපන් වේලාව   | 06:00                 |
| ගණනය කළ කාලය | මාස 8, දින 13, පැය 12 |
| නිෂේක දිනය   | 2026-03-11            |
| නිෂේක වේලාව  | 18:00                 |

මෙය කාලය අඩු කිරීමේ උදාහරණයක් පමණයි.

## **7. පියවර 6 – නිෂේක ලග්නය ගණනය කිරීම**

නිෂේක දිනය හා වේලාව ලැබුණු පසු:

1. නිෂේක දිනය හා වේලාව ලබාගන්න.
2. උපන් ස්ථානයේ අක්ෂාංශ හා දේශාංශ භාවිත කරන්න.
3. එම වේලාවට අදාළ Sidereal Time ගණනය කරන්න.
4. තෝරාගත් Ayanamsa අනුව Sidereal Ascendant සොයන්න.
5. එය නිෂේක ලග්නය ලෙස ලබාගන්න.

මෙහිදී නිෂේක ලග්නය යනු ජීව විද්‍යාත්මකව සංසේචනය සිදු වූ මොහොතේ ලග්නය නොව, BPHS හි භාවිත වන නිෂේක/ලිංගික සංසර්ගයට අදාළ ලග්නයයි.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.horasad.com\&sz=32)

horasad.com+1



## **8. JavaScript Implementation**

පහත Code එක මෙම ගණනයේ ප්‍රධාන කොටස App එකට ඇතුළත් කිරීමට භාවිත කළ හැකියි.

```

const normalize = (deg) => ((deg % 360) + 360) % 360;

// Angular distance between Saturn and Mandi
function angularDistance(a, b) {
  const diff = normalize(a - b);
  return Math.min(diff, 360 - diff);
}

// Forward zodiacal distance
function forwardDistance(from, to) {
  return normalize(to - from);
}

// Check whether Lagna lord is below the horizon
function isInvisibleHemisphere(
  planetLongitude,
  ascendantCusp,
  descendantCusp
) {
  const planetArc = forwardDistance(
    ascendantCusp,
    planetLongitude
  );

  const invisibleArc = forwardDistance(
    ascendantCusp,
    descendantCusp
  );

  if (
    Math.abs(planetArc) < 1e-8 ||
    Math.abs(planetArc - invisibleArc) < 1e-8
  ) {
    return null; // Exactly on horizon
  }

  return planetArc < invisibleArc;
}

// Convert angular quantity into elapsed time
function angleToTime(totalDegrees) {
  let remaining = totalDegrees;

  const months = Math.floor(remaining / 30);
  remaining -= months * 30;

  const days = Math.floor(remaining);
  remaining -= days;

  // 1 degree = 1 day
  // 1 arcminute = 24 minutes
  const totalSeconds = remaining * 86400;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return {
    months,
    days,
    hours,
    minutes,
    seconds
  };
}

// Subtract calendar months, preserving time
function subtractMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);

  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDay));

  return result;
}

// Main Nisheka calculation
function calculateNisheka(input) {
  const {
    birthDateTime,
    ascendantCusp,
    descendantCusp,
    ninthHouseCusp,
    saturnLongitude,
    mandiLongitude,
    lagnaLordLongitude,
    moonLongitude
  } = input;

  // Step 1: Saturn - Mandi
  const A = angularDistance(
    saturnLongitude,
    mandiLongitude
  );

  // Step 2: Lagna - Ninth house
  const B = forwardDistance(
    ascendantCusp,
    ninthHouseCusp
  );

  // Step 3: Base quantity
  let X = A + B;

  // Step 4: Invisible hemisphere correction
  const invisible = isInvisibleHemisphere(
    lagnaLordLongitude,
    ascendantCusp,
    descendantCusp
  );

  if (invisible === null) {
    throw new Error(
      "Lagna lord is exactly on the horizon."
    );
  }

  let C = 0;

  if (invisible) {
    C = normalize(moonLongitude) % 30;
    X += C;
  }

  // Step 5: Convert angle into elapsed time
  const elapsed = angleToTime(X);

  // Step 6: Calculate Nisheka datetime
  let nishekaDate = new Date(birthDateTime);

  nishekaDate = subtractMonths(
    nishekaDate,
    elapsed.months
  );

  nishekaDate.setUTCDate(
    nishekaDate.getUTCDate() - elapsed.days
  );

  nishekaDate.setTime(
    nishekaDate.getTime()
    - elapsed.hours * 3600000
    - elapsed.minutes * 60000
    - elapsed.seconds * 1000
  );

  return {
    saturnMandiDistance: A,
    lagnaNinthDistance: B,
    moonCorrection: C,
    invisibleHemisphere: invisible,
    totalAngle: X,
    elapsedTime: elapsed,
    nishekaDateTime: nishekaDate.toISOString()
  };
}

```

සටහන: මෙහි Saturn–Mandi අන්තරය කෙටි කෝණික දුර ලෙස ගෙන ඇත. ඔබ භාවිත කරන R. Santhanam සංස්කරණයේ උදාහරණය සමඟ එම අන්තරයේ දිශා නියමය තහවුරු කර production implementation එක ස්ථිර කරන්න. DateTime උදාහරණය UTC ලෙස ක්‍රියා කරයි; ඔබගේ App එකේ ස්ථානීය වේලා කලාපය නිවැරදිව පරිවර්තනය කළ යුතුයි.

## **9. අවසාන Output Structure**

ඔබගේ App එකෙන් පහත ආකාරයට ප්‍රතිඵල ලබාදීම සුදුසුයි.

```
{
  "calculation": "NISHEKA",
  "saturnMandiDistance": 0,
  "lagnaNinthDistance": 0,
  "moonCorrection": 0,
  "invisibleHemisphere": true,
  "totalAngle": 0,
  "elapsedTime": {
    "months": 0,
    "days": 0,
    "hours": 0,
    "minutes": 0
  },
  "nishekaDateTime": "ISO_DATETIME",
  "nishekaAscendant": {
    "sign": null,
    "degree": null
  }
}
```

## **10. BPHS අනුව අවසාන පරීක්ෂාව**

නිෂේක ලග්නය ලබාගත් පසු ශ්ලෝකය 29–30 අනුව:

- නිෂේක ලග්නය සහ එහි අධිපතියා පරීක්ෂා කිරීම.
- තනු භාවය හා එයට ඇති ග්‍රහ බලපෑම් පරීක්ෂා කිරීම.
- ගර්භස්ථ දරුවාගේ සුබාසුබ ඵල ජ්‍යොතිෂ සම්ප්‍රදාය අනුව විමසීම.
- දෙමාපියන්ගේ ආයුෂ සම්බන්ධ පාරම්පරික පලාඵල පරීක්ෂා කිරීම.

**වැදගත් මූලාශ්‍රය:** [BPHS Chapter 4, Slokas 26–30 – Sanskrit and English](https://www.siva.sh/brihat-parashara-hora-shastra/4/26-30?utm_source=chatgpt.com).

මෙම ක්‍රමය App එකට ඇතුළත් කරන විට ගණනයේ සෑම අතරමැදි අගයක්ම සුරකින්න. එවිට R. Santhanam සංස්කරණයේ උදාහරණ සමඟ ප්‍රතිඵල පරීක්ෂා කිරීමත්, වෙනත් සංස්කරණවල සූත්‍ර වෙනස්කම් හඳුනාගැනීමත් පහසු වේ.