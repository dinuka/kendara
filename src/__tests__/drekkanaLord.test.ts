import type { IHoroscope } from "@/models/Horoscope";

import type { House } from "@/lib/astrology";
import { Planet, ZodiacSign } from "@/lib/astrologyEnums";
import { calculateHoroscope } from "@/lib/calculation";
import { get22ndDrekkanaLord, get22ndDrekkanaLordFromPlanet } from "@/lib/drekkanaLord";
import { buildBhavaHouses, compute } from "@/lib/manualChart";
import { synthesizeCalculation } from "@/lib/manualChartDetails";

describe("get22ndDrekkanaLord", () => {
    test("1st, 2nd and 3rd drekkana use the 8th, 12th and 4th lords", () => {
        // Aries: 8th Scorpio (Mars), 12th Pisces (Jupiter), 4th Cancer (Moon).
        expect(get22ndDrekkanaLord(ZodiacSign.ARIES, 5)).toBe(Planet.MARS);
        expect(get22ndDrekkanaLord(ZodiacSign.ARIES, 10)).toBe(Planet.JUPITER);
        expect(get22ndDrekkanaLord(ZodiacSign.ARIES, 29.99)).toBe(Planet.MOON);
        // Leo: 8th Pisces (Jupiter), 12th Cancer (Moon), 4th Scorpio (Mars).
        expect(get22ndDrekkanaLord(ZodiacSign.LEO, 0)).toBe(Planet.JUPITER);
        expect(get22ndDrekkanaLord(ZodiacSign.LEO, 15)).toBe(Planet.MOON);
        expect(get22ndDrekkanaLord(ZodiacSign.LEO, 25)).toBe(Planet.MARS);
    });
});

describe("get22ndDrekkanaLordFromPlanet", () => {
    // Aries lagna at 5° → each bhava madhya sits at 5° of its sign (1st drekkana).
    const houses: House[] = buildBhavaHouses(ZodiacSign.ARIES, 5);

    test("uses the bhava madhya of the occupied house, not the planet's longitude", () => {
        // Moon at 25° Cancer (3rd drekkana) sits in the 4th bhava (Cancer, madhya 5°) → 8th from
        // Cancer is Aquarius → Saturn. The Moon's own degree would give the 4th lord (Venus).
        expect(get22ndDrekkanaLordFromPlanet({ absoluteDegree: 90 + 15, house: 4 }, houses)).toBe(Planet.SATURN);
    });

    test("a planet past the end cusp counts from the next bhava", () => {
        // 22° Cancer lies past the 4th bhava's end cusp (20° Cancer) → 5th bhava (Leo, madhya 5°)
        // → 8th from Leo is Pisces → Jupiter.
        expect(get22ndDrekkanaLordFromPlanet({ absoluteDegree: 90 + 22, house: 4 }, houses)).toBe(Planet.JUPITER);
    });
});

describe("stored Chandra/Ravi 22nd Drekkana lords", () => {
    test("auto charts store the lords counted from the Moon's and Sun's bhava", () => {
        const result = calculateHoroscope({
            birthDate: new Date("1990-06-15"),
            birthTime: "08:30",
            latitude: 6.9271,
            longitude: 79.8612,
            ayanamsha: "lahiri",
        } as unknown as IHoroscope);
        const moon = result.planets.find(({ name }) => name === Planet.MOON)!;
        const sun = result.planets.find(({ name }) => name === Planet.SUN)!;
        expect(result.lord22ndDrekkanaMoon).toBe(get22ndDrekkanaLordFromPlanet(moon, result.houses));
        expect(result.lord22ndDrekkanaSun).toBe(get22ndDrekkanaLordFromPlanet(sun, result.houses));
    });

    test("manual charts with Navamsa data store the lords from the bhava houses", () => {
        // Aries lagna, navamsa lagna Aries → bhava madhyas at 1°40' of each sign. Moon in Cancer with
        // Pisces navamsa (~28° Cancer) falls in the 5th bhava (Leo) → 8th from Leo → Jupiter. Sun in
        // Aries with Aries navamsa stays in the 1st bhava → 8th from Aries → Mars.
        const calc = synthesizeCalculation(
            compute({
                lagna: ZodiacSign.ARIES,
                houses: { "1": [Planet.SUN], "4": [Planet.MOON] },
                navamsaLagna: ZodiacSign.ARIES,
                navamsaHouses: { "1": [Planet.SUN], "12": [Planet.MOON] },
            }),
        );
        expect(calc.lord22ndDrekkanaMoon).toBe(Planet.JUPITER);
        expect(calc.lord22ndDrekkanaSun).toBe(Planet.MARS);
    });

    test("manual charts without Navamsa data store 0", () => {
        const calc = synthesizeCalculation(
            compute({ lagna: ZodiacSign.ARIES, houses: { "1": [Planet.SUN], "4": [Planet.MOON] } }),
        );
        expect(calc.lord22ndDrekkanaMoon).toBe(0);
        expect(calc.lord22ndDrekkanaSun).toBe(0);
    });
});
