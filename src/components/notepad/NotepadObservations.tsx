"use client";

import { PlanetStrengthPanel } from "@/components/notepad/NotepadPlanetStrengths";
import TagColorPicker, { type TagColorPickerFooter, type TagColorSwatch } from "@/components/notepad/TagColorPicker";
import { useI18n } from "@/hooks/useI18n";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";

import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { OBSERVATION_COLOR_CATALOG, type ObservationColor } from "@/lib/notepadCatalogs";
import { NOT_AVAILABLE_LABEL_KEY, observationTagId, resolveNotepadObservation } from "@/lib/notepadObservations";
import type {
    CalculatedDetailsLike,
    ObservationSection,
    ObservationSectionKey,
    ObservationTagBase,
} from "@/lib/notepadObservations";
import { computePlanetStrengths } from "@/lib/planetStrength";
import type { PlanetFactorOverrides, PlanetStrengthEntry } from "@/lib/planetStrength";
import type { WargaChartKey } from "@/lib/wargaKendara";

interface NotepadObservationsProps {
    calculatedDetails: CalculatedDetailsLike | null;
    parentTag: number | null;
    subTag: string | null;
    /** Student color overrides for derived tags, keyed by `observationTagId(...)` — the note doc's
     *  `observationTagOverrides`. The override wins over the derived color when present. */
    overrides?: Record<string, string>;
    /** Record a color override for a derived tag (persisted via the note pipeline). */
    onOverrideColor?: (tagId: string, color: ObservationColor) => void;
    /** Derived tags the student marked not relevant (`observationTagId(...)` keys) — struck through
     *  and excluded from every section's ratio (the note doc's `irrelevantTagIds`). */
    irrelevantTagIds?: string[];
    /** Toggle a derived tag's not-relevant state (persisted via the note pipeline). */
    onToggleIrrelevant?: (tagId: string) => void;
    /** Student determinations of planet-factor classifications (`HoroscopeNote.planetFactorOverrides`)
     *  — the effective factor colors feed the ratio badges on planet chips here. */
    planetFactorOverrides?: Record<string, Record<string, string>>;
    /** Record a planet-factor override (persisted via the note pipeline). */
    onOverridePlanetFactor?: (planet: number, factor: string, color: ObservationColor) => void;
}

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

const CHART_DISPLAY: Record<WargaChartKey, string> = {
    d1: "D1",
    d9: "D9",
    chandraLagna: "chandraLagna",
    suryaLagna: "suryaLagna",
};

const SECTION_ORDER: ObservationSectionKey[] = [
    "planetsInHouse",
    "houseLord",
    "nakshatraLoad",
    "subTagPlanet",
    "chandraLagnaHouse",
    "suryaLagnaHouse",
    "wargaKendara",
];

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

/** Swatch background classes for the color picker — keyed by every ObservationColor so a derived
 *  color outside the palette (e.g. plain "green") still renders a visible current swatch. Dark
 *  swatches are solid (match the dark chips), light swatches pastel. */
const SWATCH_CLASSES: Record<ObservationColor, string> = {
    green: "bg-green-500",
    darkGreen: "bg-green-600",
    lightGreen: "bg-green-200",
    red: "bg-red-500",
    lightRed: "bg-red-200",
    darkRed: "bg-red-600",
    yellow: "bg-amber-400",
    white: "bg-white border border-gray-400",
};

/** The picker swatches for system tags — exactly the shared 6-color palette, labels localized via
 *  the classification keys. */
function paletteSwatches(t: Translate): TagColorSwatch[] {
    return OBSERVATION_COLOR_CATALOG.map((color) => ({
        value: color,
        className: SWATCH_CLASSES[color],
        label: t(`notepad.observation.classification.${color}`),
    }));
}

function strengthKeyOf(strength: number | undefined): string | undefined {
    if (strength === undefined || Number.isNaN(strength)) return undefined;
    return STRENGTH_TRANSLATION_KEYS[strength as PlanetaryStrength];
}

function planetName(t: Translate, name: number | undefined): string {
    return name === undefined ? "?" : t(`astrology.planetNames.${name}`);
}

function signName(t: Translate, sign: number | undefined): string {
    return sign === undefined ? "?" : t(`astrology.signNames.${sign}`);
}

function nakshatraName(t: Translate, id: number | undefined): string {
    return id === undefined ? "?" : t(`astrology.nakshatraNames.${id}`);
}

interface ChipProps {
    tag: ObservationTagBase;
    tagId: string;
    overrides?: Record<string, string>;
    onOverrideColor?: (tagId: string, color: ObservationColor) => void;
    isIrrelevant: boolean;
    onToggleIrrelevant?: (tagId: string) => void;
    t: Translate;
    /** The planet-strength entries (with student overrides applied) — used for the ratio badge and
     *  the strength panel on planet-referencing tags. */
    strengths: PlanetStrengthEntry[];
    expandedPlanet?: number | null;
    onTogglePlanet?: (planet: number) => void;
    onOverridePlanetFactor?: (planet: number, factor: string, color: ObservationColor) => void;
}

/** The effective color of a tag — the student's stored override when present, the derived color
 *  otherwise. */
function effectiveColorOf(
    tag: ObservationTagBase,
    overrides: Record<string, string> | undefined,
    tagId: string,
): ObservationColor {
    return (overrides?.[tagId] as ObservationColor | undefined) ?? tag.color;
}

/** Planet-referencing tags render as `PlanetChip` (kinds "planet", "lord", "d1LoadInWarga") — the
 *  ratio badge + strength panel distinguish them from the other tags in a section. */
function isPlanetChipTag(tag: ObservationTagBase): boolean {
    return tag.kind === "planet" || tag.kind === "lord" || tag.kind === "d1LoadInWarga";
}

/** Planet chip (kind "planet", "lord", "d1LoadInWarga") with the ShadBalaTable/AspectChip tooltip
 *  pattern — hover (150ms delay) / focus opens a fixed-position card with strength + nakshatra
 *  (pada) + house; Esc closes. Clicking opens the shared strength panel (TODO #26) instead of the
 *  colour picker — the factor chips explain the ratio shown on the chip, and the panel keeps the
 *  "mark not relevant / restore" toggle. The chip keeps its derived strength colour (`tag.color`),
 *  never the ratio band colour, per the "show ratio, keep strength colours" decision. The `title`
 *  fallback carries the same text for no-JS/print. */
function PlanetChip({
    tag,
    tagId,
    isIrrelevant,
    onToggleIrrelevant,
    t,
    strengths,
    expandedPlanet,
    onTogglePlanet,
    onOverridePlanetFactor,
}: ChipProps) {
    const { locale } = useI18n();
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const tooltipId = useId();

    const color = tag.color;
    const entry = strengths.find((s) => s.planet === tag.planet);
    const name = planetName(t, tag.planet);
    const label =
        tag.kind === "planet" ? `${name} · ${signName(t, tag.sign)} · ${tag.house ?? "?"}` : composeTagLabel(t, tag);
    const ratioBadge = entry && entry.ratio.total > 0 ? ` (${entry.ratio.green}/${entry.ratio.total})` : "";
    const isOpen = expandedPlanet === tag.planet;
    const strengthKey = strengthKeyOf(tag.strength);
    const strengthLine = strengthKey ? t(`astrology.${strengthKey}`) : undefined;
    const nakshatraLine =
        tag.nakshatra !== undefined
            ? `${t(`astrology.nakshatraNames.${tag.nakshatra}`)}${tag.pada !== undefined ? ` ${tag.pada}` : ""}`
            : undefined;
    const titleLines = [strengthLine, nakshatraLine, `House ${tag.house ?? "?"}`].filter(
        (line): line is string => line !== undefined,
    );
    const title = `${label} — ${titleLines.join(", ")}`;

    const updatePosition = () => {
        const el = buttonRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const GAP = 8;
        const ESTIMATED_HEIGHT = 96;
        let top = rect.top - ESTIMATED_HEIGHT - GAP;
        if (top < 8) top = rect.bottom + GAP;
        let left = rect.left + rect.width / 2;
        left = Math.min(Math.max(left, 160), window.innerWidth - 160);
        setPosition({ top, left });
    };

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
    }, [open]);

    useEffect(
        () => () => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
        },
        [],
    );

    const ariaText = tag.kind === "planet" ? name : label;
    return (
        <span className="inline-flex flex-col items-start">
            <button
                ref={buttonRef}
                type="button"
                aria-expanded={isOpen}
                aria-describedby={open ? tooltipId : undefined}
                aria-label={`${ariaText} (${t(`notepad.observation.classification.${color}`)})${irrelevantSuffix(
                    t,
                    isIrrelevant,
                )}`}
                title={title}
                onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(openTooltip, 150);
                }}
                onMouseLeave={closeTooltip}
                onFocus={openTooltip}
                onBlur={closeTooltip}
                onClick={() => {
                    if (tag.planet !== undefined) onTogglePlanet?.(tag.planet);
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[color]} hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isIrrelevant ? "line-through opacity-70" : ""
                }`}
            >
                <span aria-hidden className={`leading-none ${DOT_STYLES[color]}`}>
                    ●
                </span>
                {tag.kind === "planet" && (
                    <span className="leading-none">{PLANET_SYMBOLS[tag.planet ?? 0] ?? "?"}</span>
                )}
                {label}
                {ratioBadge}
            </button>
            {open && position && (
                <span
                    className="fixed"
                    role="presentation"
                    style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
                >
                    <span
                        id={tooltipId}
                        role="tooltip"
                        aria-label={title}
                        className={`pointer-events-none rounded-lg border bg-white shadow-lg z-50 px-3 py-2 text-left ${
                            locale === "si" ? "max-w-[320px]" : "max-w-[280px]"
                        }`}
                    >
                        <span className="block text-[13px] font-bold text-gray-800 leading-[1.5]">{label}</span>
                        {titleLines.map((line) => (
                            <span key={line} className="block text-xs text-gray-700 leading-[1.5]">
                                · {line}
                            </span>
                        ))}
                    </span>
                </span>
            )}
            {isOpen && entry && (
                <PlanetStrengthPanel
                    entry={entry}
                    onOverrideFactor={onOverridePlanetFactor}
                    notRelevant={
                        onToggleIrrelevant && tag.labelKey !== NOT_AVAILABLE_LABEL_KEY
                            ? {
                                  isIrrelevant,
                                  onToggle: () => onToggleIrrelevant(tagId),
                              }
                            : null
                    }
                />
            )}
        </span>
    );
}

function chartDisplayName(t: Translate, chart: WargaChartKey | undefined): string {
    if (!chart) return "?";
    const display = CHART_DISPLAY[chart];
    if (display === "chandraLagna" || display === "suryaLagna") return t(`notepad.${display}`);
    return display;
}

/** Compose a tag's localized label from its structured fields or its labelKey + params. */
function composeTagLabel(t: Translate, tag: ObservationTagBase): string {
    if (tag.labelKey) {
        if (tag.labelKey === "notepad.observation.nakshatraLoad") {
            const nakshatraId = tag.params?.nakshatra;
            return t(tag.labelKey, {
                name: nakshatraId === undefined ? "?" : t(`astrology.nakshatraNames.${nakshatraId}`),
                pada: tag.pada ?? 1,
            });
        }
        if (tag.labelKey === "notepad.observation.houseLoad") {
            // The UX message renders the house number as {count} and the planet count as {planets}.
            return t(tag.labelKey, {
                count: tag.params?.house ?? "?",
                planets: tag.params?.count ?? 0,
                sign: signName(t, tag.sign),
            });
        }
        return t(tag.labelKey);
    }
    switch (tag.kind) {
        case "planet":
            return `${planetName(t, tag.planet)} · ${signName(t, tag.sign)} · ${tag.house ?? "?"}`;
        case "house":
            return t("notepad.observation.chartHouseLabel", {
                chart: chartDisplayName(t, tag.chart),
                house: tag.house ?? "?",
                planets: tag.planets?.length ?? 0,
                load: tag.loadCount ?? 0,
            });
        case "lagna":
            return t("notepad.observation.wargaLagnaLabel", {
                chart: chartDisplayName(t, tag.chart),
                sign: signName(t, tag.lagnaSign),
                load: tag.loadCount ?? 0,
            });
        case "d1LoadInWarga": {
            const strengthKey = strengthKeyOf(tag.strength);
            const base = t("notepad.observation.d1LoadInWargaLabel", {
                planet: planetName(t, tag.planet),
                sign: signName(t, tag.sign),
                house: tag.house ?? "?",
            });
            const strength = strengthKey ? ` · ${t(`astrology.${strengthKey}`)}` : "";
            return `${base}${strength}`;
        }
        case "lord":
            return `${planetName(t, tag.planet)} - ${tag.position ?? "?"}`;
        case "lordDetail":
            return composeLordDetailLabel(t, tag);
        default:
            return "?";
    }
}

/** Compose a house-lord related tag's label from its `detail` discriminator. */
function composeLordDetailLabel(t: Translate, tag: ObservationTagBase): string {
    const planet = planetName(t, tag.planet);
    switch (tag.detail) {
        case "ownsHouses":
            return t("notepad.observation.lord.ownsHouses", { planet, houses: (tag.houses ?? []).join(", ") });
        case "inSign":
            return t("notepad.observation.lord.inSign", { planet, sign: signName(t, tag.sign) });
        case "inNakshatra": {
            const base = t("notepad.observation.lord.inNakshatra", {
                planet,
                nakshatra: nakshatraName(t, tag.nakshatra),
            });
            return tag.pada !== undefined ? `${base} (${tag.pada})` : base;
        }
        case "strength": {
            const key = strengthKeyOf(tag.strength);
            return t("notepad.observation.lord.strength", {
                planet,
                strength: key ? t(`astrology.${key}`) : "?",
            });
        }
        case "retrograde":
            return t("notepad.observation.lord.retrograde", { planet });
        case "combust":
            return t("notepad.observation.lord.combust", { planet });
        case "navamsa":
            return t("notepad.observation.lord.navamsa", { planet, sign: signName(t, tag.sign) });
        case "ashtamamsha":
            return t("notepad.observation.lord.ashtamamsha", { planet });
        case "ashtamansha":
            return t("notepad.observation.lord.ashtamansha", { planet });
        case "kalaBala":
            return t(tag.flag ? "notepad.observation.lord.kalaBala" : "notepad.observation.lord.noKalaBala", {
                planet,
            });
        case "cheshtaBala":
            return t(tag.flag ? "notepad.observation.lord.cheshtaBala" : "notepad.observation.lord.noCheshtaBala", {
                planet,
            });
        case "conjuncts":
            return t("notepad.observation.lord.conjuncts", { planet, target: planetName(t, tag.target) });
        case "aspectsMade":
            return t("notepad.observation.lord.aspects", { planet, target: planetName(t, tag.target) });
        case "aspectsReceived":
            return t("notepad.observation.lord.aspectedBy", { planet, target: planetName(t, tag.target) });
        case "bhavaSuchika":
            return t("notepad.observation.lord.bhavaSuchika", { planet, house: tag.bhavaSuchikaHouse ?? "?" });
        case "atmakaraka":
            return t("notepad.observation.lord.atmakaraka", { planet });
        case "yogakaraka":
            return t("notepad.observation.lord.yogakaraka", { planet });
        case "maranakaraka":
            return t("notepad.observation.lord.maranakaraka", { planet });
        case "maraka":
            return t("notepad.observation.lord.maraka", { planet });
        case "badhaka":
            return t("notepad.observation.lord.badhaka", { planet });
        case "nidhanamsha":
            return t("notepad.observation.lord.nidhanamsha", { planet });
        case "wargoththama":
            return t("notepad.observation.lord.wargoththama", { planet });
        case "gandantha":
            return t("notepad.observation.lord.gandantha", { planet });
        case "gandamula":
            return t("notepad.observation.lord.gandamula", { planet });
        case "pushkara":
            return t("notepad.observation.lord.pushkara", { planet });
        case "drekkanaLord":
            return t("notepad.observation.lord.drekkanaLord", { planet });
        case "navamsaLord":
            return t("notepad.observation.lord.navamsaLord", { planet });
        default:
            return "?";
    }
}

function TagChip({
    tag,
    tagId,
    overrides,
    onOverrideColor,
    isIrrelevant,
    onToggleIrrelevant,
    t,
    strengths,
    expandedPlanet,
    onTogglePlanet,
    onOverridePlanetFactor,
}: ChipProps) {
    const planetKind = isPlanetChipTag(tag);
    if (planetKind) {
        return (
            <PlanetChip
                tag={tag}
                tagId={tagId}
                overrides={overrides}
                onOverrideColor={onOverrideColor}
                isIrrelevant={isIrrelevant}
                onToggleIrrelevant={onToggleIrrelevant}
                t={t}
                strengths={strengths}
                expandedPlanet={expandedPlanet}
                onTogglePlanet={onTogglePlanet}
                onOverridePlanetFactor={onOverridePlanetFactor}
            />
        );
    }
    const [pickerOpen, setPickerOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const color = effectiveColorOf(tag, overrides, tagId);
    const label = composeTagLabel(t, tag);
    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-label={`${label} (${t(`notepad.observation.classification.${color}`)})${irrelevantSuffix(
                    t,
                    isIrrelevant,
                )}`}
                onClick={() => setPickerOpen((current) => !current)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CHIP_STYLES[color]} hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isIrrelevant ? "line-through opacity-70" : ""
                }`}
            >
                <span aria-hidden className={`leading-none ${DOT_STYLES[color]}`}>
                    ●
                </span>
                {label}
            </button>
            {pickerOpen && buttonRef.current && (
                <TagColorPicker
                    swatches={paletteSwatches(t)}
                    current={color}
                    anchor={buttonRef.current}
                    onPick={(value) => {
                        if (onOverrideColor && typeof value === "string") {
                            onOverrideColor(tagId, value as ObservationColor);
                        }
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                    footer={irrelevantFooter(t, tag, tagId, isIrrelevant, onToggleIrrelevant, () =>
                        setPickerOpen(false),
                    )}
                />
            )}
        </>
    );
}

/** The not-relevant aria suffix for a struck-through chip ("… (good) — not relevant"). */
function irrelevantSuffix(t: Translate, isIrrelevant: boolean): string {
    return isIrrelevant ? ` — ${t("notepad.observation.notRelevant")}` : "";
}

/** The picker's "not relevant" toggle row — null for the neutral not-available tag (a degraded
 *  section has no real observation to dismiss). */
function irrelevantFooter(
    t: Translate,
    tag: ObservationTagBase,
    tagId: string,
    isIrrelevant: boolean,
    onToggleIrrelevant: ((tagId: string) => void) | undefined,
    close: () => void,
): TagColorPickerFooter | null {
    if (tag.labelKey === NOT_AVAILABLE_LABEL_KEY || !onToggleIrrelevant) return null;
    return {
        label: t(isIrrelevant ? "notepad.observation.restoreTag" : "notepad.observation.markNotRelevant"),
        active: isIrrelevant,
        onPress: () => {
            onToggleIrrelevant(tagId);
            close();
        },
    };
}

function SectionBlock({
    section,
    overrides,
    onOverrideColor,
    irrelevantTagIds,
    onToggleIrrelevant,
    strengths,
    expandedPlanet,
    onTogglePlanet,
    onOverridePlanetFactor,
    t,
}: {
    section: ObservationSection;
    overrides?: Record<string, string>;
    onOverrideColor?: (tagId: string, color: ObservationColor) => void;
    irrelevantTagIds?: string[];
    onToggleIrrelevant?: (tagId: string) => void;
    strengths: PlanetStrengthEntry[];
    expandedPlanet?: number | null;
    onTogglePlanet?: (planet: number) => void;
    onOverridePlanetFactor?: (planet: number, factor: string, color: ObservationColor) => void;
    t: Translate;
}) {
    const ratioLabel = t("notepad.aria.ratio", { green: section.ratio.green, total: section.ratio.total });
    const showBadge = section.tags.length > 0 && section.ratio.total > 0;

    let emptyText: string | null = null;
    if (section.tags.length === 0) {
        emptyText =
            section.key === "subTagPlanet"
                ? t("notepad.observation.noSignificant")
                : t("notepad.observation.noPlanets");
    }

    // Index of the first non-planet tag — the planet-tag group ends right before it.
    const firstOtherTag = section.tags.findIndex((tag) => !isPlanetChipTag(tag));
    const hasPlanetTags = firstOtherTag > 0;

    return (
        <section aria-label={t(`notepad.observation.${section.key}`)}>
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    {t(`notepad.observation.${section.key}`)}
                </h3>
                {showBadge && (
                    <span
                        aria-label={ratioLabel}
                        className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"
                    >
                        ({section.ratio.green}/{section.ratio.total})
                    </span>
                )}
            </div>
            {emptyText !== null ? (
                <p className="text-xs text-gray-500">{emptyText}</p>
            ) : (
                <div className="flex flex-wrap gap-1">
                    {section.tags.map((tag, index) => {
                        const tagId = observationTagId(section.key, tag);
                        // A wider gap between the planet tags (ratio badge + strength panel) and the
                        // other tags keeps the planet group visually identifiable in a mixed row.
                        const showGap = index === firstOtherTag && hasPlanetTags;
                        return (
                            <Fragment key={`${section.key}-${index}`}>
                                {showGap && <span aria-hidden className="w-3" />}
                                <TagChip
                                    tag={tag}
                                    tagId={tagId}
                                    overrides={overrides}
                                    onOverrideColor={onOverrideColor}
                                    isIrrelevant={irrelevantTagIds?.includes(tagId) ?? false}
                                    onToggleIrrelevant={onToggleIrrelevant}
                                    t={t}
                                    strengths={strengths}
                                    expandedPlanet={expandedPlanet}
                                    onTogglePlanet={onTogglePlanet}
                                    onOverridePlanetFactor={onOverridePlanetFactor}
                                />
                            </Fragment>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

/** The seven system observation sections (UX Q4 fixed order). The derivation module runs
 *  per (parent, sub-tag) selection — memoized on the selection + `calculatedDetails` identity. */
export default function NotepadObservations({
    calculatedDetails,
    parentTag,
    subTag,
    overrides,
    onOverrideColor,
    irrelevantTagIds,
    onToggleIrrelevant,
    planetFactorOverrides,
    onOverridePlanetFactor,
}: NotepadObservationsProps) {
    const { t } = useI18n();

    /** One planet's strength panel open at a time within the observations (accordion). */
    const [expandedPlanet, setExpandedPlanet] = useState<number | null>(null);
    const togglePlanet = (planet: number) => {
        setExpandedPlanet((current) => (current === planet ? null : planet));
    };

    const irrelevant = useMemo(() => new Set(irrelevantTagIds ?? []), [irrelevantTagIds]);

    const strengths = useMemo(
        () => computePlanetStrengths(calculatedDetails, planetFactorOverrides),
        [calculatedDetails, planetFactorOverrides],
    );

    const observation = useMemo(
        () => resolveNotepadObservation(calculatedDetails, parentTag ?? 0, subTag, undefined, irrelevant),
        [calculatedDetails, parentTag, subTag, irrelevant],
    );

    if (parentTag === null) {
        return <p className="text-xs text-gray-500">{t("notepad.hint")}</p>;
    }
    if (parentTag === 0 || observation.sections.length === 0) {
        return null;
    }

    const sections = SECTION_ORDER.map((key) => observation.sections.find((s) => s.key === key)).filter(
        (s): s is ObservationSection => s !== undefined,
    );

    return (
        <div role="region" aria-label={t("notepad.aria.observationsRegion")} className="space-y-3">
            {sections.map((section) => (
                <SectionBlock
                    key={section.key}
                    section={section}
                    overrides={overrides}
                    onOverrideColor={onOverrideColor}
                    irrelevantTagIds={irrelevantTagIds}
                    onToggleIrrelevant={onToggleIrrelevant}
                    strengths={strengths}
                    expandedPlanet={expandedPlanet}
                    onTogglePlanet={togglePlanet}
                    onOverridePlanetFactor={onOverridePlanetFactor}
                    t={t}
                />
            ))}
        </div>
    );
}
