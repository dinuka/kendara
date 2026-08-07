import { computePanchaPakshi } from "@/lib/astrology";
import { PanchaPakshi } from "@/lib/astrologyEnums";

describe("computePanchaPakshi", () => {
    test("Shukla Paksha first group (Ashwini-Ardra) is Vulture", () => {
        expect(computePanchaPakshi(1, 8)).toBe(PanchaPakshi.VULTURE);
        expect(computePanchaPakshi(6, 15)).toBe(PanchaPakshi.VULTURE);
    });

    test("Shukla Paksha second group (Punarvasu-Uttara Phalguni) is Owl", () => {
        expect(computePanchaPakshi(7, 1)).toBe(PanchaPakshi.OWL);
        expect(computePanchaPakshi(12, 8)).toBe(PanchaPakshi.OWL);
    });

    test("Crow group stays the same in both pakshas", () => {
        expect(computePanchaPakshi(13, 8)).toBe(PanchaPakshi.CROW);
        expect(computePanchaPakshi(17, 23)).toBe(PanchaPakshi.CROW);
    });

    test("Shukla Paksha fourth group (Jyeshtha-Shravana) is Cock", () => {
        expect(computePanchaPakshi(18, 9)).toBe(PanchaPakshi.COCK);
        expect(computePanchaPakshi(22, 9)).toBe(PanchaPakshi.COCK);
    });

    test("Shukla Paksha fifth group (Dhanishta-Revati) is Peacock", () => {
        expect(computePanchaPakshi(23, 14)).toBe(PanchaPakshi.PEACOCK);
        expect(computePanchaPakshi(27, 14)).toBe(PanchaPakshi.PEACOCK);
    });

    test("Krishna Paksha rotates the other four birds", () => {
        expect(computePanchaPakshi(1, 16)).toBe(PanchaPakshi.PEACOCK);
        expect(computePanchaPakshi(7, 20)).toBe(PanchaPakshi.COCK);
        expect(computePanchaPakshi(18, 23)).toBe(PanchaPakshi.OWL);
        expect(computePanchaPakshi(23, 30)).toBe(PanchaPakshi.VULTURE);
    });

    test("doc example: Rohini + Shukla Navami is Vulture", () => {
        expect(computePanchaPakshi(4, 9)).toBe(PanchaPakshi.VULTURE);
    });

    test("doc example: Rohini + Krishna Panchami is Peacock", () => {
        expect(computePanchaPakshi(4, 20)).toBe(PanchaPakshi.PEACOCK);
    });

    test("boundary: thithi 15 is Shukla, thithi 16 is Krishna", () => {
        expect(computePanchaPakshi(2, 15)).toBe(PanchaPakshi.VULTURE);
        expect(computePanchaPakshi(2, 16)).toBe(PanchaPakshi.PEACOCK);
    });

    test("out-of-range nakshatra id falls back to Vulture", () => {
        expect(computePanchaPakshi(0, 8)).toBe(PanchaPakshi.VULTURE);
        expect(computePanchaPakshi(28, 20)).toBe(PanchaPakshi.VULTURE);
    });
});
