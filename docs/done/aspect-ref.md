# දෘෂ්ඨි නිවැරදි කිරීම

- Plant has two aspects. Rashi Aspect and Planet Aspect.
- Rashi Aspect was describing in the @rash_aspects.md
- Planet Aspect was describing in the @aspects.md
-

## What need to fix

- Current calculation has issues. Need to fix it.
- I need to use simple code for calculating aspects. Need to modify the tests also.
- How to calculating Aspects
  - For Rash Aspect check @rash_aspects.md
  - For Planet Aspect
    - Need to use Setting values. As example Kuja, as the setting is aspecting 4, 5, 7, 8, 9.
    - Need to find all planets in that houses from Kuja. As example if Kuja in the 3rd House, Need to find planets in 6, 7, 9, 10, 11.
    - Need to get degree different. If degree different is lower than Kuja's Obrs value, thats mean Kuja is aspecting that planet.
    - Need to show Kuja in that planet row in the calculation table's aspcets column.
  - Need to fix the House aspecting also. Only thing is for house aspect no need to check Planet Obrs value. Just need to show the degree different with House middle.
- Both Rash and Planet aspect show together. which is correct now. But some places degree different is worng.
- The system should use only one calculated value for showing every places. Sometime Chart tabs aspects and Calculation tab aspects are different.
