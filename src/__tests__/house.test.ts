import { House, findHouse } from "@/lib/astrology";

// Simulates an Aries-ascendant Placidus chart where the 12th-house boundary
// ends inside Pisces at 13:45:49 (13.7636°), so a planet at Pisces 14:40:48
// (14.68°) lies past it and belongs to the 1st house.
const makeHouses = (): House[] => {
    const h = (
        houseNumber: number,
        startSign: number,
        startDegree: number,
        endSign: number,
        endDegree: number,
    ): House => ({
        houseNumber,
        startDegree,
        startSign,
        startLord: 0,
        middleDegree: startDegree,
        middleSign: startSign,
        middleLord: 0,
        endDegree,
        endSign,
        endLord: 0,
        sign: startSign,
        lord: 0,
    });

    return [
        h(1, 12, 13.7636, 1, 13),
        h(2, 1, 13, 2, 15),
        h(3, 2, 15, 3, 17),
        h(4, 3, 17, 4, 19),
        h(5, 4, 19, 5, 21),
        h(6, 5, 21, 6, 23),
        h(7, 6, 23, 7, 25),
        h(8, 7, 25, 8, 27),
        h(9, 8, 27, 9, 29),
        h(10, 9, 29, 10, 31),
        h(11, 10, 1, 11, 3),
        h(12, 11, 3, 12, 13.7636),
    ];
};

describe("findHouse", () => {
    test("planet in Pisces just past the 12th/1st boundary falls in the 1st house", () => {
        const houses = makeHouses();
        const marsAbs = 11 * 30 + 14.68; // Pisces 14:40:48
        expect(findHouse(marsAbs, houses)).toBe(1);
    });

    test("planet in Pisces before the boundary falls in the 12th house", () => {
        const houses = makeHouses();
        const moonAbs = 11 * 30 + 13.5; // Pisces 13:30:00
        expect(findHouse(moonAbs, houses)).toBe(12);
    });

    test("planet in Aries early degrees falls in the 1st house", () => {
        const houses = makeHouses();
        const sunAbs = 0 * 30 + 5; // Aries 5:00:00
        expect(findHouse(sunAbs, houses)).toBe(1);
    });

    test("planet in mid-sign falls in its own house", () => {
        const houses = makeHouses();
        const jupiterAbs = 4 * 30 + 20; // Leo 20:00:00
        expect(findHouse(jupiterAbs, houses)).toBe(5);
    });

    test("degree at 359.9 wraps into the first house range", () => {
        const houses = makeHouses();
        expect(findHouse(359.9, houses)).toBe(1);
    });

    test("returns null when house array is empty", () => {
        expect(findHouse(100, [])).toBeNull();
    });
});
