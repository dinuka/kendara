/** @jest-environment jsdom */
/**
 * Yoga / Dosha separated tags — component tests (RTL + jsdom, per-file environment override).
 * QA plan: specs/qa/20260906-0837-yoga-dosha-tags-test-plan.md (AX-YD-600..607, UI-YD-500..538).
 * useI18n is stubbed with a flat message map — locale toggling is covered by the hook tests.
 *
 * Shani-Mangala evaluates as a DOSHA ("Shani Mangala Dosha"), so the engine fixture below is a
 * DoshaEvaluation and the Yoga group stays empty (only the unknown-chip case yields a yoga tag).
 */
import YogaDoshaSection from "@/components/yogaDosha/YogaDoshaSection";

import { CancellationStatus, PlanetaryStrength, YogaStrength } from "@/lib/astrologyEnums";
import { buildChartFacts, computeYogaDoshas } from "@/lib/yogaDosha/ruleEngine";
import { DoshaEvaluation, YogaDoshaResult, YogaEvaluation } from "@/lib/yogaDosha/types";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("@/hooks/useI18n", () => {
    const MESSAGES: Record<string, string> = {
        "yogaDosha.title": "Yogas & Doshas",
        "yogaDosha.infoGlyph": "How to read these tags",
        "yogaDosha.yogaGroup": "Yogas",
        "yogaDosha.doshaGroup": "Doshas",
        "yogaDosha.groupYogaAria": "Yogas",
        "yogaDosha.groupDoshaAria": "Doshas",
        "yogaDosha.countLabel": "({count})",
        "yogaDosha.emptyYogas": "No yogas detected in this chart.",
        "yogaDosha.emptyDoshas": "No doshas detected in this chart.",
        "yogaDosha.unknownName": "not available",
        "yogaDosha.houseHeading": "House {house}",
        "yogaDosha.itemGroup": "General",
        "yogaDosha.whyItForms": "Why it forms",
        "yogaDosha.result": "Result",
        "yogaDosha.expression": "Expression",
        "yogaDosha.cancellation": "Cancellation",
        "yogaDosha.mitigation": "Mitigation",
        "yogaDosha.mitigationNote": "Mitigation softens the effect — it does not cancel.",
        "yogaStrength.1": "Very strong",
        "yogaStrength.2": "Strong",
        "yogaStrength.3": "Moderate",
        "yogaStrength.4": "Weak",
        "cancellationStatus.1": "Not cancelled",
        "cancellationStatus.2": "Cancelled",
        "cancellationStatus.3": "Mitigated",
        "tradition.MAIN_STREAM": "Mainstream",
        "dosha.shaniMangala.name": "Shani Mangala Dosha",
        "dosha.shaniMangala.rule.sm01": "Saturn and Mars occupy house {house} together.",
        "dosha.shaniMangala.theme.house7": "Relates to partnerships; stamina in close bonds.",
        "dosha.shaniMangala.expression.main": "A testing but transformative union.",
        "dosha.shaniMangala.dashaNote": "These periods may surface the themes above.",
        "dosha.shaniMangala.mitigation.sm-mit-001": "Jupiter's aspect softens the union.",
        "dosha.manglik.name": "Manglik",
        "dosha.manglik.rule.mk01": "Mars occupies house {house} from the lagna.",
        "dosha.manglik.theme.house7": "A challenging note in partnerships.",
        "dosha.manglik.expression.partnershipStress": "Partnership stress indicator.",
        "dosha.manglik.mitigation.mk-mit-001": "Jupiter's aspect mitigates the dosha.",
        "yoga.dharmaKarmadhipati.name": "Dharma Karmadhipati Yoga",
        "yoga.deeptaYoga.classification.Guru": "Guru Deeptha Yoga",
        "yoga.deeptaYoga.classification.Kuja": "Kuja Deeptha Yoga",
        "yoga.deeptaYoga.expression.Guru":
            "Wealth is gained, renown and praise come, and advisory services are provided.",
    };

    return {
        useI18n: () => ({
            locale: "en",
            setLocale: jest.fn(),
            t: (key: string, params?: Record<string, unknown>) => {
                let msg = MESSAGES[key] ?? key;
                if (params) {
                    for (const [k, v] of Object.entries(params)) {
                        msg = msg.replace(`{${k}}`, String(v));
                    }
                }
                return msg;
            },
        }),
    };
});

const engineDosha = (jupiterAspects?: boolean): DoshaEvaluation => {
    const planets = [
        {
            name: 7,
            sign: 7,
            house: 7,
            degree: 15,
            absoluteDegree: 195,
            strength: PlanetaryStrength.SAMA,
            navamsaSign: 7,
            navamsaStrength: PlanetaryStrength.SAMA,
            nakshatra: 14,
            aspects: [{ planetName: 3, aspectType: 0, degreeGap: 0 }],
        },
        {
            name: 3,
            sign: 7,
            house: 7,
            degree: 15,
            absoluteDegree: 195,
            strength: PlanetaryStrength.SAMA,
            navamsaSign: 7,
            navamsaStrength: PlanetaryStrength.SAMA,
            nakshatra: 14,
            aspects: [{ planetName: 7, aspectType: 0, degreeGap: 0 }],
        },
    ];
    if (jupiterAspects) {
        planets.push({
            name: 5,
            sign: 9,
            house: 9,
            degree: 10,
            absoluteDegree: 250,
            strength: PlanetaryStrength.SAMA,
            navamsaSign: 9,
            navamsaStrength: PlanetaryStrength.SAMA,
            nakshatra: 25,
            aspects: [{ planetName: 7, aspectType: 120, degreeGap: 4 }],
        });
    }
    const result = computeYogaDoshas(buildChartFacts({ ascendantSign: 1, source: "auto", planets }));
    expect(result.yogas.map((y) => y.id)).toEqual([
        "dharmaKarmadhipati",
        "ruchaka",
        "bhadra",
        "hamsa",
        "malavya",
        "sasha",
        "deeptaYoga",
    ]);
    // The Dharma Karmadhipati Yoga stays absent in both variants: without Jupiter the 9th lord is
    // missing, and with Jupiter a one-directional 120° drishti fails the DK-02 mutual requirement.
    // Saturn is in the 7th Kendra in its exaltation sign (Libra 7) → the Sasha Maha Purusha Yoga
    // fires (strength 1); Mars in Libra does not fire Ruchaka.
    expect(result.yogas[0].isPresent).toBe(false);
    expect(result.yogas.find((y) => y.id === "sasha")?.isPresent).toBe(true);
    return result.doshas[0];
};

const presentDosha = (over: Partial<DoshaEvaluation> = {}): DoshaEvaluation => ({
    id: "manglik",
    kind: "dosha",
    isPresent: true,
    tradition: "MAIN_STREAM",
    formation: {
        rulesTriggered: ["manglik.mk01"],
        primaryRule: "manglik.mk01",
        strength: YogaStrength.STRONG,
        reasons: [{ rule: "manglik.mk01", reasonKey: "rule.mk01", params: { house: 7 } }],
    },
    context: { houseImpact: [7] },
    interpretation: { themes: [{ key: "theme.house7", params: { house: 7 } }] },
    mitigation: [],
    cancellation: { status: CancellationStatus.NOT_CANCELLED, factors: [] },
    finalAssessment: { severity: YogaStrength.STRONG, expressionKeys: ["expression.partnershipStress"] },
    ...over,
});

const presentYoga = (over: Partial<YogaEvaluation> = {}): YogaEvaluation => ({
    id: "dharmaKarmadhipati",
    kind: "yoga",
    isPresent: true,
    tradition: "MAIN_STREAM",
    formation: {
        rulesTriggered: ["dharmaKarmadhipati.dk01"],
        primaryRule: "dharmaKarmadhipati.dk01",
        strength: YogaStrength.STRONG,
        reasons: [{ rule: "dharmaKarmadhipati.dk01", reasonKey: "rule.dk01", params: { dharmaLord: 4, karmaLord: 6 } }],
    },
    context: { houseImpact: [9, 10] },
    interpretation: { themes: [{ key: "theme.house9", params: { house: 9 } }] },
    mitigation: [],
    cancellation: { status: CancellationStatus.NOT_CANCELLED, factors: [] },
    finalAssessment: { severity: YogaStrength.STRONG, expressionKeys: ["expression.main"] },
    ...over,
});

const unknownYoga = (): YogaEvaluation =>
    ({
        id: "recentExperiment",
        kind: "yoga",
        isPresent: true,
        tradition: "MAIN_STREAM",
        formation: {
            rulesTriggered: ["shaniMangala.sm01"],
            primaryRule: "shaniMangala.sm01",
            strength: YogaStrength.VERY_STRONG,
            reasons: [{ rule: "shaniMangala.sm01", reasonKey: "rule.sm01", params: { house: 7 } }],
        },
        context: { houseImpact: [7] },
        interpretation: { themes: [{ key: "theme.house7", params: { house: 7 } }] },
        mitigation: [],
        cancellation: { status: CancellationStatus.NOT_CANCELLED, factors: [] },
        finalAssessment: { severity: YogaStrength.VERY_STRONG, expressionKeys: ["expression.main"] },
    }) as unknown as YogaEvaluation;

const renderSection = (result?: YogaDoshaResult) => {
    return render(
        <YogaDoshaSection
            result={
                result ?? {
                    yogas: [],
                    doshas: [engineDosha(), presentDosha()],
                }
            }
        />,
    );
};

describe("AX-YD-600: disclosure contract", () => {
    test("tag is a real button; panel hidden until expanded, then role=region + aria-labelledby", () => {
        renderSection();

        const tag = screen.getByRole("button", { name: "Shani Mangala Dosha, Very strong, Not cancelled" });
        expect(tag).toHaveAttribute("aria-expanded", "false");
        expect(tag).toHaveAttribute("aria-controls", "dosha-shaniMangala-panel");
        // The <section> itself is an implicit region; the panel region is only the named disclosure.
        expect(screen.queryByRole("region", { name: "Shani Mangala Dosha" })).not.toBeInTheDocument();

        fireEvent.click(tag);
        expect(tag).toHaveAttribute("aria-expanded", "true");
        const panel = screen.getByRole("region", { name: "Shani Mangala Dosha" });
        expect(panel).toHaveAttribute("aria-labelledby", "dosha-shaniMangala-title");
        expect(screen.getByText("Saturn and Mars occupy house 7 together.")).toBeInTheDocument();
        expect(screen.getByText("House 7")).toBeInTheDocument();
        expect(screen.getByText("Relates to partnerships; stamina in close bonds.")).toBeInTheDocument();
        expect(screen.getByText("A testing but transformative union.")).toBeInTheDocument();
        expect(screen.getByText("These periods may surface the themes above.")).toBeInTheDocument();

        // Disclosure toggle works both ways.
        fireEvent.click(tag);
        expect(screen.queryByRole("region", { name: "Shani Mangala Dosha" })).not.toBeInTheDocument();
    });

    test("no interactive content is present while panels are collapsed", () => {
        renderSection();
        expect(document.getElementById("dosha-shaniMangala-panel")).toBeNull();
        expect(document.getElementById("dosha-manglik-panel")).toBeNull();
    });

    test("multiple tags can be open at once (multi-open), across groups", () => {
        renderSection();

        fireEvent.click(screen.getByRole("button", { name: /Shani Mangala Dosha, Very strong/ }));
        fireEvent.click(screen.getByRole("button", { name: "Manglik, Strong, Not cancelled" }));

        expect(screen.getAllByRole("region", { name: /(Shani Mangala Dosha|Manglik)/ })).toHaveLength(2);
        // The second open did not collapse the first.
        expect(screen.getByRole("button", { name: /Shani Mangala Dosha, Very strong/ })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
    });
});

describe("AX-YD-601/602/607: groups, empty states, and state channels", () => {
    test("group wrappers carry role=group with their aria labels", () => {
        renderSection();
        expect(screen.getByRole("group", { name: "Yogas" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Doshas" })).toBeInTheDocument();
    });

    test("count label shows the present count only when > 0", () => {
        renderSection();
        // No active yogas this release → the Yogas group carries no count.
        expect(within(screen.getByRole("group", { name: "Yogas" })).queryByText(/\(/)).not.toBeInTheDocument();
        expect(within(screen.getByRole("group", { name: "Doshas" })).getByText("(2)")).toBeInTheDocument();
    });

    test("empty groups announce through role=status", () => {
        render(<YogaDoshaSection result={{ yogas: [], doshas: [] }} />);
        const emptyYogas = within(screen.getByRole("group", { name: "Yogas" })).getAllByRole("status");
        const emptyDoshas = within(screen.getByRole("group", { name: "Doshas" })).getAllByRole("status");
        expect(emptyYogas[0]).toHaveTextContent("No yogas detected in this chart.");
        expect(emptyDoshas[0]).toHaveTextContent("No doshas detected in this chart.");
        expect(screen.queryByText("(1)")).not.toBeInTheDocument();
    });

    test("AX-YD-607: mitigated state conveys via ≥ 2 channels (badge word + dot + aria-label)", () => {
        const result: YogaDoshaResult = {
            yogas: [],
            doshas: [engineDosha(true)],
        };
        render(<YogaDoshaSection result={result} />);
        // Jupiter's aspect softens Shani-Mangala: severity Strong + status Mitigated (engine test covers).
        const tag = screen.getByRole("button", { name: /Shani Mangala Dosha, Strong, Mitigated/ });
        expect(tag).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(tag);
        // Badge word + dot in the header (also echoed by the cancellation block).
        expect(screen.getAllByText("Mitigated").length).toBeGreaterThanOrEqual(2);
        const badge = screen.getAllByText("Mitigated")[0].closest("span");
        expect(badge?.querySelector("[aria-hidden=true]")).toHaveClass("bg-amber-500");
    });
});

describe("AX-YD-603/604: tag labels, cancelled chips, unknown chips", () => {
    test("cancelled tag gets line-through + aria-label state word (never dot-only)", () => {
        const result: YogaDoshaResult = {
            yogas: [],
            doshas: [presentDosha({ cancellation: { status: CancellationStatus.CANCELLED, factors: [] } })],
        };
        render(<YogaDoshaSection result={result} />);
        const tag = screen.getByRole("button", { name: "Manglik, Strong, Cancelled" });
        expect(tag).toHaveClass("line-through");
        expect(tag.querySelector("[aria-hidden=true]")).toHaveClass("bg-gray-500");
    });

    test("dosha tag is red while present and gray when cancelled (user color direction)", () => {
        render(
            <YogaDoshaSection
                result={{
                    yogas: [],
                    doshas: [
                        engineDosha(),
                        presentDosha({ cancellation: { status: CancellationStatus.CANCELLED, factors: [] } }),
                    ],
                }}
            />,
        );

        const presentTag = screen.getByRole("button", { name: "Shani Mangala Dosha, Very strong, Not cancelled" });
        expect(presentTag).toHaveClass("bg-red-50");
        expect(presentTag).toHaveClass("text-red-700");
        expect(presentTag).toHaveClass("border-red-300");
        expect(presentTag.querySelector("[aria-hidden=true]")).toHaveClass("bg-red-600");

        const cancelledTag = screen.getByRole("button", { name: "Manglik, Strong, Cancelled" });
        expect(cancelledTag).toHaveClass("bg-gray-100");
        expect(cancelledTag).toHaveClass("text-gray-500");
        expect(cancelledTag).toHaveClass("line-through");
        expect(cancelledTag.querySelector("[aria-hidden=true]")).toHaveClass("bg-gray-500");
    });

    test("yoga tag is green while present and gray when cancelled (user color direction)", () => {
        render(
            <YogaDoshaSection
                result={{
                    yogas: [
                        presentYoga(),
                        presentYoga({ cancellation: { status: CancellationStatus.CANCELLED, factors: [] } }),
                    ],
                    doshas: [],
                }}
            />,
        );

        const presentTag = screen.getByRole("button", { name: "Dharma Karmadhipati Yoga, Strong, Not cancelled" });
        expect(presentTag).toHaveClass("bg-green-50");
        expect(presentTag).toHaveClass("text-green-700");
        expect(presentTag).toHaveClass("border-green-300");
        expect(presentTag.querySelector("[aria-hidden=true]")).toHaveClass("bg-green-600");

        const cancelledTag = screen.getByRole("button", { name: "Dharma Karmadhipati Yoga, Strong, Cancelled" });
        expect(cancelledTag).toHaveClass("bg-gray-100");
        expect(cancelledTag).toHaveClass("text-gray-500");
        expect(cancelledTag).toHaveClass("line-through");
        expect(cancelledTag.querySelector("[aria-hidden=true]")).toHaveClass("bg-gray-500");
    });

    test("AX-YD-605: unknown-id chip is a plain, non-focusable span that keeps {id}, not available", () => {
        const result: YogaDoshaResult = { yogas: [unknownYoga()], doshas: [] };
        render(<YogaDoshaSection result={result} />);

        const chip = screen.getByLabelText("recentExperiment, not available");
        expect(chip.tagName).toBe("SPAN");
        expect(screen.queryByRole("button", { name: /recentExperiment/ })).not.toBeInTheDocument();
        // The group still exposes the chip via its accessible name.
        expect(within(screen.getByRole("group", { name: "Yogas" })).getByText("not available")).toBeInTheDocument();
    });

    test("tag aria-label composes localized name + strength + status", () => {
        renderSection();
        expect(
            screen.getByRole("button", { name: "Shani Mangala Dosha, Very strong, Not cancelled" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Manglik, Strong, Not cancelled" })).toBeInTheDocument();
    });

    test("deeptaYoga tag + panel are named after the classifying planet ('Guru Deeptha Yoga')", () => {
        const result: YogaDoshaResult = {
            yogas: [
                presentYoga({
                    id: "deeptaYoga",
                    classification: "Guru",
                    formation: {
                        rulesTriggered: ["deeptaYoga.dy01"],
                        primaryRule: "deeptaYoga.dy01",
                        strength: YogaStrength.STRONG,
                        reasons: [
                            {
                                rule: "deeptaYoga.dy01",
                                reasonKey: "rule.dy01",
                                params: { planet: 5, classification: "Guru" },
                            },
                        ],
                    },
                }),
            ],
            doshas: [],
        };
        render(<YogaDoshaSection result={result} />);

        const tag = screen.getByRole("button", { name: "Guru Deeptha Yoga, Strong, Not cancelled" });
        fireEvent.click(tag);
        // The region name and the panel h4 both come from the classification-qualified name.
        expect(screen.getByRole("region", { name: "Guru Deeptha Yoga" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Guru Deeptha Yoga" })).toBeInTheDocument();
        // The expression paragraph resolves to the classification-specific (Guru) text, not the generic main.
        expect(
            screen.getByText("Wealth is gained, renown and praise come, and advisory services are provided."),
        ).toBeInTheDocument();
    });
});

describe("Detail panel blocks (UI-YD-520..538)", () => {
    test("mitigation block renders its heading, note, and factor line", () => {
        const result: YogaDoshaResult = { yogas: [], doshas: [engineDosha(true)] };
        render(<YogaDoshaSection result={result} />);
        fireEvent.click(screen.getByRole("button", { name: /Shani Mangala Dosha, Strong, Mitigated/ }));

        expect(screen.getByRole("heading", { name: "Mitigation" })).toBeInTheDocument();
        expect(screen.getByText("Mitigation softens the effect — it does not cancel.")).toBeInTheDocument();
        expect(screen.getByText("Jupiter's aspect softens the union.")).toBeInTheDocument();
    });

    test("cancellation block is always visible, even when status 1", () => {
        renderSection();
        fireEvent.click(screen.getByRole("button", { name: /Shani Mangala Dosha/ }));
        const cancelHeading = screen.getByRole("heading", { name: "Cancellation" });
        expect(cancelHeading).toBeInTheDocument();
        const block = cancelHeading.closest("div");
        expect(block).toHaveTextContent("Not cancelled");
    });

    test("dasha note is a muted paragraph for shaniMangala and absent for manglik", () => {
        renderSection();
        fireEvent.click(screen.getByRole("button", { name: /Shani Mangala Dosha/ }));
        const note = screen.getByText("These periods may surface the themes above.");
        expect(note).toHaveClass("italic");

        fireEvent.click(screen.getByRole("button", { name: "Manglik, Strong, Not cancelled" }));
        const manglikPanel = within(screen.getByRole("group", { name: "Doshas" })).getByRole("region", {
            name: "Manglik",
        });
        expect(within(manglikPanel).queryByText("These periods may surface the themes above.")).not.toBeInTheDocument();
    });

    test("panel header shows tradition, strength pill and status badge", () => {
        renderSection();
        fireEvent.click(screen.getByRole("button", { name: /Shani Mangala Dosha/ }));
        expect(screen.getByText("Mainstream")).toBeInTheDocument();
        expect(screen.getByText("Very strong")).toBeInTheDocument();
        // "Not cancelled" echoes in the header badge and the cancellation block.
        expect(screen.getAllByText("Not cancelled").length).toBeGreaterThanOrEqual(2);
    });
});

describe("Section shell (UI-YD-500, AX section semantics)", () => {
    test("section id + labelled heading are present", () => {
        renderSection();
        const section = document.getElementById("yogas-doshas");
        expect(section).not.toBeNull();
        expect(section).toHaveAttribute("aria-labelledby", "yogas-doshas-title");
        // InfoGlyph sits inside the h3, so the accessible name includes the glyph's tooltip text.
        expect(screen.getByRole("heading", { name: /Yogas & Doshas/ })).toHaveAttribute("id", "yogas-doshas-title");
    });

    test("adding a keyboard-visible focus ring: tag has focus-visible styling", () => {
        renderSection();
        const tag = screen.getByRole("button", { name: /Shani Mangala Dosha/ });
        expect(tag.className).toContain("focus-visible:ring-2");
    });
});

describe("Empty + abnormal inputs never crash (US-YD-005 Edge)", () => {
    test("all-absent entries render empty states, not chips", () => {
        const absent = { ...engineDosha(), isPresent: false };
        const result: YogaDoshaResult = {
            yogas: [],
            doshas: [absent, presentDosha({ isPresent: false })],
        };
        render(<YogaDoshaSection result={result} />);
        expect(screen.getAllByRole("status")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: /Shani Mangala/ })).not.toBeInTheDocument();
    });
});
