import { getNakshatraLord } from "@/lib/astrology";

describe("getNakshatraLord", () => {
    test("first cycle: Ashwini-Ketu ... Pushya-Saturn", () => {
        // Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
        expect(getNakshatraLord(1)).toBe(9); // Ashwini
        expect(getNakshatraLord(2)).toBe(6); // Bharani
        expect(getNakshatraLord(3)).toBe(1); // Krittika
        expect(getNakshatraLord(4)).toBe(2); // Rohini
        expect(getNakshatraLord(5)).toBe(3); // Mrigashira
        expect(getNakshatraLord(6)).toBe(8); // Ardra
        expect(getNakshatraLord(7)).toBe(5); // Punarvasu
        expect(getNakshatraLord(8)).toBe(7); // Pushya
        expect(getNakshatraLord(9)).toBe(4); // Ashlesha
    });

    test("second cycle repeats the same lord order", () => {
        expect(getNakshatraLord(10)).toBe(9); // Magha
        expect(getNakshatraLord(18)).toBe(4); // Jyestha
    });

    test("third cycle wraps to Ketu at Revati", () => {
        expect(getNakshatraLord(19)).toBe(9); // Mula
        expect(getNakshatraLord(27)).toBe(4); // Revati
    });

    test("out-of-range nakshatra id falls back to Sun", () => {
        expect(getNakshatraLord(0)).toBe(1);
        expect(getNakshatraLord(28)).toBe(1);
    });
});
