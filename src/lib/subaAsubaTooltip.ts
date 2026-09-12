import { SubaAsuba, type SubaAsubaEntry, type SubaAsubaReason } from "@/lib/subaAsuba";

/** Localized resolver + name lookups injected by the caller (the SubaAsubaBadge component passes
 *  the `useI18n` t function and the page's getPlanetName). */
export interface SubaAsubaTooltipTokens {
    t: (key: string, params?: Record<string, string | number>) => string;
    getPlanetName: (planet: number) => string;
}

export interface SubaAsubaTooltipResult {
    /** Heading — the localized verdict ("Suba"/"Asuba"). */
    heading: string;
    /** Localized "Suba because:" / "Asuba because:" state line. */
    stateLine: string;
    /** One localized line per reason. Empty stored reasons → the generic state line. */
    lines: string[];
    /** Full plain text (planet + heading + state + reasons) for title/SR fallback. */
    title: string;
}

/** Substitute the numeric reason params with localized names where applicable: `planet` → planet
 *  name, `planets` → comma-joined planet names; other params (thithi/houses) pass through. */
function resolveReason(
    t: SubaAsubaTooltipTokens["t"],
    getPlanetName: (planet: number) => string,
    reason: SubaAsubaReason,
): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(reason.params ?? {})) {
        if (key === "planet") params[key] = getPlanetName(Number(value));
        else if (key === "planets")
            params[key] = String(value)
                .split(",")
                .filter(Boolean)
                .map((name) => getPlanetName(Number(name)))
                .join(", ");
        else params[key] = value;
    }
    return t(`astrology.${reason.key}`, params);
}

/** Compose the full Suba/Asuba cell tooltip: verdict heading, state line, and one line per reason. */
export function composeSubaAsubaTooltip(
    tokens: SubaAsubaTooltipTokens,
    planet: number,
    entry: SubaAsubaEntry,
): SubaAsubaTooltipResult {
    const { t, getPlanetName } = tokens;
    const suba = entry.value === SubaAsuba.SUBA;
    const heading = t(suba ? "astrology.papiGrahayan.suba" : "astrology.papiGrahayan.asuba");
    const stateLine = t(
        suba ? "astrology.papiGrahayan.tooltip.stateSuba" : "astrology.papiGrahayan.tooltip.stateAsuba",
    );
    const lines =
        entry.reasons.length > 0 ? entry.reasons.map((reason) => resolveReason(t, getPlanetName, reason)) : [stateLine];
    const title = [`${getPlanetName(planet)} — ${heading}`, stateLine, ...lines].join("\n");
    return { heading, stateLine, lines, title };
}
