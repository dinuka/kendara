# හෝරා ලග්නය

- this should mark in the birth chart as HL. 

## How to calculate

BPHS හි 5 වන පරිච්ඡේදයේ 4–5 ශ්ලෝක අනුව හෝරා ලග්නය (Hora Lagna – HL) ගණනය කිරීමට JavaScript භාවිතයෙන් පහත සූත්‍රය යොදාගත හැකිය.

මෙහිදී ගණනය කරන්නේ හිරු උදාවේ සිට උපන් වේලාව දක්වා ගතවූ කාලය සහ හිරු උදාවන මොහොතේ සූර්යයාගේ නිරයන දේශාංශයයි.

### **1. ගණිතමය සූත්‍රය**

BPHS අනුව:

- ඝටිකා 1 = මිනිත්තු 24
- ඝටිකා 2½ = මිනිත්තු 60
- එබැවින් පැය 1කට එක් රාශියක් ගමන් කරයි.

ගණනය:

\\[ HL = SunLongitude\_{sunrise}+ \frac{ElapsedMinutes}{60}\times30^\circ \\]

අවසානයේ අංශක 360 සීමාව තුළට ගෙන ආ යුතුය.

\\[ HL = HL \bmod 360 \\]

## **2. JavaScript Implementation**

```

/**
 * Calculate Hora Lagna according to BPHS.
 *
 * @param {number} sunriseSunLongitude
 *   Sun's sidereal longitude at sunrise (0-360 degrees).
 *
 * @param {Date} sunrise
 *   Local sunrise date/time.
 *
 * @param {Date} birth
 *   Local birth date/time.
 *
 * @returns {object}
 */
function calculateHoraLagna(
  sunriseSunLongitude,
  sunrise,
  birth
) {
  const elapsedMs = birth.getTime() - sunrise.getTime();

  if (elapsedMs < 0) {
    throw new Error("Birth time must be after sunrise.");
  }

  const elapsedMinutes = elapsedMs / 60000;

  // One sign (30 degrees) per 60 minutes
  const horaDegrees = (elapsedMinutes / 60) * 30;

  // Add to sunrise Sun longitude
  const longitude =
    ((sunriseSunLongitude + horaDegrees) % 360 + 360) % 360;

  const signIndex = Math.floor(longitude / 30);
  const degreesInSign = longitude % 30;

  const degree = Math.floor(degreesInSign);
  const minuteFloat = (degreesInSign - degree) * 60;
  const minute = Math.floor(minuteFloat);
  const second = (minuteFloat - minute) * 60;

  const signs = [
    "Aries", "Taurus", "Gemini",
    "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius",
    "Capricorn", "Aquarius", "Pisces"
  ];

  return {
    longitude,
    sign: signs[signIndex],
    signIndex,
    degree,
    minute,
    second,
    elapsedMinutes
  };
}

```

## **3. උදාහරණයක්**

උපකල්පිත දත්ත:

| විස්තරය              | අගය          |
| -------------------- | ------------ |
| හිරු උදාව            | 06:00        |
| උපන් වේලාව           | 09:30        |
| හිරුගේ නිරයන දේශාංශය | 72°          |
| ගතවූ කාලය            | මිනිත්තු 210 |

ගණනය:

\\[ HL = 72^\circ + \frac{210}{60}\times30^\circ \\]

\\[ HL = 72^\circ+105^\circ \\]

\\[ HL=177^\circ \\]

ප්‍රතිඵලය

# **කන්‍යා 27° 00′ 00″**

Hora Lagna (177°)

## **4. වැදගත් Implementation කරුණු**

ඔබේ ජ්‍යොතිෂ ගණනය කිරීමේ පද්ධතියට මෙය එකතු කිරීමේදී කරුණු කිහිපයක් සැලකිල්ලට ගන්න.

1. `sunriseSunLongitude` අගය Lahiri Ayanamsa වැනි ඔබ භාවිත කරන අයනාංශය අනුව ගණනය කළ නිරයන සූර්ය දේශාංශය විය යුතුය.
2. හිරු උදාව උපන් ස්ථානයේ අක්ෂාංශය, දේශාංශය සහ වේලා කලාපය අනුව ගණනය කළ යුතුය.
3. JavaScript `Date` භාවිතයේදී වේලා කලාප ගැටලු ඇති නොවන ලෙස එකම absolute time representation එකක් භාවිත කරන්න.
4. උපත හිරු උදාවට පෙර නම්, පෙර දිනයේ හිරු උදාවෙන් ගතවූ කාලය ගණනය කළ යුතුය. ඉහත function එක එම අවස්ථාව සඳහා තවදුරටත් පුළුල් කළ යුතුය.

**විශේෂ සටහන:** මෙහි භාවිත කළේ BPHS හි සඳහන් සූර්ය දේශාංශය පදනම් කරගත් ක්‍රමයයි. නිවැරදි ග්‍රහ ගණනය සඳහා sunrise අවස්ථාවේ සූර්ය දේශාංශය සහ උපන් වේලාව අතර අන්තර්ගත කාලය නිවැරදිව ලබාගැනීම අත්‍යවශ්‍යය.