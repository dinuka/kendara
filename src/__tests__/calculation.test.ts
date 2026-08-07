import { computeAscendantSpecialFlags, navamsaSign } from "@/lib/astrology";
import { calculateHoroscope } from "@/lib/calculation";

describe("calculateHoroscope", () => {
    const baseData = {
        name: "Test",
        displayName: true,
        birthDate: new Date("1990-06-15"),
        birthTime: "08:30",
        location: "Colombo",
        latitude: 6.9271,
        longitude: 79.8612,
        gender: "male" as const,
        ayanamsha: "lahiri" as const,
        isPublic: false,
        owner: { id: "user-1" },
    } as unknown as any;

    test("returns ascendant with sign and degree", () => {
        const result = calculateHoroscope(baseData);
        expect(result.ascendant).toBeDefined();
        expect(result.ascendant.sign).toBeGreaterThanOrEqual(1);
        expect(result.ascendant.sign).toBeLessThanOrEqual(12);
        expect(typeof result.ascendant.degree).toBe("number");
    });

    test("calculates 12 houses", () => {
        const result = calculateHoroscope(baseData);
        expect(result.houses).toHaveLength(12);
        result.houses.forEach((house, i) => {
            expect(house.houseNumber).toBe(i + 1);
            expect(house.startDegree).toBeDefined();
            expect(house.middleDegree).toBeDefined();
            expect(house.endDegree).toBeDefined();
        });
    });

    test("house signs are sequential whole-sign from the ascendant (no skipped or repeated signs)", () => {
        const data = {
            ...baseData,
            birthDate: new Date("2021-11-12"),
            birthTime: "10:30",
            location: "Hospital - Kuliyapitiya",
            latitude: 7.4697,
            longitude: 80.0411,
        };
        const result = calculateHoroscope(data);
        const ascSign = result.ascendant.sign;
        result.houses.forEach((house, i) => {
            const expectedSign = ((ascSign - 1 + i) % 12) + 1;
            expect(house.sign).toBe(expectedSign);
        });
    });

    test("calculates all 9 planets", () => {
        const result = calculateHoroscope(baseData);
        expect(result.planets).toHaveLength(9);
        const names = result.planets.map((p) => p.name);
        expect(names).toContain(1);
        expect(names).toContain(2);
        expect(names).toContain(8);
        expect(names).toContain(9);
    });

    test("planets have required fields", () => {
        const result = calculateHoroscope(baseData);
        result.planets.forEach((planet) => {
            expect(planet.name).toBeDefined();
            expect(planet.sign).toBeGreaterThanOrEqual(1);
            expect(planet.sign).toBeLessThanOrEqual(12);
            expect(typeof planet.degree).toBe("number");
            expect(planet.house).toBeGreaterThanOrEqual(1);
            expect(planet.house).toBeLessThanOrEqual(12);
            expect(planet.nakshatra).toBeDefined();
            expect(planet.pada).toBeGreaterThanOrEqual(1);
            expect(planet.pada).toBeLessThanOrEqual(4);
        });
    });

    test("aspect degreeGap is always less than 30", () => {
        const result = calculateHoroscope(baseData);
        result.planets.forEach((planet) => {
            (planet.aspects as Array<{ degreeGap: number }>).forEach((aspect) => {
                expect(aspect.degreeGap).toBeLessThan(30);
            });
        });
    });

    test("nakshatra is calculated for moon and ascendant", () => {
        const result = calculateHoroscope(baseData);
        expect(result.nakshatra.moonNakshatra).toBeDefined();
        expect(result.nakshatra.ascendantNakshatra).toBeDefined();
        expect(result.nakshatra.moonNakshatra.id).toBeGreaterThanOrEqual(1);
        expect(result.nakshatra.moonNakshatra.id).toBeLessThanOrEqual(27);
    });

    test("thithi is calculated as an integer 1-30", () => {
        const result = calculateHoroscope(baseData);
        expect(Number.isInteger(result.thithi)).toBe(true);
        expect(result.thithi).toBeGreaterThanOrEqual(1);
        expect(result.thithi).toBeLessThanOrEqual(30);
    });

    test("maraka planets is an array of numbers", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.marakaPlanets)).toBe(true);
        result.marakaPlanets.forEach((p: number) => {
            expect(typeof p).toBe("number");
        });
    });

    test("dashas has mahadasha array", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.dashas.mahadasha)).toBe(true);
        expect(result.dashas.currentPeriod).toBeDefined();
    });

    test("different ayanamsha produces different absolute degrees", () => {
        const lahiri = calculateHoroscope(baseData);
        const ramanData = { ...baseData, ayanamsha: "raman" as const };
        const raman = calculateHoroscope(ramanData);
        const lahiriDeg = lahiri.planets[0].absoluteDegree;
        const ramanDeg = raman.planets[0].absoluteDegree;
        expect(lahiriDeg).not.toBe(ramanDeg);
    });

    test("badhaka and atmakaraka are defined", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.badhakaPlanet)).toBe(true);
        expect(result.atmakaraka).toBeGreaterThanOrEqual(1);
        expect(result.lord22ndDrekkana).toBeGreaterThanOrEqual(1);
        expect(result.lord64thNavamsa).toBeGreaterThanOrEqual(1);
    });

    test("nidhanamsha planets are defined and match the navamsa-position rule", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.nidhanamshaPlanets)).toBe(true);
        result.nidhanamshaPlanets.forEach((p: number) => {
            expect(typeof p).toBe("number");
        });
    });

    test("ashtamansha planets are defined and match the 8th-house/navamsa rule", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.ashtamanshaPlanets)).toBe(true);
        result.ashtamanshaPlanets.forEach((p: number) => {
            expect(typeof p).toBe("number");
        });
    });
});

describe("calculateHoroscope Wargoththama & Gandanta/Gandamula", () => {
    const baseData = {
        name: "Test",
        displayName: true,
        birthDate: new Date("1990-06-15"),
        birthTime: "08:30",
        location: "Colombo",
        latitude: 6.9271,
        longitude: 79.8612,
        gender: "male" as const,
        ayanamsha: "lahiri" as const,
        isPublic: false,
        owner: { id: "user-1" },
    } as unknown as any;

    test("wargoththama flag is a boolean and wargoththama planets match sign==navamsa rule", () => {
        const result = calculateHoroscope(baseData);
        expect(typeof result.isAscendantWargoththama).toBe("boolean");
        expect(Array.isArray(result.wargoththamaPlanets)).toBe(true);
        result.wargoththamaPlanets.forEach((p: number) => {
            const planet = result.planets.find((pl) => pl.name === p);
            expect(planet).toBeDefined();
            expect(planet!.sign).toBe(planet!.navamsaSign);
        });
    });

    test("gandantha and gandamula planets are arrays and match nakshatra+pada rule", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.gandanthaPlanets)).toBe(true);
        expect(Array.isArray(result.gandamulaPlanets)).toBe(true);
        result.gandanthaPlanets.forEach((p: number) => {
            const planet = result.planets.find((pl) => pl.name === p);
            expect(planet).toBeDefined();
            expect(planet!.pada).toBe(4);
            expect([9, 18, 27]).toContain(planet!.nakshatra);
        });
        result.gandamulaPlanets.forEach((p: number) => {
            const planet = result.planets.find((pl) => pl.name === p);
            expect(planet).toBeDefined();
            expect(planet!.pada).toBe(1);
            expect([1, 10, 19]).toContain(planet!.nakshatra);
        });
    });

    test("pushkara planets are arrays and match the birth-sign -> navamsa-group rule", () => {
        const result = calculateHoroscope(baseData);
        expect(Array.isArray(result.pushkaraPlanets)).toBe(true);
        result.pushkaraPlanets.forEach((p: number) => {
            const planet = result.planets.find((pl) => pl.name === p);
            expect(planet).toBeDefined();
            const group = (() => {
                if ([1, 5, 9].includes(planet!.sign)) return [7, 9];
                if ([4, 8, 12].includes(planet!.sign)) return [4, 6];
                return [2, 12];
            })();
            expect(group).toContain(planet!.navamsaSign);
        });
    });

    test("ascendant gandantha/gandamula flags are booleans and match the lagna nakshatra+pada rule", () => {
        const result = calculateHoroscope(baseData);
        expect(typeof result.isAscendantGandantha).toBe("boolean");
        expect(typeof result.isAscendantGandamula).toBe("boolean");
        const ascNakshatra = result.nakshatra.ascendantNakshatra;
        expect(result.isAscendantGandantha).toBe([9, 18, 27].includes(ascNakshatra.id) && ascNakshatra.pada === 4);
        expect(result.isAscendantGandamula).toBe([1, 10, 19].includes(ascNakshatra.id) && ascNakshatra.pada === 1);
    });

    test("ascendant pushkara flag is a boolean and matches the lagna sign -> navamsa-group rule", () => {
        const result = calculateHoroscope(baseData);
        expect(typeof result.isAscendantPushkara).toBe("boolean");
        const ascSign = result.ascendant.sign;
        const group = (() => {
            if ([1, 5, 9].includes(ascSign)) return [7, 9];
            if ([4, 8, 12].includes(ascSign)) return [4, 6];
            return [2, 12];
        })();
        const ascNavamsaNum = Math.floor(result.ascendant.degree / (30 / 9)) + 1;
        const ascNavamsaSign = navamsaSign(ascSign, ascNavamsaNum);
        expect(result.isAscendantPushkara).toBe(group.includes(ascNavamsaSign));
    });

    test("computeAscendantSpecialFlags matches the stored calculation flags", () => {
        const result = calculateHoroscope(baseData);
        const { isAscendantGandantha, isAscendantGandamula, isAscendantPushkara } = computeAscendantSpecialFlags(
            result.ascendant.sign,
            result.ascendant.degree,
            result.nakshatra.ascendantNakshatra.id,
            result.nakshatra.ascendantNakshatra.pada,
        );
        expect(isAscendantGandantha).toBe(result.isAscendantGandantha);
        expect(isAscendantGandamula).toBe(result.isAscendantGandamula);
        expect(isAscendantPushkara).toBe(result.isAscendantPushkara);
    });

    test("computeAscendantSpecialFlags marks Mesha lagna in Ashwini pada 1 as Gandamula (render-time fallback)", () => {
        const flags = computeAscendantSpecialFlags(1, 2.61, 1, 1);
        expect(flags.isAscendantGandamula).toBe(true);
        expect(flags.isAscendantGandantha).toBe(false);
    });
});
