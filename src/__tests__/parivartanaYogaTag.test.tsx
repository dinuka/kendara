/** @jest-environment jsdom */
/** Parivartana yoga tags take a fixed shade from the catalog: Maha dark, Khala mid, Dainya light green. */
import YogaDoshaTag from "@/components/yogaDosha/YogaDoshaTag";

import { CancellationStatus, YogaStrength } from "@/lib/astrologyEnums";
import { YogaEvaluation, YogaId } from "@/lib/yogaDosha/types";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/hooks/useI18n", () => ({
    useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));

const yoga = (id: YogaId, reasons = 1): YogaEvaluation => ({
    id,
    kind: "yoga",
    isPresent: true,
    tradition: "MAIN_STREAM",
    formation: {
        rulesTriggered: [`${id}.pv01` as YogaEvaluation["formation"]["primaryRule"]],
        primaryRule: `${id}.pv01` as YogaEvaluation["formation"]["primaryRule"],
        strength: YogaStrength.STRONG,
        reasons: Array.from({ length: reasons }, () => ({
            rule: `${id}.pv01` as YogaEvaluation["formation"]["primaryRule"],
            reasonKey: "rule.pv01",
        })),
        planets: [4, 7],
    },
    context: { houseImpact: [4, 9] },
    interpretation: { themes: [] },
    mitigation: [],
    cancellation: { status: CancellationStatus.NOT_CANCELLED, factors: [] },
    finalAssessment: { severity: YogaStrength.STRONG, expressionKeys: [] },
});

const chip = (entry: YogaEvaluation) => {
    const { unmount } = render(<YogaDoshaTag entry={entry} open={false} onToggle={() => undefined} />);
    const { className } = screen.getByRole("button");
    unmount();
    return className;
};

describe("Parivartana yoga tag shades", () => {
    test("Maha is dark green, Khala green, Dainya light green", () => {
        expect(chip(yoga("mahaParivartana"))).toContain("bg-green-600");
        expect(chip(yoga("khalaParivartana"))).toContain("bg-green-200");
        expect(chip(yoga("dainyaParivartana"))).toContain("bg-green-50");
    });

    test("the shade stays fixed whatever the reason count", () => {
        expect(chip(yoga("dainyaParivartana", 3))).toContain("bg-green-50");
        expect(chip(yoga("mahaParivartana", 1))).toContain("bg-green-600");
    });
});
