import { composeAspectTooltip, formatSignedDelta, relativeAspectHouse } from "@/lib/aspectTooltip";
import type { AspectTooltipTokens } from "@/lib/aspectTooltip";
import type { Aspect } from "@/lib/astrology";

const SIGN_NAMES: Record<number, string> = {
    1: "Aries",
    2: "Taurus",
    3: "Gemini",
    4: "Cancer",
    5: "Leo",
    6: "Virgo",
    7: "Libra",
    8: "Scorpio",
    9: "Sagittarius",
    10: "Capricorn",
    11: "Aquarius",
    12: "Pisces",
};

const tokens: AspectTooltipTokens = {
    label: "Planet drishti",
    rashiLabel: "Rashi drishti",
    arrow: "→",
    getSignName: (sign) => SIGN_NAMES[sign] ?? `Sign ${sign}`,
};

const deltaCount = (text: string): number => (text.match(/\d{2}:\d{2}:\d{2}/g) ?? []).length;

const aspect = (overrides: Partial<Aspect>): Aspect => ({
    planetName: 7,
    aspectType: 0,
    planetAbsoluteDegree: 0,
    degreeGap: 0,
    exactAspectDegree: 0,
    isBeneficial: false,
    ...overrides,
});

describe("formatSignedDelta", () => {
    it("signs and zero-pads d:mm:ss per formatDegree (UX examples)", () => {
        expect(formatSignedDelta(2.0833)).toBe("+02:05:00");
        expect(formatSignedDelta(-0.758333)).toBe("-00:45:30");
        expect(formatSignedDelta(0)).toBe("+00:00:00");
    });
});

describe("relativeAspectHouse", () => {
    it("derives the relative house of the aspect point (UX §8.1.1)", () => {
        expect(relativeAspectHouse(30)).toBe(2);
        expect(relativeAspectHouse(60)).toBe(3);
        expect(relativeAspectHouse(180)).toBe(7);
        expect(relativeAspectHouse(330)).toBe(12);
        expect(relativeAspectHouse(0)).toBeNull();
    });
});

describe("composeAspectTooltip — single reason", () => {
    it("keeps the inline delta on a single planetary line: {label} {house} ({angle}) ({delta})", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 180,
                exactAspectDegree: 180,
                delta: 2.0833,
                reasons: [{ type: "planetary", angle: 180, delta: 2.0833 }],
            }),
        });
        expect(result.single).toBe(true);
        expect(result.lines).toEqual(["Planet drishti 7 (180) (+02:05:00)"]);
        expect(result.title).toBe("Planet drishti 7 (180) (+02:05:00)");
        expect(deltaCount(result.title)).toBe(1);
    });

    it("renders a single rashi line with the inline delta and no matched angle", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 60,
                exactAspectDegree: 60,
                delta: 2.0833,
                reasons: [{ type: "rashi", angle: 60, aspectedSign: 3, delta: 2.0833 }],
            }),
            aspectingSign: 1,
        });
        expect(result.single).toBe(true);
        expect(result.lines).toEqual(["Rashi drishti Aries → Gemini (+02:05:00)"]);
        expect(deltaCount(result.title)).toBe(1);
    });

    it("omits the {house} token for a conjunction (0°) — single reason", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 0,
                exactAspectDegree: 0,
                delta: 0.0833,
                reasons: [{ type: "planetary", angle: 0, delta: 0.0833 }],
            }),
        });
        expect(result.lines).toEqual(["Planet drishti (0) (+00:05:00)"]);
    });

    it("treats a legacy aspect (no reasons) as a single planetary line", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({ aspectType: 180, exactAspectDegree: 180, degreeGap: 2.0833 }),
        });
        expect(result.single).toBe(true);
        expect(result.lines).toEqual(["Planet drishti 7 (180) (+02:05:00)"]);
    });

    it("uses the aspected row house when supplied (houses table, §8.2)", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 180,
                exactAspectDegree: 180,
                delta: 2.0833,
                reasons: [{ type: "planetary", angle: 180, delta: 2.0833 }],
            }),
            house: 3,
        });
        expect(result.lines).toEqual(["Planet drishti 3 (180) (+02:05:00)"]);
    });
});

describe("composeAspectTooltip — multi reason", () => {
    it("renders one line per reason WITHOUT deltas plus one shared Δ footer (delta exactly once)", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 180,
                exactAspectDegree: 180,
                delta: 2.0833,
                reasons: [
                    { type: "planetary", angle: 180, delta: 2.0833 },
                    { type: "rashi", angle: 60, aspectedSign: 3, delta: 2.0833 },
                ],
            }),
            aspectingSign: 1,
        });
        expect(result.single).toBe(false);
        expect(result.lines).toEqual(["Planet drishti 7 (180)", "Rashi drishti Aries → Gemini"]);
        expect(result.lines.join("\n")).not.toMatch(/\d{2}:\d{2}:\d{2}/);
        expect(result.title).toBe("Planet drishti 7 (180)\nRashi drishti Aries → Gemini\nΔ +02:05:00");
        expect(deltaCount(result.title)).toBe(1);
    });

    it("scales to N reasons (planetary + 2 rashi) with exactly one footer", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 180,
                exactAspectDegree: 180,
                delta: 2.0833,
                reasons: [
                    { type: "planetary", angle: 180, delta: 2.0833 },
                    { type: "rashi", angle: 150, aspectedSign: 3, delta: 2.0833 },
                    { type: "rashi", angle: 210, aspectedSign: 11, delta: 2.0833 },
                ],
            }),
            aspectingSign: 5,
        });
        expect(result.lines).toEqual([
            "Planet drishti 7 (180)",
            "Rashi drishti Leo → Gemini",
            "Rashi drishti Leo → Aquarius",
        ]);
        expect(deltaCount(result.title)).toBe(1);
        expect(result.title).toContain("Δ +02:05:00");
    });

    it("orders planetary reasons before rashi reasons regardless of input order", () => {
        const result = composeAspectTooltip(tokens, {
            aspect: aspect({
                aspectType: 60,
                exactAspectDegree: 60,
                delta: 1,
                reasons: [
                    { type: "rashi", angle: 60, aspectedSign: 7, delta: 1 },
                    { type: "planetary", angle: 60, delta: 1 },
                ],
            }),
            aspectingSign: 4,
        });
        expect(result.lines[0]).toBe("Planet drishti 3 (60)");
        expect(result.lines[1]).toBe("Rashi drishti Cancer → Libra");
    });
});
