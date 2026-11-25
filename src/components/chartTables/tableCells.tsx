"use client";

import AspectChip from "@/components/aspects/AspectChip";
import type { ReactNode } from "react";

import type { Aspect } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import type { TableView } from "@/lib/tableColumns";

export const NO_VALUE = "—";

export const PLANET_SYMBOLS: Record<number, string> = {
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

export const STRENGTH_TRANSLATION_KEYS: Record<PlanetaryStrength, string> = {
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

export const strengthKey = (strength: PlanetaryStrength): string =>
    `astrology.${STRENGTH_TRANSLATION_KEYS[strength] ?? "neutral"}`;

/** Per-view table chrome: the Calculations tab tables are a page section, the Charts tab tables sit
 *  inside a chart figure. */
export const VIEW_STYLES: Record<TableView, { section: string; heading: string; houses: string; planets: string }> = {
    calculations: {
        section: "bg-white rounded-lg border p-4",
        heading: "font-semibold text-sm text-indigo-700 uppercase tracking-wide",
        houses: "text-sm",
        planets: "text-sm",
    },
    charts: {
        section: "mt-4",
        heading: "text-xs font-semibold text-indigo-700 uppercase tracking-wide",
        houses: "text-sm",
        planets: "text-xs",
    },
};

interface AspectChipsProps {
    aspects: Aspect[];
    getPlanetName: (planet: number) => string;
    withSymbol: boolean;
    showDelta: boolean;
    /** Sign of the aspecting planet (rashi tooltip line); omitted → no rashi line. */
    signOf?: (planet: number) => number | undefined;
}

/** A wrap of AspectChips, or the no-value dash. */
export function AspectChips({ aspects, getPlanetName, withSymbol, showDelta, signOf }: AspectChipsProps) {
    if (aspects.length === 0) return <>{NO_VALUE}</>;
    return (
        <span className="inline-flex flex-wrap gap-1">
            {aspects.map((aspect) => (
                <AspectChip
                    key={aspect.planetName}
                    aspect={aspect}
                    showDelta={showDelta}
                    planetLabel={
                        withSymbol
                            ? `${PLANET_SYMBOLS[aspect.planetName] ?? ""} ${getPlanetName(aspect.planetName)}`.trim()
                            : getPlanetName(aspect.planetName)
                    }
                    aspectingSign={signOf?.(aspect.planetName)}
                />
            ))}
        </span>
    );
}

interface ColumnHeaderProps {
    title: string;
    view: TableView;
    menu: ReactNode;
}

/** Table heading row: the title plus the column-configuration menu on the right. */
export function TableHeading({ title, view, menu }: ColumnHeaderProps) {
    const heading = VIEW_STYLES[view].heading;
    return (
        <div className="flex items-center justify-between gap-2 mb-2">
            {view === "calculations" ? <h3 className={heading}>{title}</h3> : <h4 className={heading}>{title}</h4>}
            {menu}
        </div>
    );
}
