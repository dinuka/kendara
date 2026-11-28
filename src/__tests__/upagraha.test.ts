import { calculateUpagrahaLongitudes, calculateUpagrahas } from "@/lib/upagraha";

const dms = (d: number, m: number) => d + m / 60;

describe("calculateUpagrahas", () => {
    it("matches the worked example in the docs (Sun at Taurus 15°20′)", () => {
        const result = calculateUpagrahaLongitudes(dms(45, 20));
        expect(result.dhuma).toBeCloseTo(dms(178, 40), 6); // Virgo 28°40′
        expect(result.vyatipata).toBeCloseTo(dms(181, 20), 6); // Libra 1°20′
        expect(result.parivesha).toBeCloseTo(dms(1, 20), 6); // Aries 1°20′
        expect(result.indrachapa).toBeCloseTo(dms(358, 40), 6); // Pisces 28°40′
        expect(result.upaketu).toBeCloseTo(dms(15, 20), 6); // Aries 15°20′
    });

    it("returns signs and in-sign degrees in sloka order", () => {
        const result = calculateUpagrahas(dms(45, 20));
        expect(result.map((u) => u.key)).toEqual(["dhuma", "vyatipata", "parivesha", "indrachapa", "upaketu"]);
        expect(result.map((u) => u.sign)).toEqual([6, 7, 1, 12, 1]);
        expect(result[0].degree).toBeCloseTo(dms(28, 40), 6);
        expect(result[1].degree).toBeCloseTo(dms(1, 20), 6);
    });

    it("always places Upaketu one sign behind the Sun (sl. 64)", () => {
        for (let sun = 0; sun < 360; sun += 7.3) {
            const { upaketu } = calculateUpagrahaLongitudes(sun);
            expect((upaketu + 30) % 360).toBeCloseTo(sun, 6);
        }
    });

    it("keeps every longitude within [0, 360)", () => {
        for (let sun = 0; sun < 360; sun += 0.5) {
            Object.values(calculateUpagrahaLongitudes(sun)).forEach((value) => {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(360);
            });
        }
    });

    it("puts an exact sign boundary in the following sign", () => {
        // Sun 196°40′ → Dhūma 330° → Vyatipāta exactly 30° → Taurus 0°.
        const vyatipata = calculateUpagrahas(dms(196, 40))[1];
        expect(vyatipata.sign).toBe(2);
        expect(vyatipata.degree).toBeCloseTo(0, 6);
    });

    it("rejects non-finite input", () => {
        expect(() => calculateUpagrahas(NaN)).toThrow();
    });
});

describe("withUpagrahas", () => {
    it("places each Upagraha in the row of its sign with an in-sign degree label", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { withUpagrahas } = require("@/lib/chartTableRows");
        const rows = Array.from({ length: 12 }, (_, i) => ({
            houseNumber: i + 1,
            sign: ((i + 1) % 12) + 1, // Taurus lagna
            planets: [],
            aspects: [],
        }));
        const data = withUpagrahas({ rows, available: new Set(["number"]) }, dms(45, 20));
        expect(data.available.has("upagraha")).toBe(true);
        const aries = data.rows.find((r: { sign: number }) => r.sign === 1);
        expect(aries.upagrahas).toEqual([
            { key: "parivesha", degreeLabel: "01:20:00" },
            { key: "upaketu", degreeLabel: "15:20:00" },
        ]);
        expect(data.rows.find((r: { sign: number }) => r.sign === 6).upagrahas).toEqual([
            { key: "dhuma", degreeLabel: "28:40:00" },
        ]);
        expect(data.rows.find((r: { sign: number }) => r.sign === 2).upagrahas).toEqual([]);
    });
});
