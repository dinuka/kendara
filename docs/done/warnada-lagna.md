# වර්ණද ලග්නය 

- this should mark as VL in the birth chart. 

## How to calculate this. 

හෝරා ලග්නය (Hora Lagna) දැනටමත් ගණනය කර තිබේ නම්, **වර්ණද ලග්නය (Varnada Lagna) ගණනය කිරීමට අවශ්‍ය වන්නේ ජන්ම ලග්නයේ රාශිය සහ හෝරා ලග්නයේ රාශිය පමණි.**

මෙය BPHS 5 වන පරිච්ඡේදයේ 10–13½ ශ්ලෝකවල සඳහන් ක්‍රමයයි.

## **1. ගණනය කිරීමේ පියවර**

### **පියවර 1 – ජන්ම ලග්නය සඳහා ගණන ලබාගැනීම**

- ජන්ම ලග්නය ඔත්තේ රාශියක් නම් මේෂයේ සිට ඉදිරියට ගණන් කරන්න.
- ජන්ම ලග්නය ඉරට්ටේ රාශියක් නම් මීනයේ සිට පසුපසට ගණන් කරන්න.

### **පියවර 2 – හෝරා ලග්නය සඳහා ගණන ලබාගැනීම**

- හෝරා ලග්නය ඔත්තේ රාශියක් නම් මේෂයේ සිට ඉදිරියට ගණන් කරන්න.
- හෝරා ලග්නය ඉරට්ටේ රාශියක් නම් මීනයේ සිට පසුපසට ගණන් කරන්න.

පහත වගුවෙන් එම ගණන් දෙක පහසුවෙන් ලබාගත හැකිය.

| රාශිය   | රාශි අංකය | ගණන් කිරීමේ අගය |
| ------- | --------- | --------------- |
| මේෂ     | 1         | 1               |
| වෘෂභ    | 2         | 11              |
| මිථුන   | 3         | 3               |
| කටක     | 4         | 9               |
| සිංහ    | 5         | 5               |
| කන්‍යා  | 6         | 7               |
| තුලා    | 7         | 7               |
| වෘශ්චික | 8         | 5               |
| ධනු     | 9         | 9               |
| මකර     | 10        | 3               |
| කුම්භ   | 11        | 11              |
| මීන     | 12        | 1               |

### **පියවර 3 – ගණන් දෙක එකතු කිරීම හෝ අඩු කිරීම**

ලබාගත් අගයන් දෙක:

- ජන්ම ලග්නය සහ හෝරා ලග්නය **රාශි** දෙකම ඔත්තේ හෝ දෙකම ඉරට්ටේ නම් එකතු කරන්න.
- එක් රාශියක් ඔත්තේ සහ අනෙක ඉරට්ටේ නම් විශාල අගයෙන් කුඩා අගය අඩු කරන්න.

(මෙහි ඔත්තේ/ඉරට්ටේ බලන්නේ රාශි අංකයේය, ගණන් කිරීමේ අගයේ නොවේ — ගණන් කිරීමේ අගයන් සැමවිටම ඔත්තේ වේ.)

### **පියවර 4 – අවසාන වර්ණද රාශිය ලබාගැනීම**

ගණන් කරන දිශාව තීරණය කරන්නේ **ජන්ම ලග්නයයි**.

- ජන්ම ලග්නය ඔත්තේ රාශියක් නම් මේෂයේ සිට ඉදිරියට ගණන් කරන්න.
- ජන්ම ලග්නය ඉරට්ටේ රාශියක් නම් මීනයේ සිට පසුපසට ගණන් කරන්න.
- ගණන් කිරීම ආරම්භක රාශියද 1 ලෙස ගෙන සිදු කෙරේ. අවසාන අගය 0 නම් (සමාන ගණන් අඩු කළ විට) ආරම්භක රාශියම (මේෂ / මීන) වර්ණද ලග්නය වේ.

**සටහන:** අවසාන අගය සැමවිටම ඉරට්ටේ වේ (ඔත්තේ ගණන් දෙකක එකතුව හෝ අන්තරය), එබැවින් එහි ඔත්තේ/ඉරට්ටේ ස්වභාවයෙන් දිශාව තීරණය කළ නොහැක.

## **2. JavaScript Code**

පහත Function එකට ජන්ම ලග්නයේ රාශි අංකය සහ දැනටමත් ගණනය කර ඇති හෝරා ලග්නයේ රාශි අංකය ලබාදිය හැකිය.

රාශි අංක භාවිතය:

- මේෂ = 1
- වෘෂභ = 2
- මිථුන = 3
- කටක = 4
- සිංහ = 5
- කන්‍යා = 6
- තුලා = 7
- වෘශ්චික = 8
- ධනු = 9
- මකර = 10
- කුම්භ = 11
- මීන = 12

```

const RASHIS = [
  "මේෂ",
  "වෘෂභ",
  "මිථුන",
  "කටක",
  "සිංහ",
  "කන්‍යා",
  "තුලා",
  "වෘශ්චික",
  "ධනු",
  "මකර",
  "කුම්භ",
  "මීන"
];

/**
 * Calculate Varnada Lagna according to BPHS 5.10–13½
 *
 * @param {number} natalLagna - Natal Lagna sign (1-12)
 * @param {number} horaLagna - Hora Lagna sign (1-12)
 * @returns {object} Varnada calculation details
 */
function calculateVarnadaLagna(natalLagna, horaLagna) {

  // Validate input
  if (
    !Number.isInteger(natalLagna) ||
    !Number.isInteger(horaLagna) ||
    natalLagna < 1 || natalLagna > 12 ||
    horaLagna < 1 || horaLagna > 12
  ) {
    throw new Error("Lagna values must be integers between 1 and 12");
  }

  // Step 1 & 2: Calculate directional counts
  // Odd sign: Count from Aries forward
  // Even sign: Count from Pisces backward

  const getCount = (sign) => {
    return sign % 2 === 1
      ? sign
      : 13 - sign;
  };

  const natalCount = getCount(natalLagna);
  const horaCount = getCount(horaLagna);

  // Step 3: Add or subtract based on parity
  const sameParity =
    natalLagna % 2 === horaLagna % 2;

  const finalCount = sameParity
    ? natalCount + horaCount
    : Math.abs(natalCount - horaCount);

  // Step 4: Natal Lagna sets the direction
  // Odd lagna: Aries forward
  // Even lagna: Pisces backward
  // Inclusive counting; 0 stays on the starting sign

  const forward = natalLagna % 2 === 1;
  const steps = Math.max(finalCount, 1) - 1;
  const varnadaIndex = forward
    ? steps % 12
    : 11 - (steps % 12);

  const varnadaLagna = varnadaIndex + 1;

  return {
    natalLagna,
    horaLagna,
    natalCount,
    horaCount,
    operation: sameParity ? "ADD" : "SUBTRACT",
    finalCount,
    direction: forward
      ? "FORWARD_FROM_ARIES"
      : "BACKWARD_FROM_PISCES",
    varnadaLagna,
    varnadaName: RASHIS[varnadaIndex]
  };
}

// Example
const result = calculateVarnadaLagna(10, 7);

console.log(result);

```

## **3. උදාහරණයක් මඟින් Code එක පරීක්ෂා කිරීම**

උදාහරණය:

- ජන්ම ලග්නය = මකර (10) — ඉරට්ටේ
- හෝරා ලග්නය = තුලා (7) — ඔත්තේ

**ගණනය කිරීමේ ප්‍රතිඵලය**

| පියවර         | අගය              |
| ------------- | ---------------- |
| ජන්ම ලග්න ගණන | 3 (මීන → මකර)    |
| හෝරා ලග්න ගණන | 7 (මේෂ → තුලා)   |
| ගණිත ක්‍රියාව | 7 − 3            |
| අවසාන අගය     | 4                |
| දිශාව         | මීනයේ සිට පසුපසට |
| ගණන් කිරීම    | රාශි 4           |

# **ධනු (9)**

වර්ණද ලග්නය (උදා: horoscope 6a68e28d150a9f9377fa70e3)

දෙවන උදාහරණය (horoscope 6a68e2c9150a9f9377fa8861): ජන්ම ලග්නය මකර (ගණන 3), හෝරා ලග්නය මිථුන (ගණන 3) → 3 − 3 = 0 → මකර ඉරට්ටේ නිසා මීනයේ සිට පසුපසට → **මීන (12)**.

[image](https://www.google.com/s2/favicons?domain=https://elibraryofyoga.com\&sz=32)

elibraryofyoga.com+1



## **4. අන්තර්ක්‍රියාකාරීව පරීක්ෂා කිරීම**

ඔබගේ ජන්ම ලග්නය සහ හෝරා ලග්නය වෙනස් කර ප්‍රතිඵලය පරීක්ෂා කළ හැකිය.

**ජන්ම ලග්නය**

**හෝරා ලග්නය**

වර්ණද ලග්නය

| විස්තරය       | අගය |
| ------------- | --- |
| ජන්ම ලග්න ගණන |     |
| හෝරා ලග්න ගණන |     |
| ක්‍රියාව      |     |
| අවසාන අගය     |     |
| දිශාව         |     |

උදාහරණයට නැවත සකසන්න

**සටහන:** මෙම Implementation එක BPHS හි ශ්ලෝක 10–13½ හි රාශි පදනම් කරගත් ක්‍රමයයි. රාශි අංශක (Degrees) මෙයට ඇතුළත් කර නැත. 0°–30° දක්වා අංශකද සැලකිල්ලට ගන්නා ඇතැම් විවරණ ක්‍රම වෙනම ක්‍රියාත්මක කළ යුතුය.