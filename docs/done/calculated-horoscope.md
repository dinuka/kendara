# Calculated horoscope

As astrological students they get already calculated horoscopes without birth information. Then system should possible to calculate date with given input.

It is workflow should like this.

1. The system is showing input for adding lagna.
2. The system should calculate 12th house's sign using given lagna. It should show as a table.

- House number
- Planets (Graha)
- Aspects

1. The user can update the house table by adding plants to relevant locations.
2. The system should validate the Budha, Sikuru, Rahu keth locations

- Budha should with Ravi's house or -1 or +1 houses
- Sikuru should with Ravi's house or -2 or +2 houses
- Kethu and Rahu gap should be 6 houses (opposite houses).

1. The system should update the Aspects using given input.
2. The system should create the planets table using that information.

- Planet
- Sign
- Str
- House
- Conjunctions
- Aspects
- Other (22nd Drekkana Lord, 64th Navamsa Lord, Atmakaraka, etc...)

1. Before the planets table the system should show another input for adding Navansaka sign.
2. If user add it the system should show the Navansaka house table.

- House number
- Planets (Graha)

1. The system should update the planets table's following values

- Navansaka
- Navansaka Str
- Degree range
- Nakshathra (pada)
- Conjuctions (should use )
- Aspects
- Other

1. Also the system should give the range of

- Birth time using Ravi's location
  - If Ravi in,
    1st house - 05:00 - 07:00
    2         - 07:00 - 9:00
    3         - 09:00 - 11:00
    4         - 11:00 - 13:00

- Birth Month using Ravi's sign
  - If Ravi in
    Mesha - April 15 - May 15
    Wrushaba - May 15 - June 15 etc....

- Birth Date using Ravi's degree range.
  - If Ravi in
  1st Navansaka then degree range is 00:00 - 03:20 - Then Birth Date should be 12 + 0  = 12 , 17 + 4 = 21
  2nd Navansaka then degree range is 03:20 - 06:40 - Then Birth Date should be 12 + 3 = 15, 17 + 7 = 24

- Age using Shani location and current location of Shani
  - If Shani in 1st Navansaka then  degree range is 00:00 - 03:20 , Then Shani need 30 or 27 month for going for next sign. If Current Shani degree is 18:00 then It should 18month is completed.
    So 1st age should be
    - 30 + 18 + 30 * (birth chart's shani sign - current shani sign - 1) months
    2nd age should be previous age + 30 years.
    3rd age should be 2nd age + 30 years
