import { Planet, YogaStrength } from "@/lib/astrologyEnums";
import planetReasonShares, { PlanetReasonShare } from "@/lib/yogaDosha/planetReasonShares";
import { FormationInfo, RuleReason } from "@/lib/yogaDosha/types";

const reason = (params: Record<string, string | number> = {}): RuleReason => ({
    rule: "dhanaYoga.dh01",
    reasonKey: "rule.dh01",
    params,
});

const formation = (reasons: RuleReason[], planets: number[]): FormationInfo => ({
    rulesTriggered: ["dhanaYoga.dh01"],
    primaryRule: "dhanaYoga.dh01",
    strength: YogaStrength.STRONG,
    reasons,
    planets,
});

describe("planetReasonShares", () => {
    test("grades each planet by its share of the reasons (8/10 dark, 3/10 light, 2/10 none)", () => {
        const reasons = Array.from({ length: 10 }, (_, index) =>
            reason({
                ...(index < 8 ? { lord1: Planet.MARS } : {}),
                ...(index < 3 ? { lord2: Planet.JUPITER } : {}),
                ...(index >= 8 ? { planet: Planet.SUN } : {}),
            }),
        );
        const shares = planetReasonShares(formation(reasons, [Planet.SUN, Planet.MARS, Planet.JUPITER]));
        expect(shares.get(Planet.MARS)).toBe(PlanetReasonShare.DOMINANT);
        expect(shares.get(Planet.JUPITER)).toBe(PlanetReasonShare.MAJOR);
        expect(shares.get(Planet.SUN)).toBe(PlanetReasonShare.MINOR);
    });

    test("exactly a quarter or half stays in the lower grade", () => {
        const reasons = [
            reason({ lord1: Planet.MARS, lord2: Planet.JUPITER }),
            reason({ lord1: Planet.MARS }),
            reason({}),
            reason({}),
        ];
        const shares = planetReasonShares(formation(reasons, [Planet.MARS, Planet.JUPITER]));
        expect(shares.get(Planet.MARS)).toBe(PlanetReasonShare.MAJOR);
        expect(shares.get(Planet.JUPITER)).toBe(PlanetReasonShare.MINOR);
    });

    test("a planet named twice in one reason counts once", () => {
        const reasons = [reason({ lord1: Planet.MARS, lord2: Planet.MARS }), reason({ lord1: Planet.JUPITER })];
        const shares = planetReasonShares(formation(reasons, [Planet.MARS, Planet.JUPITER]));
        expect(shares.get(Planet.MARS)).toBe(PlanetReasonShare.MAJOR);
    });

    test("a single reason is not graded", () => {
        const shares = planetReasonShares(formation([reason({ planet: Planet.MARS })], [Planet.MARS]));
        expect(shares.get(Planet.MARS)).toBe(PlanetReasonShare.MINOR);
    });

    test("reasons naming no planet attribute every reason to every formation planet", () => {
        const reasons = [reason({ house: 7 }), reason({ house: 8 })];
        const shares = planetReasonShares(formation(reasons, [Planet.MARS]));
        expect(shares.get(Planet.MARS)).toBe(PlanetReasonShare.DOMINANT);
    });
});
