import type { House } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { SIGN_LORD } from "@/lib/manualChart";
import {
    SHADBALAYA_KEYS,
    ShadBalaPlanet,
    ShadBalaReason,
    ShadBalaValue,
    ShadBalaya,
    ShadBalayaContext,
    ShadBalayaKey,
    computeShadBalaya,
    deriveDay,
    isEnemySign,
    mergeShadBalaya,
} from "@/lib/shadBalaya";

const planet = (name: number, house: number, absoluteDegree = 0, o: Partial<ShadBalaPlanet> = {}): ShadBalaPlanet => ({
    name,
    house,
    absoluteDegree,
    sign: o.sign ?? ((house - 1) % 12) + 1,
    strength: PlanetaryStrength.SAMA,
    retrograde: false,
    ...o,
});

const house = (num: number, startSign: number, startDegree: number, endSign: number, endDegree: number): House => ({
    houseNumber: num,
    startDegree,
    startSign,
    startLord: SIGN_LORD[startSign] ?? 1,
    middleDegree: 0,
    middleSign: startSign,
    middleLord: SIGN_LORD[startSign] ?? 1,
    endDegree,
    endSign,
    endLord: SIGN_LORD[endSign] ?? 1,
    sign: startSign,
    lord: SIGN_LORD[startSign] ?? 1,
});

const wholeSignHouses = (): House[] =>
    Array.from({ length: 12 }, (_, i) => {
        const sign = i + 1;
        return house(sign, sign, 0, sign, 30);
    });

const balaOf = (result: ShadBalaya, planetName: number, bala: ShadBalayaKey): ShadBalaValue =>
    result[String(planetName)][bala];

const ctx = (overrides: Partial<ShadBalayaContext> = {}): ShadBalayaContext => ({
    source: "auto",
    ...overrides,
});

const allNine = (): ShadBalaPlanet[] => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => planet(n, n));

describe("isEnemySign", () => {
    test("Sun in Libra (lord Venus) is an enemy sign", () => {
        expect(isEnemySign(1, 7)).toBe(true);
    });

    test("Saturn in Aries (lord Mars) is an enemy sign", () => {
        expect(isEnemySign(7, 1)).toBe(true);
    });

    test("Mars in Cancer (lord Moon) is not an enemy sign", () => {
        expect(isEnemySign(3, 4)).toBe(false);
    });

    test("Moon has no enemies", () => {
        for (let sign = 1; sign <= 12; sign++) {
            expect(isEnemySign(2, sign)).toBe(false);
        }
    });
});

describe("Sthana Bala (UT-SB-001..010)", () => {
    test("UT-SB-001: Neecha AND Shatru → no bala (Sun in Libra)", () => {
        const result = computeShadBalaya(
            [planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.NEECHA })],
            [],
            ctx(),
        );
        expect(balaOf(result, 1, "sthanaBala").value).toBe(false);
        expect(balaOf(result, 1, "sthanaBala").reasons).toEqual([
            { key: "shadbalaya.sthana.reason.neecheShatru", params: { strength: -1, sign: 7 } },
        ]);
    });

    test("UT-SB-002: Neecha AND Shatru → no bala (Saturn in Aries)", () => {
        const result = computeShadBalaya(
            [planet(7, 1, 10, { sign: 1, strength: PlanetaryStrength.NEECHA })],
            [],
            ctx(),
        );
        expect(balaOf(result, 7, "sthanaBala").value).toBe(false);
        expect(balaOf(result, 7, "sthanaBala").reasons).toEqual([
            { key: "shadbalaya.sthana.reason.neecheShatru", params: { strength: -1, sign: 1 } },
        ]);
    });

    test("UT-SB-003: Athi Neecha AND Shatru → no bala", () => {
        const result = computeShadBalaya(
            [planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.ATHI_NEECHA })],
            [],
            ctx(),
        );
        expect(balaOf(result, 1, "sthanaBala").value).toBe(false);
        expect(balaOf(result, 1, "sthanaBala").reasons).toEqual([
            { key: "shadbalaya.sthana.reason.neecheShatru", params: { strength: -1.25, sign: 7 } },
        ]);
    });

    test("UT-SB-004: Neecha but NOT Shatru → has bala (Mars in Cancer)", () => {
        const result = computeShadBalaya(
            [planet(3, 4, 110, { sign: 4, strength: PlanetaryStrength.NEECHA })],
            [],
            ctx(),
        );
        expect(balaOf(result, 3, "sthanaBala").value).toBe(true);
    });

    test("UT-SB-005: Neecha but NOT Shatru → debilitated checked-state reason", () => {
        const result = computeShadBalaya(
            [planet(3, 4, 110, { sign: 4, strength: PlanetaryStrength.NEECHA })],
            [],
            ctx(),
        );
        const reasons = balaOf(result, 3, "sthanaBala").reasons;
        expect(reasons.length).toBeGreaterThan(0);
        expect(reasons[0].key).toBe("shadbalaya.sthana.reason.debilitated");
        expect(reasons[0].params).toEqual({ sign: 4 });
        expect(reasons.some((r) => r.key.includes("neeche"))).toBe(false);
    });

    test("UT-SB-006: Shatru but NOT Neecha → no bala with shatru reason", () => {
        const result = computeShadBalaya(
            [planet(7, 4, 110, { sign: 4, strength: PlanetaryStrength.SHATRU })],
            [],
            ctx(),
        );
        expect(balaOf(result, 7, "sthanaBala").value).toBe(false);
        expect(balaOf(result, 7, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.shatru" }]);
    });

    test("UT-SB-007: Uchcha → has bala with uchcha reason", () => {
        const result = computeShadBalaya(
            [planet(1, 1, 10, { sign: 1, strength: PlanetaryStrength.UCHCHA })],
            [],
            ctx(),
        );
        expect(balaOf(result, 1, "sthanaBala").value).toBe(true);
        expect(balaOf(result, 1, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.uchcha" }]);
    });

    test("UT-SB-008: Athi Uchcha / Moolatrikona / Own sign reasons", () => {
        const result = computeShadBalaya(
            [
                planet(1, 1, 10, { sign: 1, strength: PlanetaryStrength.ATHI_UCHCHA }),
                planet(4, 6, 170, { sign: 6, strength: PlanetaryStrength.MOOLATRIKONA }),
                planet(2, 2, 40, { sign: 2, strength: PlanetaryStrength.OWN_SIGN }),
            ],
            [],
            ctx(),
        );
        expect(balaOf(result, 1, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.athiUchcha" }]);
        expect(balaOf(result, 4, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.moolatrikona" }]);
        expect(balaOf(result, 2, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.ownSign" }]);
    });

    test("UT-SB-009: Mitra / Sama reasons", () => {
        const result = computeShadBalaya(
            [planet(5, 9, 260, { sign: 9, strength: PlanetaryStrength.MITRA }), planet(3, 5, 130, { sign: 5 })],
            [],
            ctx(),
        );
        expect(balaOf(result, 5, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.mitra" }]);
        expect(balaOf(result, 3, "sthanaBala").reasons).toEqual([{ key: "shadbalaya.sthana.reason.sama" }]);
    });

    test("UT-SB-010: rule applies to both sources", () => {
        const planets = [planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.NEECHA })];
        const auto = computeShadBalaya(planets, [], ctx());
        const manual = computeShadBalaya(planets, [], ctx({ source: "manual" }));
        expect(balaOf(manual, 1, "sthanaBala").value).toBe(balaOf(auto, 1, "sthanaBala").value);
        expect(balaOf(manual, 1, "sthanaBala").reasons).toEqual(balaOf(auto, 1, "sthanaBala").reasons);
    });
});

describe("Cheshta Bala (UT-SB-011..026)", () => {
    test("UT-SB-011: Ravi in Uttarayana sign, auto", () => {
        const result = computeShadBalaya([planet(1, 10, 285, { sign: 10 })], [], ctx({ thithi: 20 }));
        expect(balaOf(result, 1, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 1, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.uttarayana" }]);
    });

    test("UT-SB-012: Ravi in Uttarayana sign, manual → sign-based reason", () => {
        const result = computeShadBalaya([planet(1, 10, 285, { sign: 10 })], [], ctx({ source: "manual" }));
        expect(balaOf(result, 1, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 1, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.uttarayanaSign" }]);
    });

    test("UT-SB-013: Ravi in Dakshinayana sign, auto → false", () => {
        const result = computeShadBalaya([planet(1, 6, 165, { sign: 6 })], [], ctx({ thithi: 20 }));
        expect(balaOf(result, 1, "cheshtaBala").value).toBe(false);
    });

    test("UT-SB-014: Uttarayana boundary signs 10, 11, 12, 1, 2 all true", () => {
        for (const sign of [10, 11, 12, 1, 2]) {
            const result = computeShadBalaya([planet(1, sign, (sign - 1) * 30, { sign })], [], ctx({ thithi: 20 }));
            expect(balaOf(result, 1, "cheshtaBala").value).toBe(true);
        }
    });

    test("UT-SB-015: Moon in Shukla paksha (thithi 5)", () => {
        const result = computeShadBalaya([planet(2, 8, 230, { sign: 8 })], [], ctx({ thithi: 5 }));
        expect(balaOf(result, 2, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 2, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.shuklaPaksha" }]);
    });

    test("UT-SB-016: Moon in Shukla paksha boundary thithi 1 and 15", () => {
        for (const thithi of [1, 15]) {
            const result = computeShadBalaya([planet(2, 8, 230, { sign: 8 })], [], ctx({ thithi }));
            expect(balaOf(result, 2, "cheshtaBala").value).toBe(true);
        }
    });

    test("UT-SB-017: Moon in Krushna paksha (thithi 20) → false with krushnaPaksha reason", () => {
        const result = computeShadBalaya([planet(2, 8, 230, { sign: 8 })], [], ctx({ thithi: 20 }));
        expect(balaOf(result, 2, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 2, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.krushnaPaksha" }]);
    });

    test("UT-SB-018: Krushna boundary thithi 16 and 30", () => {
        for (const thithi of [16, 30]) {
            const result = computeShadBalaya([planet(2, 8, 230, { sign: 8 })], [], ctx({ thithi }));
            expect(balaOf(result, 2, "cheshtaBala").value).toBe(false);
        }
    });

    test("UT-SB-019: Kuja conjunct Shukla-paksha Chandra", () => {
        const result = computeShadBalaya(
            [planet(3, 4, 100, { sign: 4 }), planet(2, 4, 100, { sign: 4 })],
            [],
            ctx({ thithi: 5 }),
        );
        expect(balaOf(result, 3, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 3, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.shuklaChandra" }]);
    });

    test("UT-SB-020: same-sign conjunction for all five planets", () => {
        const planets = [
            planet(2, 8, 230, { sign: 8 }),
            planet(3, 8, 230, { sign: 8 }),
            planet(4, 8, 230, { sign: 8 }),
            planet(5, 8, 230, { sign: 8 }),
            planet(6, 8, 230, { sign: 8 }),
            planet(7, 8, 230, { sign: 8 }),
        ];
        const result = computeShadBalaya(planets, [], ctx({ thithi: 5 }));
        for (const name of [3, 4, 5, 6, 7]) {
            expect(balaOf(result, name, "cheshtaBala").value).toBe(true);
            expect(balaOf(result, name, "cheshtaBala").reasons).toEqual([
                { key: "shadbalaya.cheshta.reason.shuklaChandra" },
            ]);
        }
    });

    test("UT-SB-021: no conjunction (different sign)", () => {
        const result = computeShadBalaya(
            [planet(3, 4, 100, { sign: 4 }), planet(2, 5, 130, { sign: 5 })],
            [],
            ctx({ thithi: 5 }),
        );
        expect(balaOf(result, 3, "cheshtaBala").value).toBe(false);
    });

    test("UT-SB-022: Shukla-Chandra not applied when Moon in Krushna paksha", () => {
        const result = computeShadBalaya(
            [planet(3, 4, 100, { sign: 4 }), planet(2, 4, 100, { sign: 4 })],
            [],
            ctx({ thithi: 20 }),
        );
        expect(balaOf(result, 3, "cheshtaBala").value).toBe(false);
    });

    test("UT-SB-023: Vakra (retrograde) planet", () => {
        const result = computeShadBalaya([planet(7, 3, 80, { sign: 3, retrograde: true })], [], ctx({ thithi: 20 }));
        expect(balaOf(result, 7, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 7, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.vakra" }]);
    });

    test("UT-SB-023b: Rahu/Ketu natural retrograde → NOT vakra (no Cheshta bala)", () => {
        const result = computeShadBalaya(
            [planet(8, 1, 10, { sign: 1, retrograde: true }), planet(9, 2, 40, { sign: 2, retrograde: true })],
            [],
            ctx({ thithi: 20 }),
        );
        expect(balaOf(result, 8, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 8, "cheshtaBala").reasons).toEqual([]);
        expect(balaOf(result, 9, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 9, "cheshtaBala").reasons).toEqual([]);
    });

    test("UT-SB-023c: Rahu/Ketu in direct (opposite) motion → vakra", () => {
        const result = computeShadBalaya(
            [planet(8, 1, 10, { sign: 1, retrograde: false }), planet(9, 2, 40, { sign: 2, retrograde: false })],
            [],
            ctx({ thithi: 20 }),
        );
        expect(balaOf(result, 8, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 8, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.vakra" }]);
        expect(balaOf(result, 9, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 9, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.vakra" }]);
    });

    test("UT-SB-023d: Rahu/Ketu never gain Shukla-Chandra conjunction Cheshta bala", () => {
        const result = computeShadBalaya(
            [
                planet(2, 4, 100, { sign: 4 }),
                planet(8, 4, 100, { sign: 4, retrograde: true }),
                planet(9, 4, 100, { sign: 4, retrograde: true }),
            ],
            [],
            ctx({ thithi: 5 }),
        );
        expect(balaOf(result, 8, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 8, "cheshtaBala").reasons).toEqual([]);
        expect(balaOf(result, 9, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 9, "cheshtaBala").reasons).toEqual([]);
    });

    test("UT-SB-024: multiple conditions → every reason listed", () => {
        const result = computeShadBalaya(
            [planet(7, 4, 110, { sign: 4, retrograde: true }), planet(2, 4, 100, { sign: 4 })],
            [],
            ctx({ thithi: 5 }),
        );
        const reasons = balaOf(result, 7, "cheshtaBala").reasons.map((r) => r.key);
        expect(reasons).toContain("shadbalaya.cheshta.reason.vakra");
        expect(reasons).toContain("shadbalaya.cheshta.reason.shuklaChandra");
    });

    test("UT-SB-025: war-winner never emitted when hook absent", () => {
        const result = computeShadBalaya([planet(3, 1, 10)], [], ctx({}));
        const allKeys = allReasons(result).map((r) => r.key);
        expect(allKeys).not.toContain("shadbalaya.cheshta.reason.warWinner");
    });

    test("UT-SB-026: war-winner hook gates correctly", () => {
        const result = computeShadBalaya([planet(3, 1, 10)], [], ctx({ warWinnerPlanet: 3 }));
        expect(balaOf(result, 3, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 3, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.warWinner" }]);
    });
});

describe("Kala Bala (UT-SB-027..036)", () => {
    test("UT-SB-027: night birth — Chandra/Kuja/Shani checked, others not night-checked", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: false, thithi: 20 }));
        for (const name of [2, 3, 7]) {
            expect(balaOf(result, name, "kalaBala").value).toBe(true);
            expect(balaOf(result, name, "kalaBala").reasons.map((r) => r.key)).toContain(
                "shadbalaya.kala.reason.night",
            );
        }
        expect(balaOf(result, 4, "kalaBala").value).toBe(false);
        expect(balaOf(result, 8, "kalaBala").value).toBe(true);
        expect(balaOf(result, 8, "kalaBala").reasons.map((r) => r.key)).toContain(
            "shadbalaya.kala.reason.krushnaPaksha",
        );
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons.map((r) => r.key)).not.toContain("shadbalaya.kala.reason.night");
    });

    test("UT-SB-028: day birth — Ravi/Guru/Sikuru checked (krushna paksha thithi, so Ravi's day is not suppressed)", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: true, thithi: 20 }));
        for (const name of [1, 5, 6]) {
            expect(balaOf(result, name, "kalaBala").value).toBe(true);
            expect(balaOf(result, name, "kalaBala").reasons.map((r) => r.key)).toContain("shadbalaya.kala.reason.day");
        }
    });

    test("UT-SB-029: Shukla paksha — Budha/Guru/Sikuru/Rahu checked, Ravi never", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: true, thithi: 5 }));
        for (const name of [4, 5, 6, 8]) {
            expect(balaOf(result, name, "kalaBala").value).toBe(true);
            expect(balaOf(result, name, "kalaBala").reasons.map((r) => r.key)).toContain(
                "shadbalaya.kala.reason.shuklaPaksha",
            );
        }
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
    });

    test("UT-SB-029b: Ravi gets no Kala bala during Shukla paksha even on a day birth", () => {
        const result = computeShadBalaya([planet(1, 3, 80)], [], ctx({ day: true, thithi: 5 }));
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
        const krushna = computeShadBalaya([planet(1, 3, 80)], [], ctx({ day: true, thithi: 16 }));
        expect(balaOf(krushna, 1, "kalaBala").value).toBe(true);
    });

    test("UT-SB-029c: Krushna paksha — Ravi never checked (night-birth regression from live horoscope)", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: false, thithi: 27 }));
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
        expect(balaOf(result, 8, "kalaBala").value).toBe(true);
        expect(balaOf(result, 8, "kalaBala").reasons.map((r) => r.key)).toContain(
            "shadbalaya.kala.reason.krushnaPaksha",
        );
    });

    test("UT-SB-030: Krushna paksha — Kuja/Shani/Rahu checked, Ravi never", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ thithi: 20 }));
        for (const name of [3, 7, 8]) {
            expect(balaOf(result, name, "kalaBala").value).toBe(true);
            expect(balaOf(result, name, "kalaBala").reasons.map((r) => r.key)).toContain(
                "shadbalaya.kala.reason.krushnaPaksha",
            );
        }
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
    });

    test("UT-SB-031: paksha boundary thithi 15 vs 16 for Budha", () => {
        const shukla = computeShadBalaya([planet(4, 5, 130)], [], ctx({ thithi: 15 }));
        const krushna = computeShadBalaya([planet(4, 5, 130)], [], ctx({ thithi: 16 }));
        expect(balaOf(shukla, 4, "kalaBala").value).toBe(true);
        expect(balaOf(krushna, 4, "kalaBala").value).toBe(false);
    });

    test("UT-SB-032: any-one-condition suffices — day + Shukla overlap for Guru", () => {
        const result = computeShadBalaya([planet(5, 1, 10)], [], ctx({ day: true, thithi: 5 }));
        expect(balaOf(result, 5, "kalaBala").value).toBe(true);
        const reasonKeys = balaOf(result, 5, "kalaBala").reasons.map((r) => r.key);
        expect(reasonKeys).toContain("shadbalaya.kala.reason.day");
        expect(reasonKeys).toContain("shadbalaya.kala.reason.shuklaPaksha");
    });

    test("UT-SB-033: varga-load never computed in v1", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: true, thithi: 5 }));
        const allKeys = allReasons(result).map((r) => r.key);
        expect(allKeys).not.toContain("shadbalaya.kala.reason.vargaLoad");
    });

    test("UT-SB-034: manual without day — day/night skipped", () => {
        const result = computeShadBalaya([planet(3, 4, 110)], [], ctx({ source: "manual", thithi: 5 }));
        expect(balaOf(result, 3, "kalaBala").value).toBe(false);
        expect(balaOf(result, 3, "kalaBala").reasons).toEqual([]);
    });

    test("UT-SB-035: manual with day supplied — day/night computed", () => {
        const result = computeShadBalaya([planet(7, 7, 190)], [], ctx({ source: "manual", day: false, thithi: 5 }));
        expect(balaOf(result, 7, "kalaBala").value).toBe(true);
        expect(balaOf(result, 7, "kalaBala").reasons).toEqual([{ key: "shadbalaya.kala.reason.night" }]);
    });

    test("UT-SB-036: deriveDay from Sun whole-sign Rashi house (7-12 day, house 7 inclusive)", () => {
        expect(deriveDay([planet(1, 10, 285)])).toBe(true);
        expect(deriveDay([planet(1, 6, 165)])).toBe(false);
        expect(deriveDay([planet(1, 7, 190)])).toBe(true);
        expect(deriveDay([planet(1, 1, 10)])).toBe(false);
        expect(deriveDay([] as ShadBalaPlanet[])).toBe(true);
    });
});

describe("Dig Bala (UT-SB-037..043)", () => {
    test("UT-SB-037: Guru/Budha in 1st house", () => {
        const result = computeShadBalaya([planet(5, 1, 15), planet(4, 1, 15)], [], ctx());
        expect(balaOf(result, 5, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 1 } },
        ]);
        expect(balaOf(result, 4, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 1 } },
        ]);
    });

    test("UT-SB-038: Kuja/Ravi in 10th house", () => {
        const result = computeShadBalaya([planet(3, 10, 285), planet(1, 10, 285)], [], ctx());
        expect(balaOf(result, 3, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 10 } },
        ]);
        expect(balaOf(result, 1, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 10 } },
        ]);
    });

    test("UT-SB-039: Chandra/Shukra in 4th house", () => {
        const result = computeShadBalaya([planet(2, 4, 100), planet(6, 4, 100)], [], ctx());
        expect(balaOf(result, 2, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 4 } },
        ]);
        expect(balaOf(result, 6, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 4 } },
        ]);
    });

    test("UT-SB-040: Shani in 7th house", () => {
        const result = computeShadBalaya([planet(7, 7, 190)], [], ctx());
        expect(balaOf(result, 7, "digBala").value).toBe(true);
        expect(balaOf(result, 7, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 7 } },
        ]);
    });

    test("UT-SB-041: directional planet in a different house", () => {
        const result = computeShadBalaya([planet(5, 5, 130)], [], ctx());
        expect(balaOf(result, 5, "digBala").value).toBe(false);
    });

    test("UT-SB-042: Rahu/Ketu never have dig bala", () => {
        for (const h of [1, 10, 4, 7]) {
            const result = computeShadBalaya([planet(8, h, (h - 1) * 30), planet(9, h, (h - 1) * 30)], [], ctx());
            expect(balaOf(result, 8, "digBala").value).toBe(false);
            expect(balaOf(result, 8, "digBala").reasons).toEqual([]);
            expect(balaOf(result, 9, "digBala").value).toBe(false);
        }
    });

    test("UT-SB-043: house source is the whole-sign p.house, ignoring cusp boundaries", () => {
        // Guru's whole-sign house is 3 (p.house). Even though absolute degree 15 falls in house 1 by
        // cusp boundaries, dig bala is evaluated against the Rashi location (house 3), so Guru gets
        // no dig bala. This holds for both auto and manual sources.
        const houses = wholeSignHouses();
        const guruInHouse3 = planet(5, 3, 15);
        const auto = computeShadBalaya([guruInHouse3], houses, ctx());
        expect(balaOf(auto, 5, "digBala").value).toBe(false);
        expect(balaOf(auto, 5, "digBala").reasons).toEqual([]);

        const manual = computeShadBalaya([guruInHouse3], houses, ctx({ source: "manual" }));
        expect(balaOf(manual, 5, "digBala").value).toBe(false);
        expect(balaOf(manual, 5, "digBala").reasons).toEqual([]);

        // Guru in whole-sign house 1 -> dig bala.
        const guruInHouse1 = planet(5, 1, 15);
        const inHouse1 = computeShadBalaya([guruInHouse1], houses, ctx());
        expect(balaOf(inHouse1, 5, "digBala").value).toBe(true);
        expect(balaOf(inHouse1, 5, "digBala").reasons).toEqual([
            { key: "shadbalaya.dig.reason.house", params: { house: 1 } },
        ]);
    });
});

describe("Naisargika Bala (UT-SB-044..048)", () => {
    const maranakarakaHouses = [house(1, 1, 0, 1, 30), house(2, 3, 0, 3, 30), house(8, 2, 0, 2, 30)];

    test("UT-SB-044: maranakaraka planet unchecked with triggering house", () => {
        const result = computeShadBalaya([planet(2, 8, 37)], maranakarakaHouses, ctx({ maranakaraka: [2] }));
        expect(balaOf(result, 2, "naisargikaBala").value).toBe(false);
        expect(balaOf(result, 2, "naisargikaBala").reasons).toEqual([
            { key: "shadbalaya.naisargika.reason.maranakaraka", params: { house: 8 } },
        ]);
    });

    test("UT-SB-045: all other planets checked with notMaranakaraka reason", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ maranakaraka: [2] }));
        for (let name = 1; name <= 9; name++) {
            const bala = balaOf(result, name, "naisargikaBala");
            expect(bala.value).toBe(name !== 2);
            if (name !== 2) {
                expect(bala.reasons).toEqual([{ key: "shadbalaya.naisargika.reason.notMaranakaraka" }]);
            }
        }
    });

    test("UT-SB-046: no maranakaraka → all checked", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ maranakaraka: [] }));
        for (let name = 1; name <= 9; name++) {
            expect(balaOf(result, name, "naisargikaBala").value).toBe(true);
        }

        const noRule = computeShadBalaya([planet(2, 7), planet(1, 1), planet(8, 1)], [], ctx());
        expect(balaOf(noRule, 2, "naisargikaBala").value).toBe(true);
        expect(balaOf(noRule, 1, "naisargikaBala").value).toBe(true);
    });

    test("UT-SB-047: ctx.maranakaraka falls back to computeMaranakaraka(planets)", () => {
        const result = computeShadBalaya([planet(2, 8, 37)], maranakarakaHouses, ctx());
        expect(balaOf(result, 2, "naisargikaBala").value).toBe(false);
    });

    test("UT-SB-048: manual path uses stored resolved maranakaraka", () => {
        const result = computeShadBalaya([planet(2, 8, 230)], [], ctx({ source: "manual", maranakaraka: [2] }));
        expect(balaOf(result, 2, "naisargikaBala").value).toBe(false);
        expect(balaOf(result, 2, "naisargikaBala").reasons).toEqual([
            { key: "shadbalaya.naisargika.reason.maranakaraka", params: { house: 8 } },
        ]);
    });

    test("UT-SB-048b: multiple maranakarakas each unchecked (Budha in 4th + Guru in 3rd)", () => {
        const result = computeShadBalaya(
            [planet(4, 4, 105), planet(5, 3, 80), planet(2, 8, 37)],
            [],
            ctx({ maranakaraka: [4, 5] }),
        );
        expect(balaOf(result, 4, "naisargikaBala").value).toBe(false);
        expect(balaOf(result, 5, "naisargikaBala").value).toBe(false);
        expect(balaOf(result, 2, "naisargikaBala").value).toBe(true);
    });
});

describe("Drishti Bala (UT-SB-049..050)", () => {
    test("UT-SB-049: never auto-checked, both sources", () => {
        for (const source of ["auto", "manual"] as const) {
            const result = computeShadBalaya(allNine(), [], ctx({ source }));
            for (let name = 1; name <= 9; name++) {
                expect(balaOf(result, name, "drishtiBala").value).toBe(false);
                expect(balaOf(result, name, "drishtiBala").reasons).toEqual([
                    { key: "shadbalaya.drishti.reason.manual" },
                ]);
            }
        }
    });

    test("UT-SB-050: no code path sets drishti true", () => {
        const results = [
            computeShadBalaya(allNine(), [], ctx({ day: true, thithi: 5 })),
            computeShadBalaya(allNine(), [], ctx({ day: false, thithi: 20 })),
            computeShadBalaya([planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.NEECHA })], [], ctx()),
        ];
        for (const result of results) {
            for (let name = 1; name <= 9; name++) {
                expect(balaOf(result, name, "drishtiBala").value).toBe(false);
            }
        }
    });
});

describe("mergeShadBalaya (UT-SB-051..060)", () => {
    const computed = computeShadBalaya(allNine(), [], ctx({ thithi: 5, day: true }));

    test("UT-SB-051: overridden bala preserved (value + reasons from stored)", () => {
        const stored = {
            "3": {
                ...computed["3"],
                kalaBala: {
                    value: false,
                    overridden: true,
                    reasons: [{ key: "shadbalaya.kala.reason.manual" }],
                },
            },
        };
        const merged = mergeShadBalaya(computed, stored);
        expect(merged["3"].kalaBala.value).toBe(false);
        expect(merged["3"].kalaBala.overridden).toBe(true);
        expect(merged["3"].kalaBala.reasons).toEqual([{ key: "shadbalaya.kala.reason.manual" }]);
    });

    test("UT-SB-052: non-overridden bala recomputed", () => {
        const stored = {
            "1": {
                ...computed["1"],
                sthanaBala: { value: false, overridden: false, reasons: [{ key: "shadbalaya.sthana.reason.sama" }] },
            },
        };
        const merged = mergeShadBalaya(computed, stored);
        expect(merged["1"].sthanaBala.value).toBe(computed["1"].sthanaBala.value);
    });

    test("UT-SB-053: absent stored → computed used", () => {
        expect(mergeShadBalaya(computed, null)).toEqual(computed);
        expect(mergeShadBalaya(computed, {})).toEqual(computed);
    });

    test("UT-SB-054: sparse stored record → that bala stored, other 53 computed", () => {
        const stored = {
            "3": {
                ...computed["3"],
                cheshtaBala: { value: true, overridden: true, reasons: [] },
            },
        };
        const merged = mergeShadBalaya(computed, stored);
        expect(merged["3"].cheshtaBala).toEqual({ value: true, overridden: true, reasons: [] });
        const otherCells = SHADBALAYA_KEYS.filter((k) => k !== "cheshtaBala");
        for (const bala of otherCells) {
            expect(merged["3"][bala]).toEqual(computed["3"][bala]);
        }
        for (let name = 1; name <= 9; name++) {
            if (name === 3) continue;
            expect(merged[String(name)]).toEqual(computed[String(name)]);
        }
    });

    test("UT-SB-055: overridden sticky even when value equals computed", () => {
        const stored = {
            "5": {
                ...computed["5"],
                kalaBala: { value: true, overridden: true, reasons: [] },
            },
        };
        const merged = mergeShadBalaya(computed, stored);
        expect(merged["5"].kalaBala.value).toBe(true);
        expect(merged["5"].kalaBala.overridden).toBe(true);
    });

    test("UT-SB-056: ratio not part of merge/storage", () => {
        const merged = mergeShadBalaya(computed, {
            "3": { ...computed["3"], kalaBala: { value: true, overridden: true, reasons: [] } },
        });
        const json = JSON.stringify(merged).toLowerCase();
        expect(json).not.toContain("ratio");
        expect(json).not.toContain("anupatha");
    });

    test("UT-SB-057: ctx.thithi falls back to computeThithiFromPlanets", () => {
        const planets = [planet(1, 1, 10), planet(2, 2, 25)];
        const result = computeShadBalaya(planets, [], ctx({ day: true }));
        expect(balaOf(result, 2, "cheshtaBala").value).toBe(true);
        expect(balaOf(result, 2, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.shuklaPaksha" }]);
    });

    test("UT-SB-058: no Sun/Moon → thithi 1 (Moon Cheshta checked)", () => {
        const result = computeShadBalaya([planet(3, 1, 10)], [], ctx({}));
        expect(balaOf(result, 2, "cheshtaBala").value).toBe(true);
    });

    test("UT-SB-059: output shape contract", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ thithi: 5 }));
        expect(Object.keys(result).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
        for (let name = 1; name <= 9; name++) {
            const perPlanet = result[String(name)];
            expect(Object.keys(perPlanet).sort()).toEqual([...SHADBALAYA_KEYS].sort());
            for (const bala of SHADBALAYA_KEYS) {
                const cell = perPlanet[bala];
                expect(typeof cell.value).toBe("boolean");
                expect(cell.overridden).toBe(false);
                expect(Array.isArray(cell.reasons)).toBe(true);
            }
        }
    });

    test("UT-SB-060: determinism", () => {
        const planets = [
            planet(1, 7, 190, { sign: 7, strength: PlanetaryStrength.NEECHA }),
            planet(5, 1, 15),
            planet(2, 8, 230),
        ];
        const a = computeShadBalaya(planets, wholeSignHouses(), ctx({ thithi: 5, day: true }));
        const b = computeShadBalaya(planets, wholeSignHouses(), ctx({ thithi: 5, day: true }));
        expect(a).toEqual(b);
    });
});

describe("Fixture highlights (FIX-A..K)", () => {
    test("FIX-D: Moon maranakaraka in house 8 → unchecked, others checked", () => {
        const houses = [house(1, 1, 0, 1, 30), house(2, 3, 0, 3, 30), house(8, 2, 0, 2, 30)];
        const result = computeShadBalaya(
            allNine().map((p) => (p.name === 2 ? { ...p, house: 8, absoluteDegree: 37 } : p)),
            houses,
            ctx({ maranakaraka: [2] }),
        );
        expect(balaOf(result, 2, "naisargikaBala").value).toBe(false);
        for (let name = 1; name <= 9; name++) {
            if (name !== 2) expect(balaOf(result, name, "naisargikaBala").value).toBe(true);
        }
    });

    test("FIX-F: Ravi Cheshta uttarayana; Ravi Kala suppressed during Shukla; Moon shuklaPaksha; Guru/Sikuru Kala day+shukla", () => {
        const planets = [
            planet(1, 10, 285, { sign: 10 }),
            planet(2, 8, 230, { sign: 8 }),
            planet(5, 1, 15),
            planet(6, 4, 100),
        ];
        const result = computeShadBalaya(planets, [], ctx({ day: true, thithi: 5 }));
        expect(balaOf(result, 1, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.uttarayana" }]);
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
        expect(balaOf(result, 2, "cheshtaBala").reasons).toEqual([{ key: "shadbalaya.cheshta.reason.shuklaPaksha" }]);
        const guruKala = balaOf(result, 5, "kalaBala").reasons.map((r) => r.key);
        expect(guruKala).toContain("shadbalaya.kala.reason.day");
        expect(guruKala).toContain("shadbalaya.kala.reason.shuklaPaksha");
    });

    test("FIX-G: night birth thithi 20 — Kuja/Shani night + krushna, Chandra night only", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ day: false, thithi: 20 }));
        for (const name of [3, 7]) {
            const reasonKeys = balaOf(result, name, "kalaBala").reasons.map((r) => r.key);
            expect(reasonKeys).toContain("shadbalaya.kala.reason.night");
            expect(reasonKeys).toContain("shadbalaya.kala.reason.krushnaPaksha");
        }
        expect(balaOf(result, 2, "kalaBala").reasons).toEqual([{ key: "shadbalaya.kala.reason.night" }]);
    });

    test("FIX-J: manual no day — Ravi sign 6 Cheshta false, Kala fully empty (Ravi excluded from Krushna too), Drishti manual", () => {
        const result = computeShadBalaya([planet(1, 6, 165, { sign: 6 })], [], ctx({ source: "manual", thithi: 20 }));
        expect(balaOf(result, 1, "cheshtaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").value).toBe(false);
        expect(balaOf(result, 1, "kalaBala").reasons).toEqual([]);
        expect(balaOf(result, 1, "drishtiBala").reasons).toEqual([{ key: "shadbalaya.drishti.reason.manual" }]);
    });

    test("FIX-K: legacy doc merge with undefined stored", () => {
        const result = computeShadBalaya(allNine(), [], ctx({ thithi: 5 }));
        expect(mergeShadBalaya(result, undefined)).toEqual(result);
    });
});

function allReasons(result: ShadBalaya): ShadBalaReason[] {
    const reasons: ShadBalaReason[] = [];
    for (let name = 1; name <= 9; name++) {
        for (const bala of SHADBALAYA_KEYS) {
            reasons.push(...result[String(name)][bala].reasons);
        }
    }
    return reasons;
}
