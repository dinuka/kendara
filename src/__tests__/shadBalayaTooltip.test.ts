import { ShadBalaReason } from "@/lib/shadBalaya";
import { composeShadBalaAriaLabel, composeShadBalaRatioAria, composeShadBalaTooltip } from "@/lib/shadBalayaTooltip";

const messages: Record<string, string> = {
    "astrology.shadbalaya.balaNames.sthanaBala": "Sthana Bala",
    "astrology.shadbalaya.balaNames.cheshtaBala": "Cheshta Bala",
    "astrology.shadbalaya.balaNames.digBala": "Dig Bala",
    "astrology.shadbalaya.balaNames.drishtiBala": "Drishti Bala",
    "astrology.shadbalaya.tooltip.checked": "✓ Checked because:",
    "astrology.shadbalaya.tooltip.unchecked": "✗ Unchecked because:",
    "astrology.shadbalaya.sthana.reason.uchcha": "Exalted (Uchcha)",
    "astrology.shadbalaya.sthana.reason.neecheShatru": "Debilitated (Neecha) in the enemy sign {sign}",
    "astrology.shadbalaya.sthana.reason.debilitated": "Debilitated (Neecha) in {sign}",
    "astrology.shadbalaya.cheshta.reason.vakra": "Retrograde (Vakra)",
    "astrology.shadbalaya.cheshta.reason.shuklaChandra": "Conjunct the Moon in Shukla Paksha",
    "astrology.shadbalaya.dig.reason.house": "In the directional house {house}",
    "astrology.shadbalaya.drishti.reason.manual": "Set manually — the system cannot calculate Drishti bala",
    "astrology.shadbalaya.reason.manual": "Set manually — the system cannot calculate this",
    "astrology.shadbalaya.override.footer": "Set manually — kept through recalculation",
    "astrology.shadbalaya.override.ariaShort": "set manually",
    "astrology.shadbalaya.checkbox.ariaChecked": "{planet} {bala} — checked",
    "astrology.shadbalaya.checkbox.ariaUnchecked": "{planet} {bala} — unchecked",
    "astrology.shadbalaya.ratioAria": "{planet} — {n} of 6 balas",
};

const t = (key: string, params: Record<string, string | number> = {}): string =>
    Object.entries(params).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), messages[key] ?? key);

const getSignName = (sign: number): string => `sign-${sign}`;
const getPlanetName = (planet: number): string => `planet-${planet}`;

const data = (overrides: Partial<Parameters<typeof composeShadBalaTooltip>[1]> = {}) => ({
    planet: 1,
    bala: "sthanaBala",
    value: true,
    overridden: false,
    reasons: [] as ShadBalaReason[],
    ...overrides,
});

describe("composeShadBalaTooltip", () => {
    test("UI-SB-150: checked reason tooltip", () => {
        const result = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({ value: true, reasons: [{ key: "shadbalaya.sthana.reason.uchcha" }] }),
        );
        expect(result.heading).toBe("Sthana Bala");
        expect(result.stateLine).toBe("✓ Checked because:");
        expect(result.lines).toEqual(["Exalted (Uchcha)"]);
        expect(result.overrideFooter).toBeUndefined();
        expect(result.title).toBe("Sthana Bala\n✓ Checked because:\nExalted (Uchcha)");
    });

    test("UI-SB-151: unchecked neecheShatru reason with sign name param", () => {
        const result = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({
                bala: "sthanaBala",
                value: false,
                reasons: [{ key: "shadbalaya.sthana.reason.neecheShatru", params: { strength: -1, sign: 7 } }],
            }),
        );
        expect(result.stateLine).toBe("✗ Unchecked because:");
        expect(result.lines).toEqual(["Debilitated (Neecha) in the enemy sign sign-7"]);
    });

    test("UI-SB-152: multi-reason + override footer", () => {
        const result = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({
                bala: "cheshtaBala",
                value: true,
                overridden: true,
                reasons: [
                    { key: "shadbalaya.cheshta.reason.vakra" },
                    { key: "shadbalaya.cheshta.reason.shuklaChandra" },
                ],
            }),
        );
        expect(result.lines).toEqual(["Retrograde (Vakra)", "Conjunct the Moon in Shukla Paksha"]);
        expect(result.overrideFooter).toBe("Set manually — kept through recalculation");
        expect(result.title).toContain("Set manually — kept through recalculation");
    });

    test("UI-SB-153: manual-state reason (drishti) and generic manual fallback", () => {
        const drishti = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({
                bala: "drishtiBala",
                value: false,
                reasons: [{ key: "shadbalaya.drishti.reason.manual" }],
            }),
        );
        expect(drishti.lines).toEqual(["Set manually — the system cannot calculate Drishti bala"]);

        const rahuDig = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({ bala: "digBala", value: false, reasons: [] }),
        );
        expect(rahuDig.lines).toEqual(["Set manually — the system cannot calculate this"]);
    });

    test("dig house reason passes house param through", () => {
        const result = composeShadBalaTooltip(
            { t, getSignName, getPlanetName },
            data({ bala: "digBala", reasons: [{ key: "shadbalaya.dig.reason.house", params: { house: 10 } }] }),
        );
        expect(result.lines).toEqual(["In the directional house 10"]);
    });
});

describe("composeShadBalaAriaLabel", () => {
    test("checked without override", () => {
        expect(
            composeShadBalaAriaLabel(t, getPlanetName, {
                planet: 1,
                bala: "sthanaBala",
                value: true,
                overridden: false,
            }),
        ).toBe("planet-1 Sthana Bala — checked");
    });

    test("unchecked with override suffix", () => {
        expect(
            composeShadBalaAriaLabel(t, getPlanetName, {
                planet: 7,
                bala: "cheshtaBala",
                value: false,
                overridden: true,
            }),
        ).toBe("planet-7 Cheshta Bala — unchecked, set manually");
    });
});

describe("composeShadBalaRatioAria", () => {
    test("AX-SB-197: ratio aria label", () => {
        expect(composeShadBalaRatioAria(t, getPlanetName, 1, 3)).toBe("planet-1 — 3 of 6 balas");
    });
});
