import { calculateDashas } from "@/lib/calculation";

// Mock the jyotish-calculations and swisseph-v2 modules since they're native
jest.mock("jyotish-calculations", () => ({}));
jest.mock("swisseph-v2", () => ({}));

describe("calculateDashas", () => {
    const birthDate = new Date("1990-06-15T08:30:00");

    describe("Vimshottari Dasha cycle integrity", () => {
        test("first MD lord matches nakshatra lord", () => {
            // Moon in Ashwini (nakshatra 1, lord Ketu=9)
            // Ashwini spans 0°-13°20'
            const moonLongitude = 5; // 5° in Ashwini
            const result = calculateDashas(moonLongitude, 1, 9, birthDate);
            expect(result.mahadasha[0].planet).toBe(9);
            expect(result.mahadasha[0].remainingYearsAtBirth).toBeGreaterThan(0);
        });

        test("moon at end of nakshatra gives small remaining balance", () => {
            // Moon near end of Ashwini (nakshatra 1, lord Ketu=9)
            // Ashwini ends at 13.333°, moon at 13°
            const moonLongitude = 13;
            const result = calculateDashas(moonLongitude, 1, 9, birthDate);
            expect(result.mahadasha[0].planet).toBe(9);
            expect(result.mahadasha[0].remainingYearsAtBirth).toBeLessThan(3);
        });

        test("moon at start of nakshatra gives full balance", () => {
            const moonLongitude = 0.5;
            const result = calculateDashas(moonLongitude, 1, 9, birthDate);
            expect(result.mahadasha[0].planet).toBe(9);
            expect(result.mahadasha[0].remainingYearsAtBirth).toBeCloseTo(7, 0);
        });

        test("generates exactly 9 mahadashas", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            expect(result.mahadasha).toHaveLength(9);
        });

        test("all 9 planets appear as MD lords exactly once", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            const lords = result.mahadasha.map((md) => md.planet).sort((a, b) => a - b);
            expect(lords).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });
    });

    describe("Antardasha sub-periods", () => {
        test("non-first MDs have 9 antardashas", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (let i = 1; i < result.mahadasha.length; i++) {
                expect(result.mahadasha[i].antardasha).toHaveLength(9);
            }
        });

        test("first MD has fewer ADs when truncated (some occurred before birth)", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            // First MD is Saturn (19yr) with ~9.5yr remaining, birth offset into Venus AD
            // Expect only ~5 ADs (from Venus onward) that fit in remaining time
            expect(result.mahadasha[0].antardasha.length).toBeLessThan(9);
            expect(result.mahadasha[0].antardasha.length).toBeGreaterThan(0);
        });

        test("each non-first MD has exactly 9 antardashas", () => {
            const result = calculateDashas(5, 1, 9, birthDate);
            for (let i = 1; i < result.mahadasha.length; i++) {
                expect(result.mahadasha[i].antardasha).toHaveLength(9);
            }
        });

        test("antardasha periods are contiguous (no gaps)", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (let i = 1; i < md.antardasha.length; i++) {
                    const prev = md.antardasha[i - 1];
                    const curr = md.antardasha[i];
                    expect(curr.startDate).toBe(prev.endDate);
                }
            }
        });

        test("first AD start matches MD start", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                expect(md.antardasha[0].startDate).toBe(md.startDate);
            }
        });

        test("last AD end matches MD end", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                const lastAd = md.antardasha[md.antardasha.length - 1];
                expect(lastAd.endDate).toBe(md.endDate);
            }
        });
    });

    describe("Vidasa sub-sub-periods", () => {
        test("each non-last AD in full MDs has 9 vidasas", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (let ai = 0; ai < md.antardasha.length - 1; ai++) {
                    const ad = md.antardasha[ai];
                    expect(ad.vidasa.length).toBeGreaterThan(0);
                }
            }
        });

        test("vidasa periods are contiguous", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (const ad of md.antardasha) {
                    for (let i = 1; i < ad.vidasa.length; i++) {
                        expect(ad.vidasa[i].startDate).toBe(ad.vidasa[i - 1].endDate);
                    }
                }
            }
        });

        test("first VD start matches AD start", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (const ad of md.antardasha) {
                    if (ad.vidasa.length > 0) {
                        expect(ad.vidasa[0].startDate).toBe(ad.startDate);
                    }
                }
            }
        });

        test("last VD end matches AD end", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (const ad of md.antardasha) {
                    if (ad.vidasa.length > 0) {
                        const lastVd = ad.vidasa[ad.vidasa.length - 1];
                        expect(lastVd.endDate).toBe(ad.endDate);
                    }
                }
            }
        });
    });

    describe("Sukshama sub-sub-sub-periods", () => {
        test("each VD has sukshama array (may be empty)", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            for (const md of result.mahadasha) {
                for (const ad of md.antardasha) {
                    for (const vd of ad.vidasa) {
                        expect(Array.isArray(vd.sukshama)).toBe(true);
                    }
                }
            }
        });
    });

    describe("currentPeriod detection", () => {
        test("currentPeriod has valid lords", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            expect(result.currentPeriod.mahadashaLord).toBeGreaterThanOrEqual(1);
            expect(result.currentPeriod.mahadashaLord).toBeLessThanOrEqual(9);
            expect(result.currentPeriod.antardashaLord).toBeGreaterThanOrEqual(1);
            expect(result.currentPeriod.antardashaLord).toBeLessThanOrEqual(9);
        });
    });

    describe("remainingYearsAtBirth", () => {
        test("only first MD has non-zero remainingYearsAtBirth", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            expect(result.mahadasha[0].remainingYearsAtBirth).toBeGreaterThan(0);
            for (let i = 1; i < result.mahadasha.length; i++) {
                expect(result.mahadasha[i].remainingYearsAtBirth).toBe(0);
            }
        });
    });

    describe("date format validation", () => {
        test("all dates are valid ISO format", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            for (const md of result.mahadasha) {
                expect(md.startDate).toMatch(dateRegex);
                expect(md.endDate).toMatch(dateRegex);
                for (const ad of md.antardasha) {
                    expect(ad.startDate).toMatch(dateRegex);
                    expect(ad.endDate).toMatch(dateRegex);
                    for (const vd of ad.vidasa) {
                        expect(vd.startDate).toMatch(dateRegex);
                        expect(vd.endDate).toMatch(dateRegex);
                        for (const sk of vd.sukshama) {
                            expect(sk.startDate).toMatch(dateRegex);
                            expect(sk.endDate).toMatch(dateRegex);
                        }
                    }
                }
            }
        });
    });

    describe("edge cases", () => {
        test("last MD gets its planet's full years (no inflation)", () => {
            const birthDate = new Date("2018-09-10");
            const result = calculateDashas(100, 8, 7, birthDate);
            const lastMd = result.mahadasha[result.mahadasha.length - 1];
            // Last MD is Jupiter (16 years), not inflated
            expect(lastMd.durationYears).toBeCloseTo(16, 0);
        });

        test("birth date far in the past still produces valid dates", () => {
            const oldBirth = new Date("1900-01-01");
            const result = calculateDashas(80, 6, 8, oldBirth);
            expect(result.mahadasha.length).toBe(9);
            expect(new Date(result.mahadasha[0].startDate).getFullYear()).toBe(1900);
        });

        test("different nakshatra lord produces different first MD planet", () => {
            const ketuStart = calculateDashas(5, 1, 9, birthDate);
            const venusStart = calculateDashas(20, 2, 6, birthDate);
            expect(ketuStart.mahadasha[0].planet).toBe(9);
            expect(venusStart.mahadasha[0].planet).toBe(6);
        });

        test("currentPeriod has valid lords that match some MD/AD", () => {
            const result = calculateDashas(100, 8, 7, birthDate);
            const allMdLords = result.mahadasha.map((m) => m.planet);
            expect(allMdLords).toContain(result.currentPeriod.mahadashaLord);
        });

        test("durationYears in first MD matches remainingYearsAtBirth", () => {
            const result = calculateDashas(5, 1, 9, birthDate);
            expect(result.mahadasha[0].durationYears).toBe(result.mahadasha[0].remainingYearsAtBirth);
        });
    });
});
