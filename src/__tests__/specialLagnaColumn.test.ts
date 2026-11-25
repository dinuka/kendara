import { type HouseTableRow, withSpecialLagnas } from "@/lib/chartTableRows";
import { calculateInduLagna } from "@/lib/induLagna";
import { calculateVarnadaLagna } from "@/lib/varnadaLagna";

// Taurus lagna: house 1 = Taurus, house 12 = Aries.
const rows: HouseTableRow[] = Array.from({ length: 12 }, (_, i) => ({
    houseNumber: i + 1,
    sign: ((i + 1) % 12) + 1,
    planets: [],
    aspects: [],
}));
const base = { rows, available: new Set(["number" as const]) };
const lagnasIn = (data: ReturnType<typeof withSpecialLagnas>, sign: number) =>
    data.rows.find((r) => r.sign === sign)?.specialLagnas;

describe("withSpecialLagnas", () => {
    it("places Indu, Hora and Gulika (with degree) and Varnada Lagna in the rows of their signs", () => {
        const data = withSpecialLagnas(base, {
            ascendantSign: 2,
            moonSign: 5,
            horaLagna: { sign: 9, degree: 12.5 },
            gulikaLagna: { sign: 6, degree: 12.5889 },
        });
        expect(data.available.has("other")).toBe(true);

        const indu = calculateInduLagna(2, 5).sign;
        const varnada = calculateVarnadaLagna(2, 9).sign;
        expect(lagnasIn(data, indu)).toContainEqual({ key: "indu", degreeLabel: undefined });
        expect(lagnasIn(data, 9)).toContainEqual({ key: "hora", degreeLabel: "12:30:00" });
        expect(lagnasIn(data, varnada)).toContainEqual({ key: "varnada", degreeLabel: undefined });
        expect(lagnasIn(data, 6)).toContainEqual({ key: "gulika", degreeLabel: "12:35:20" });

        const total = data.rows.reduce((n, r) => n + (r.specialLagnas?.length ?? 0), 0);
        expect(total).toBe(4);
    });

    it("skips Hora/Varnada without a Hora Lagna, and Indu without the Moon's sign", () => {
        const data = withSpecialLagnas(base, { ascendantSign: 2 });
        expect(data.available.has("other")).toBe(true);
        expect(data.rows.every((r) => r.specialLagnas?.length === 0)).toBe(true);
    });
});
