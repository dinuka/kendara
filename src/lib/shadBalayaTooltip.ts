import type { ShadBalaReason, ShadBalayaKey } from "@/lib/shadBalaya";

/** Localized resolver + name lookups injected by the caller (the ShadBalaTable component passes
 *  `useTranslations` output and the page's getSignName/getPlanetName). */
export interface ShadBalaTooltipTokens {
    t: (key: string, params?: Record<string, string | number>) => string;
    getSignName: (sign: number) => string;
    getPlanetName: (planet: number) => string;
}

export interface ShadBalaTooltipData {
    planet: number;
    bala: ShadBalayaKey;
    value: boolean;
    overridden: boolean;
    reasons: ShadBalaReason[];
}

export interface ShadBalaTooltipResult {
    /** Heading — the localized bala name (`astrology.shadbalaya.balaNames.{bala}`). */
    heading: string;
    /** `✓ Checked because:` / `✗ Unchecked because:`. */
    stateLine: string;
    /** One localized line per reason. Empty stored reasons → generic manual line. */
    lines: string[];
    /** Override footer (`astrology.shadbalaya.override.footer`) — present only when overridden. */
    overrideFooter?: string;
    /** Full plain text (heading + state + reasons + override) for title/SR fallback. */
    title: string;
}

/** Substitute the numeric reason params with localized names where applicable: `sign` → sign name,
 *  `planet` → planet name; other params (house/strength) pass through as numbers. */
function resolveReason(
    t: ShadBalaTooltipTokens["t"],
    getSignName: (sign: number) => string,
    getPlanetName: (planet: number) => string,
    reason: ShadBalaReason,
): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(reason.params ?? {})) {
        if (key === "sign") params[key] = getSignName(value);
        else if (key === "planet") params[key] = getPlanetName(value);
        else params[key] = value;
    }
    return t(`astrology.${reason.key}`, params);
}

/** Compose the full Shad Bala cell tooltip (UX §7). Reasons with no stored explanation (e.g.
 *  Rahu/Ketu dig bala, computed `reasons: []`) fall back to the generic manual reason line. */
export function composeShadBalaTooltip(
    tokens: ShadBalaTooltipTokens,
    data: ShadBalaTooltipData,
): ShadBalaTooltipResult {
    const { t, getSignName, getPlanetName } = tokens;
    const { bala, value, overridden } = data;
    const heading = t(`astrology.shadbalaya.balaNames.${bala}`);
    const stateLine = t(value ? "astrology.shadbalaya.tooltip.checked" : "astrology.shadbalaya.tooltip.unchecked");
    const effectiveReasons: ShadBalaReason[] =
        data.reasons.length > 0 ? data.reasons : [{ key: "shadbalaya.reason.manual" }];
    const lines = effectiveReasons.map((reason) => resolveReason(t, getSignName, getPlanetName, reason));
    const overrideFooter = overridden ? t("astrology.shadbalaya.override.footer") : undefined;
    const title = [heading, stateLine, ...lines, overrideFooter].filter(Boolean).join("\n");
    return { heading, stateLine, lines, overrideFooter, title };
}

/** Build the checkbox aria-label (`Sun Sthana Bala — checked, set manually`). */
export function composeShadBalaAriaLabel(
    t: ShadBalaTooltipTokens["t"],
    getPlanetName: (planet: number) => string,
    data: Pick<ShadBalaTooltipData, "planet" | "bala" | "value" | "overridden">,
): string {
    const base = t(
        data.value ? "astrology.shadbalaya.checkbox.ariaChecked" : "astrology.shadbalaya.checkbox.ariaUnchecked",
        { planet: getPlanetName(data.planet), bala: t(`astrology.shadbalaya.balaNames.${data.bala}`) },
    );
    return data.overridden ? `${base}, ${t("astrology.shadbalaya.override.ariaShort")}` : base;
}

/** Build the ratio cell aria-label (`Sun — 3 of 6 balas`). */
export function composeShadBalaRatioAria(
    t: ShadBalaTooltipTokens["t"],
    getPlanetName: (planet: number) => string,
    planet: number,
    count: number,
): string {
    return t("astrology.shadbalaya.ratioAria", { planet: getPlanetName(planet), n: count });
}
