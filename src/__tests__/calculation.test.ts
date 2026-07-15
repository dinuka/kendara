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
});
