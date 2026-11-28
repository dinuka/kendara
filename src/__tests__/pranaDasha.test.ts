import type { Sukshama } from "@/lib/astrology";
import { computePranas, parseDashaDate, pranasOf } from "@/lib/pranaDasha";
import { getPlanetYears } from "@/lib/vimshottari";

const sukshama = (overrides: Partial<Sukshama> = {}): Sukshama => ({
    planet: 2, // Moon
    startDate: "2026-11-16",
    endDate: "2026-11-29",
    durationDays: 13,
    prana: [],
    startAge: 40,
    ...overrides,
});

describe("computePranas", () => {
    const sk = sukshama();
    const pranas = computePranas(sk);
    const hours = (p: { startDate: string; endDate: string }) =>
        (parseDashaDate(p.endDate).getTime() - parseDashaDate(p.startDate).getTime()) / 3_600_000;

    it("gives nine periods starting from the Sukshama lord in Vimshottari order", () => {
        // Moon → Mars → Rahu → Jupiter → Saturn → Mercury → Ketu → Venus → Sun
        expect(pranas.map((p) => p.planet)).toEqual([2, 3, 8, 5, 7, 4, 9, 6, 1]);
    });

    it("tiles the Sukshama exactly: first starts at its start, each ends where the next starts, last ends at its end", () => {
        expect(pranas[0].startDate).toBe("2026-11-16T00:00:00");
        expect(pranas[pranas.length - 1].endDate).toBe("2026-11-29T00:00:00");
        for (let i = 1; i < pranas.length; i++) expect(pranas[i].startDate).toBe(pranas[i - 1].endDate);
    });

    it("sizes each period in proportion to its lord's years (whole hours)", () => {
        const total = 13 * 24;
        pranas.slice(0, -1).forEach((p) => {
            expect(hours(p)).toBe(Math.round((total * getPlanetYears(p.planet)) / 120));
            expect(p.durationHours).toBe(hours(p));
        });
    });

    it("advances startAge with elapsed time", () => {
        expect(pranas[0].startAge).toBe(40);
        expect(pranas[1].startAge).toBeGreaterThan(40);
    });

    it("returns nothing for an empty or inverted span", () => {
        expect(computePranas(sukshama({ endDate: "2026-11-16" }))).toEqual([]);
    });
});

describe("pranasOf", () => {
    it("prefers a stored Prana list", () => {
        const stored = [{ planet: 1, startDate: "a", endDate: "b", durationHours: 1, startAge: 0 }];
        expect(pranasOf(sukshama({ prana: stored }))).toBe(stored);
    });

    it("derives Pranas when none are stored (trees stop at Sukshama)", () => {
        expect(pranasOf(sukshama())).toHaveLength(9);
    });
});

describe("parseDashaDate", () => {
    it("reads dates and datetimes as local time", () => {
        expect(parseDashaDate("2026-11-16").getTime()).toBe(new Date(2026, 10, 16).getTime());
        expect(parseDashaDate("2026-11-16T05:30:00").getTime()).toBe(new Date(2026, 10, 16, 5, 30).getTime());
    });
});
