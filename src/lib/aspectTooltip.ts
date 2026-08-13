import { formatDegree } from "@/lib/astrology";
import type { Aspect, AspectReason } from "@/lib/astrology";

/** Signed, zero-padded `d:mm:ss` delta per the existing `formatDegree` convention (UX §8.1.1
 *  Data notes). Positive when the aspected body is ahead (east) of the exact aspect point. */
export function formatSignedDelta(deltaDeg: number): string {
    return `${deltaDeg < 0 ? "-" : "+"}${formatDegree(Math.abs(deltaDeg))}`;
}

/** Relative whole-sign house of the aspect point vs the aspecting planet: `((aspectType / 30) % 12) + 1`
 *  (30°→2, 60°→3, …, 330°→12). Null for conjunction (0°) — the `{house}` token is omitted there
 *  (UX §8.1.1 house-omission rule). */
export function relativeAspectHouse(aspectType: number): number | null {
    if (aspectType <= 0) return null;
    return ((aspectType / 30) % 12) + 1;
}

export interface AspectTooltipTokens {
    /** `astrology.drishti.label` — e.g. "Planet drishti" / "ග්‍රහ දෘෂ්ඨි". */
    label: string;
    /** `astrology.drishti.rashiLabel` — e.g. "Rashi drishti" / "රාශි දෘෂ්ඨි". */
    rashiLabel: string;
    /** `astrology.drishti.arrow` — the language-neutral `→`. */
    arrow: string;
    /** Localized sign-name resolver (`astrology.signNames.{n}`). */
    getSignName: (sign: number) => string;
}

export interface AspectTooltipData {
    aspect: Pick<Aspect, "aspectType" | "exactAspectDegree" | "degreeGap" | "delta" | "reasons">;
    /** Aspected house (houses table) — overrides the relative-house derivation. */
    house?: number | null;
    /** Whole-sign the aspecting planet occupies — the `{aspectingSign}` of rashi reason lines. */
    aspectingSign?: number;
}

export interface AspectTooltipResult {
    /** Reason lines rendered WITHOUT inline deltas (single-reason tools carry the delta inline). */
    lines: string[];
    /** Exactly one reason exists → the signed delta renders inline (no footer). */
    single: boolean;
    /** Signed, zero-padded `d:mm:ss` delta — rendered exactly once per tooltip. */
    delta: string;
    /** Full plain text — every reason line plus the delta exactly once — for title/SR fallback. */
    title: string;
}

const REASON_ORDER: Record<AspectReason["type"], number> = { planetary: 0, rashi: 1 };

/** Compose the compact reason lines (UX §8.1.1). Single reason keeps the inline signed delta;
 *  ≥2 reasons render one line per reason WITHOUT deltas and the caller appends the single shared
 *  `Δ {delta}` footer (the delta is never repeated per line). Legacy aspects (no `reasons`) are
 *  treated as a single planetary reason. */
export function composeAspectTooltip(tokens: AspectTooltipTokens, data: AspectTooltipData): AspectTooltipResult {
    const { aspect, aspectingSign } = data;
    const houseOverride = data.house ?? null;
    const reasons = [...(aspect.reasons ?? [])].sort((a, b) => REASON_ORDER[a.type] - REASON_ORDER[b.type]);
    const effectiveReasons: AspectReason[] =
        reasons.length > 0
            ? reasons
            : [
                  {
                      type: "planetary",
                      angle: aspect.aspectType ?? aspect.exactAspectDegree ?? 0,
                      delta: aspect.delta ?? aspect.degreeGap ?? 0,
                  },
              ];
    const single = effectiveReasons.length === 1;
    const deltaStr = formatSignedDelta(aspect.delta ?? aspect.degreeGap ?? effectiveReasons[0]?.delta ?? 0);

    const renderReason = (reason: AspectReason, inlineDelta: boolean): string => {
        if (reason.type === "rashi") {
            const signs = `${tokens.getSignName(aspectingSign ?? 1)} ${tokens.arrow} ${tokens.getSignName(
                reason.aspectedSign ?? 1,
            )}`;
            return inlineDelta ? `${tokens.rashiLabel} ${signs} (${deltaStr})` : `${tokens.rashiLabel} ${signs}`;
        }
        const angle = reason.angle ?? aspect.aspectType ?? aspect.exactAspectDegree ?? 0;
        const house = houseOverride ?? relativeAspectHouse(angle);
        if (inlineDelta) {
            return house !== null
                ? `${tokens.label} ${house} (${angle}) (${deltaStr})`
                : `${tokens.label} (${angle}) (${deltaStr})`;
        }
        return house !== null ? `${tokens.label} ${house} (${angle})` : `${tokens.label} (${angle})`;
    };

    if (single) {
        const line = renderReason(effectiveReasons[0], true);
        return { lines: [line], single: true, delta: deltaStr, title: line };
    }

    const body = effectiveReasons.map((reason) => renderReason(reason, false));
    const footer = `Δ ${deltaStr}`;
    return { lines: body, single: false, delta: deltaStr, title: [...body, footer].join("\n") };
}
