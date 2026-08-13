# ෂඩ් බලය

- Should show in the new table in the calculation tab
- It should include ග්‍රහයා, ස්ථාන බල, චේෂ්ටා බලය, කාල බලය, දිග් බලය, දෘෂ්ඨි බලය, නෛසර්ගික බලය, අනුපාතය
- ස්ථාන බල, චේෂ්ටා බලය, කාල බලය, දිග් බලය, දෘෂ්ඨි බලය, නෛසර්ගික බලය ගණනය කරන අයුරු පහත වෙනම සදහන් කර ඇත.
  - Those should have boolean value.
  - Should mark from the Check box check and uncheck.
  - User should possible to check and uncheck if he want. Because some values can't calculate by the system.
  - The system should save the user updated values automatically.  
  - User should possible see the reason for checked or unchecked.
    - As example, checkbox in Sthana bala should show a tool tip as Uchcha.
    - checkbox in Kala bala - tool tip has Because of conjunction with Skukla Chandra, etc...
- අනුපාතය is (sum of true values) / 6. Should show as (3/6) no need to divide

## ස්ථාන බල

- If some planet in Neecha and Sathuru the planet has not Sthana bala. Otherwise it has the Sthana bala.

## චේෂ්ටා බලය

- If Ravi is in Uththarayana then Ravi has Cheshta bala.
  - This should calculated for horoscope with birth time and location.
  - For manual calculated horoscope,
    - If Ravi in Makara, Kumba, Meena, Mesha, Wrushaba then Ravi has Cheshta bala
- If Sandu is in Shukla paksha then Sandu has Cheshta bala.
  - If Kuja, Buda, Sikuru, Guru, Shani combind with Shukla Chandra then that plant also has Cheshta bala.
- If planet is Wakra then that plant has Cheshta bala.
- If some planet win from the plant war then that plant has Cheshta bala until 48h after the planets war.
  - This should calculated for horoscope with birth time and location.
  - For manual calculated horoscope - user will update manually.

## කාල බලය

- If some plant complete any condition then that planet has Kala bala. No need to check all conditions.
  - Chandra, Kuja, Shani has Kala bala for Night time.
  - Ravi, Guru, Sikuru has Kala bala for Day time.
  - Budha, Guru, Sikuru has Kala bala if Chandra in the Shukla paksha.
  - Ravi, Kuja, Shani has Kala bala if Chandra in the Krushna paksha.
- Need to calculate the load of Hora, Panchama and Sukshama. Then those loads has Kala bala. (cannot calculate for manually calculated horoscopes)

## දිග් බලය

- Guru, Budha is Dig bala for 1st house.
- Kuja, Ravi is Dig bala for 10th house.
- Chandra, Shukra is Dig abal for 4th house.
- Shani is Dig bala for 7th house.

## නෛසර්ගික බලය

- If planet is not Maranakaraka then that plant has Naisargika Bala

## දෘෂ්ඨි බලය

- User will update manually. Because some values can't calculate by the system.
