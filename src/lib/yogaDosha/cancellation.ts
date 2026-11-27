/**
 * Yoga / Dosha — cancellation & mitigation rules.
 * CancellationStatus semantics (data-model §CancellationStatus): only a rule a tradition explicitly
 * registers as a CANCELLATION may set status 2; mitigation never cancels — it lowers severity and
 * may set status 3. No cancellation rules are registered in this release (seed remains empty);
 * mitigations below are the registered factors.
 */
import { planetFact } from "@/lib/yogaDosha/relationships";
import {
    ChartFacts,
    MitigationConfidence,
    MitigationEffect,
    MitigationFactor,
    MitigationKey,
    MitigationType,
} from "@/lib/yogaDosha/types";

/** Registered mitigation rules (data-model §Rule Catalog). */
export const MITIGATION_REGISTRY: Record<
    MitigationKey,
    {
        check: (facts: ChartFacts) => boolean;
        type: MitigationType;
        effect: MitigationEffect;
        target: number;
        confidence: MitigationConfidence;
    }
> = {
    "shaniMangala.mitigation.sm-mit-001": {
        // Jupiter's benefic aspect on either member softens the harsh Saturn–Mars union.
        check: (facts) => {
            const jupiter = planetFact(facts, 5);
            if (!jupiter) return false;
            const touching = (name: number) => jupiter.aspects.some((a) => a.planetName === name);
            return touching(7) || touching(3);
        },
        type: "BENEFIC_INFLUENCE",
        effect: "REDUCES_SEVERITY",
        target: 3,
        confidence: 2,
    },
    "manglik.mitigation.mk-mit-001": {
        // Jupiter's aspect on Mars (or the 7th lord) — classic Manglik mitigator; severity stays 2→3.
        check: (facts) => {
            const jupiter = planetFact(facts, 5);
            const mars = planetFact(facts, 3);
            if (!jupiter || !mars) return false;
            return jupiter.aspects.some((a) => a.planetName === 3);
        },
        type: "BENEFIC_INFLUENCE",
        effect: "REDUCES_SEVERITY",
        target: 3,
        confidence: 2,
    },
};

/** Registered cancellation rules — empty by design (US-YD-006/domain pending); extend here. */
export const CANCELLATION_REGISTRY: Record<string, { check: (facts: ChartFacts) => boolean }> = {};

export function mitigationForKey(
    key: MitigationKey,
    facts: ChartFacts,
    planetsInFormation: number[],
): MitigationFactor | null {
    const def = MITIGATION_REGISTRY[key];
    if (!def) return null;
    if (!def.check(facts)) return null;
    if (!planetsInFormation.some((name) => planetFact(facts, name))) return null;
    return {
        factorKey: key,
        type: def.type,
        effect: def.effect,
        target: def.target,
        confidence: def.confidence,
    };
}

/** Comments via CANCELLATION_REGISTRY — currently empty; no CancellationStatus 2 is reachable. */
export function cancellationFired(_key: string, _facts: ChartFacts): boolean {
    return false;
}
