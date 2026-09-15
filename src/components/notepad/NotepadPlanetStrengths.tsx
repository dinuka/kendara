"use client";

import AspectTooltip from "@/components/aspects/AspectTooltip";
import { useI18n } from "@/hooks/useI18n";
import { useTooltipPosition } from "@/hooks/useTooltipPosition";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { type AspectTooltipTokens, composeAspectTooltip } from "@/lib/aspectTooltip";
import { type Aspect, formatDegree } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { type ObservationColor } from "@/lib/notepadCatalogs";
import type { CalculatedDetailsLike } from "@/lib/notepadObservations";
import {
    type PlanetFactorOverrides,
    type PlanetStrengthEntry,
    bhavaColorOf,
    computePlanetStrengths,
    nextPlanetFactorColor,
    ratioColorOf,
} from "@/lib/planetStrength";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const PLANET_SYMBOLS: Record<number, string> = {
    1: "☉",
    2: "☽",
    3: "♂",
    4: "☿",
    5: "♃",
    6: "♀",
    7: "♄",
    8: "☊",
    9: "☋",
};

/** System-chip styles — mirrored from NotepadObservations (both render the same system chips). */
const CHIP_STYLES: Record<string, string> = {
    green: "border-green-300 bg-green-50 text-green-800",
    darkGreen: "border-green-800 bg-green-600 text-white",
    lightGreen: "border-green-300 bg-green-50 text-green-700",
    red: "border-red-300 bg-red-50 text-red-800",
    lightRed: "border-red-300 bg-red-50 text-red-700",
    darkRed: "border-red-800 bg-red-600 text-white",
    yellow: "border-amber-300 bg-amber-50 text-amber-800",
    white: "border-gray-300 bg-white text-gray-700",
};

const DOT_STYLES: Record<string, string> = {
    green: "text-green-600",
    darkGreen: "text-green-200",
    lightGreen: "text-green-500",
    red: "text-red-600",
    lightRed: "text-red-400",
    darkRed: "text-red-200",
    yellow: "text-amber-500",
    white: "text-gray-400",
};

function planetName(t: Translate, name: number): string {
    return t(`astrology.planetNames.${name}`);
}

const STRENGTH_TRANSLATION_KEYS: Record<PlanetaryStrength, string> = {
    [PlanetaryStrength.ATHI_UCHCHA]: "athiUchcha",
    [PlanetaryStrength.UCHCHA]: "exalted",
    [PlanetaryStrength.NEECHA]: "debilitated",
    [PlanetaryStrength.ATHI_NEECHA]: "athiNeecha",
    [PlanetaryStrength.MOOLATRIKONA]: "moolatrikona",
    [PlanetaryStrength.OWN_SIGN]: "ownSign",
    [PlanetaryStrength.MITRA]: "friendly",
    [PlanetaryStrength.SHATRU]: "enemy",
    [PlanetaryStrength.SAMA]: "neutral",
};

/** Maps a numeric strength value to its i18n key, or undefined when the value isn't a known
 *  PlanetaryStrength enum (the derivation emits the factor for any number, so unknown values fall
 *  back to the generic "Sign dignity"/"Navamsa dignity" label). */
function strengthKeyOf(strength: number | undefined): string | undefined {
    if (strength === undefined || Number.isNaN(strength)) return undefined;
    return STRENGTH_TRANSLATION_KEYS[strength as PlanetaryStrength];
}

function factorLabel(t: Translate, factor: PlanetStrengthEntry["factors"][number]): string {
    const key = `notepad.planetStrengths.factors.${factor.key}`;
    if (factor.key === "sign" || factor.key === "navamsa") {
        const strengthKey = strengthKeyOf(factor.params?.strength);
        if (factor.params?.sign !== undefined && strengthKey) {
            return t(`notepad.planetStrengths.factors.${factor.key}Label`, {
                sign: t(`astrology.signNamesLocative.${factor.params.sign}`),
                strength: t(`astrology.strengthInSign.${strengthKey}`),
            });
        }
    }
    return t(key, factor.params);
}

/** Informational context chip (no click cycle, no tooltip) — the ownership / Bhava Suchika /
 *  house-owner / nakshatra-owner tags of the Graha bala panel. */
function InfoTag({ color, label, ariaLabel }: { color: ObservationColor; label: string; ariaLabel?: string }) {
    return (
        <span
            aria-label={ariaLabel}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[color]}`}
        >
            <span aria-hidden className={`leading-none ${DOT_STYLES[color]}`}>
                ●
            </span>
            {label}
        </span>
    );
}

interface TooltipLines {
    lines: string[];
    single: boolean;
    delta: string;
    title: string;
}

/** Context chip with the shared compact tooltip (the conjunction/aspect table style) — mirrors the
 *  AspectChip interaction: hover (150ms delay) / focus / tap open, Esc / blur / mouseleave close,
 *  portal to `document.body`, `title` fallback for no-JS/print. */
function TooltipChip({
    color,
    label,
    ariaLabel,
    lines,
    single,
    delta,
    title,
}: {
    color: ObservationColor;
    label: string;
    ariaLabel?: string;
} & TooltipLines) {
    const { t, locale } = useI18n();
    const [open, setOpen] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipId = useId();
    const { anchorRef, tooltipRef, position, updatePosition } = useTooltipPosition<HTMLButtonElement>(open);

    const openTooltip = () => {
        updatePosition();
        setOpen(true);
    };
    const closeTooltip = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open, updatePosition]);

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    return (
        <span className="inline-flex">
            <button
                ref={anchorRef}
                type="button"
                aria-label={ariaLabel ?? label}
                aria-describedby={open ? tooltipId : undefined}
                title={title}
                onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(openTooltip, 150);
                }}
                onMouseLeave={closeTooltip}
                onFocus={openTooltip}
                onBlur={closeTooltip}
                onClick={() => (open ? closeTooltip() : openTooltip())}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        closeTooltip();
                        anchorRef.current?.focus();
                    }
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[color]} hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
                <span aria-hidden className={`leading-none ${DOT_STYLES[color]}`}>
                    ●
                </span>
                {label}
            </button>
            {open &&
                position &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed z-50"
                        role="presentation"
                        style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                    >
                        <AspectTooltip
                            id={tooltipId}
                            lines={lines}
                            single={single}
                            delta={delta}
                            title={title}
                            rashiVerbAria={t("astrology.drishti.rashiVerbAria")}
                            isSinhala={locale === "si"}
                        />
                    </div>,
                    document.body,
                )}
        </span>
    );
}

/** The strength panel: one planet's factor (sub-tag) chips, each cycling its classification on
 *  click (green → red → white → green) so the student can determine that planet's strength. The
 *  override persists via `onOverrideFactor`; the ratio in the parent chip recomputes immediately.
 *  `notRelevant` (optional, observation sections only) adds the "mark not relevant / restore"
 *  toggle that used to live in the colour picker for planet tags.
 *  `full` (optional, Graha bala section only) also renders the informational context tags — planet
 *  conjunctions ("with {planet}", tooltip = conjunction gap), received aspects ("{planet}'s
 *  drishti", tooltip = the table's aspect difference + reasons), Bhava Suchika, the owned houses
 *  (the ownership chips that replaced the current-house factor), the planet's D1 house owner plus
 *  the house owner's own houses, and the nakshatra owner. Context tags are informational only —
 *  they never affect the ratio and never cycle. */
export function PlanetStrengthPanel({
    entry,
    onOverrideFactor,
    notRelevant,
    full,
    entries,
}: {
    entry: PlanetStrengthEntry;
    onOverrideFactor?: (planet: number, factor: string, color: ObservationColor) => void;
    notRelevant?: { isIrrelevant: boolean; onToggle: () => void } | null;
    /** Graha bala (notepad) full panel — also renders the informational context tags. */
    full?: boolean;
    /** All strength entries — colours each conjunction/aspect/owner tag by its referenced planet's
     *  ratio (the user-confirmed "Budha 4/5 → green; if Budha turns red all Budha tags turn red"). */
    entries?: PlanetStrengthEntry[];
}) {
    const { t } = useI18n();
    const ratioColorByPlanet = useMemo(
        () => new Map((entries ?? []).map((planetEntry) => [planetEntry.planet, ratioColorOf(planetEntry.ratio)])),
        [entries],
    );
    const refColorOf = (planet: number): ObservationColor => ratioColorByPlanet.get(planet) ?? "white";
    const houseOwner = entry.houseOwner;
    if (entry.factors.length === 0 && !full) return null;
    return (
        <div
            role="group"
            aria-label={`${planetName(t, entry.planet)} — ${t("notepad.planetStrengths.title")}`}
            className="mt-1 mb-2 flex flex-wrap gap-1 items-center"
        >
            {entry.factors.map((factor) => {
                const label = factorLabel(t, factor);
                return (
                    <button
                        key={factor.key}
                        type="button"
                        aria-label={t("notepad.aria.planetFactor", {
                            factor: label,
                            classification: t(`notepad.observation.classification.${factor.color}`),
                        })}
                        onClick={() =>
                            onOverrideFactor?.(entry.planet, factor.key, nextPlanetFactorColor(factor.color))
                        }
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[factor.color]} hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    >
                        <span aria-hidden className={`leading-none ${DOT_STYLES[factor.color]}`}>
                            ●
                        </span>
                        {label}
                    </button>
                );
            })}
            {full && (
                <>
                    {entry.conjunctions.map((conjunction) => {
                        const planetLabel = planetName(t, conjunction.planet);
                        const label = t("notepad.planetStrengths.conjunct", { planet: planetLabel });
                        const gapLine =
                            conjunction.orb !== undefined
                                ? t("notepad.planetStrengths.conjunctionGap", {
                                      gap: formatDegree(conjunction.orb),
                                  })
                                : null;
                        const lines = gapLine ? [label, gapLine] : [label];
                        const title = gapLine ? `${label} — ${gapLine}` : label;
                        return (
                            <TooltipChip
                                key={`conjunct-${conjunction.planet}`}
                                color={refColorOf(conjunction.planet)}
                                label={label}
                                ariaLabel={title}
                                lines={lines}
                                single={true}
                                delta=""
                                title={title}
                            />
                        );
                    })}
                    {entry.receivedAspects.map((received) => {
                        const planetLabel = planetName(t, received.planet);
                        const label = t("notepad.planetStrengths.aspectedBy", { planet: planetLabel });
                        const aspect: Aspect = received.aspect ?? {
                            planetName: received.planet,
                            aspectType: received.aspectType,
                            planetAbsoluteDegree: 0,
                            degreeGap: 0,
                            exactAspectDegree: received.aspectType,
                            isBeneficial: received.aspectType === 60 || received.aspectType === 120,
                            delta: 0,
                            reasons: [{ type: "planetary", angle: received.aspectType, delta: 0 }],
                        };
                        const tokens: AspectTooltipTokens = {
                            label: t("astrology.drishti.label"),
                            rashiLabel: t("astrology.drishti.rashiLabel"),
                            arrow: t("astrology.drishti.arrow"),
                            getSignName: (sign) => t(`astrology.signNames.${sign}`),
                        };
                        const tooltip = composeAspectTooltip(tokens, {
                            aspect,
                            aspectingSign: received.aspectingSign,
                        });
                        return (
                            <TooltipChip
                                key={`aspect-${received.planet}`}
                                color={refColorOf(received.planet)}
                                label={label}
                                ariaLabel={tooltip.title}
                                lines={tooltip.lines}
                                single={tooltip.single}
                                delta={tooltip.delta}
                                title={tooltip.title}
                            />
                        );
                    })}
                    {entry.bhavaSuchika !== undefined && (
                        <InfoTag
                            color={bhavaColorOf(entry.bhavaSuchika)}
                            label={t("notepad.planetStrengths.bhavaSuchika", { house: entry.bhavaSuchika })}
                            ariaLabel={t("notepad.planetStrengths.bhavaSuchika", { house: entry.bhavaSuchika })}
                        />
                    )}
                    {entry.ownedHouses.map((house) => (
                        <InfoTag
                            key={`own-${house}`}
                            color={bhavaColorOf(house)}
                            label={t("notepad.planetStrengths.factors.house", { house })}
                            ariaLabel={t("notepad.planetStrengths.ownsHouse", {
                                planet: planetName(t, entry.planet),
                                house,
                            })}
                        />
                    ))}
                    {houseOwner !== undefined && (
                        <>
                            <InfoTag
                                color={refColorOf(houseOwner)}
                                label={planetName(t, houseOwner)}
                                ariaLabel={t("notepad.planetStrengths.houseOwner", {
                                    planet: planetName(t, houseOwner),
                                })}
                            />
                            {entry.houseOwnerHouses.map((house) => (
                                <InfoTag
                                    key={`owner-house-${house}`}
                                    color={bhavaColorOf(house)}
                                    label={t("notepad.planetStrengths.factors.house", { house })}
                                    ariaLabel={t("notepad.planetStrengths.ownsHouse", {
                                        planet: planetName(t, houseOwner),
                                        house,
                                    })}
                                />
                            ))}
                        </>
                    )}
                    {entry.nakshatraOwner !== undefined && (
                        <InfoTag
                            color={refColorOf(entry.nakshatraOwner)}
                            label={planetName(t, entry.nakshatraOwner)}
                            ariaLabel={t("notepad.planetStrengths.nakshatraOwner", {
                                planet: planetName(t, entry.nakshatraOwner),
                            })}
                        />
                    )}
                </>
            )}
            {notRelevant && (
                <button
                    type="button"
                    aria-pressed={notRelevant.isIrrelevant}
                    onClick={notRelevant.onToggle}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {t(
                        notRelevant.isIrrelevant
                            ? "notepad.observation.restoreTag"
                            : "notepad.observation.markNotRelevant",
                    )}
                </button>
            )}
        </div>
    );
}

interface NotepadPlanetStrengthsProps {
    calculatedDetails: CalculatedDetailsLike | null;
    /** The note doc's `planetFactorOverrides` — student determinations of factor classifications. */
    overrides?: PlanetFactorOverrides;
    /** Record a factor override (persisted via the note pipeline). */
    onOverrideFactor?: (planet: number, factor: string, color: ObservationColor) => void;
    /** The planet whose strength panel is currently expanded (shared with the observations). */
    expandedPlanet?: number | null;
    /** Toggle a planet's strength panel. */
    onTogglePlanet?: (planet: number) => void;
}

/** The planet-strength section (TODO #26) — rendered BEFORE the parent-tag strip so the student
 *  determines each planet's strength first and that determination feeds the sections below. Every
 *  planet chip shows `{planet} ({green}/{total})` coloured by the 5-band ratio rule; clicking
 *  expands the factor (sub-tag) chips that explain the ratio. */
export default function NotepadPlanetStrengths({
    calculatedDetails,
    overrides,
    onOverrideFactor,
    expandedPlanet,
    onTogglePlanet,
}: NotepadPlanetStrengthsProps) {
    const { t } = useI18n();
    const entries = useMemo(() => computePlanetStrengths(calculatedDetails, overrides), [calculatedDetails, overrides]);

    if (entries.length === 0) return null;

    return (
        <section aria-label={t("notepad.aria.planetStrengths")} className="px-3 pt-3 pb-2 border-b border-gray-200">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 mb-1">
                {t("notepad.planetStrengths.title")}
            </h3>
            <div className="flex flex-wrap gap-1">
                {entries.map((entry) => {
                    const color = ratioColorOf(entry.ratio);
                    const showBadge = entry.ratio.total > 0;
                    const name = planetName(t, entry.planet);
                    const badge = showBadge ? ` (${entry.ratio.green}/${entry.ratio.total})` : "";
                    const isOpen = expandedPlanet === entry.planet;
                    return (
                        <span key={entry.planet} className="inline-flex flex-col">
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-label={`${name}${badge} — ${t(`notepad.observation.classification.${color}`)}`}
                                onClick={() => onTogglePlanet?.(entry.planet)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[color]} hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            >
                                <span aria-hidden className={`leading-none ${DOT_STYLES[color]}`}>
                                    ●
                                </span>
                                <span className="leading-none">{PLANET_SYMBOLS[entry.planet] ?? "?"}</span>
                                {name}
                                {badge}
                            </button>
                            {isOpen && (
                                <PlanetStrengthPanel
                                    entry={entry}
                                    onOverrideFactor={onOverrideFactor}
                                    full
                                    entries={entries}
                                />
                            )}
                        </span>
                    );
                })}
            </div>
            <p className="text-xs text-gray-400 mt-1">{t("notepad.planetStrengths.hint")}</p>
        </section>
    );
}
