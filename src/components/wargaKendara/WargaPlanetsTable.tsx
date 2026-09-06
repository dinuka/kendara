"use client";

import AspectChip from "@/components/aspects/AspectChip";
import { useI18n } from "@/hooks/useI18n";

import { getNakshatraLord } from "@/lib/astrology";
import type { Aspect } from "@/lib/astrology";
import { PlanetaryStrength } from "@/lib/astrologyEnums";
import { ownedHousesOf } from "@/lib/manualChart";
import type { WargaChartEntry, WargaPlanetRow } from "@/lib/wargaKendara";

interface WargaPlanetsTableProps {
    /** The per-chart entry — the row values plus the flag lists of the Other cell. */
    entry: WargaChartEntry;
    /** Localized figure caption — combined with the table title for the sr-only caption. */
    caption: string;
    /** D1 rows show the Nakshatra (Pada) and Bhava Suchika columns and all twelve D1-only flags in
     *  the Other cell; the other charts show only the three per-chart values (UX §4.3). */
    isD1: boolean;
    /** Per-planet Bhava Suchika values for the D1 table — the top-level calculatedDetails field,
     *  resolved by the page (never part of the warga entry itself). */
    bhavaSuchika?: Record<number, number>;
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

interface OtherItem {
    key: string;
    label: string;
    /** Wargoththama is struck through when the planet is simultaneously Gandanta/Gandamula (the
     *  existing calc-tab rule). Set per planet row — never on the shared skeleton. */
    strikethrough?: boolean;
}

/** The Other cell: twelve D1-only flags (wargoththama, pushkara, gandanta, gandamula, the 22nd
 *  drekkana and 64th navamsa lords, cheshta/kala bala, ashtamansha, atmakaraka, combust, badhaka)
 *  plus the three per-chart values (maraka, maranakaraka, dig bala) — UX §4.3. */
function otherItemSkeletons(entry: WargaChartEntry, isD1: boolean, t: (key: string) => string): OtherItem[] {
    const items: OtherItem[] = [];
    if (isD1) {
        items.push(
            { key: "wargoththama", label: t("astrology.wargoththamaLabel") },
            { key: "pushkara", label: t("astrology.pushkaraLabel") },
            { key: "gandanta", label: t("astrology.gandantaLabel") },
            { key: "gandamula", label: t("astrology.gandamulaLabel") },
            { key: "navamsaLord", label: t("astrology.navamsaLordLabel") },
            { key: "drekkanaLord", label: t("astrology.drekkanaLordLabel") },
            { key: "cheshtaBala", label: t("astrology.cheshtaBalaLabel") },
            { key: "ashtamansha", label: t("astrology.ashtamanshaLabel") },
            { key: "kalaBala", label: t("astrology.kalaBalaLabel") },
            { key: "atmakaraka", label: t("astrology.atmakarakaLabel") },
            { key: "combust", label: t("astrology.combustLabel") },
            { key: "badhaka", label: t("astrology.badhakaLabel") },
        );
    }
    items.push(
        { key: "maraka", label: t("astrology.marakaLabel") },
        { key: "maranakaraka", label: t("astrology.maranakarakaLabel") },
        { key: "digBala", label: t("astrology.digBalaLabel") },
    );
    return items;
}

/** Whether the flag key applies to the given planet row. */
function flagApplies(source: WargaChartEntry, key: string, planetName: number): boolean {
    switch (key) {
        case "wargoththama":
            return source.wargoththamaPlanets?.includes(planetName) ?? false;
        case "pushkara":
            return source.pushkaraPlanets?.includes(planetName) ?? false;
        case "gandanta":
            return source.gandanthaPlanets?.includes(planetName) ?? false;
        case "gandamula":
            return source.gandamulaPlanets?.includes(planetName) ?? false;
        case "navamsaLord":
            return source.lord64thNavamsa === planetName;
        case "drekkanaLord":
            return source.lord22ndDrekkana === planetName;
        case "cheshtaBala":
            return source.cheshtaBalaPlanets?.includes(planetName) ?? false;
        case "ashtamansha":
            return source.ashtamanshaPlanets?.includes(planetName) ?? false;
        case "kalaBala":
            return source.kalaBalaPlanets?.includes(planetName) ?? false;
        case "atmakaraka":
            return source.atmakaraka === planetName;
        case "combust":
            return source.combustPlanets?.includes(planetName) ?? false;
        case "badhaka":
            return source.badhakaPlanets?.includes(planetName) ?? false;
        case "maraka":
            return source.marakaPlanets.includes(planetName);
        case "maranakaraka":
            return source.maranakaraka.includes(planetName);
        case "digBala":
            return source.digBalaPlanets.includes(planetName);
        default:
            return false;
    }
}

/** Build the AspectChip record for a warga aspect: the whole-sign angle IS the aspect, there is no
 *  degree gap or delta (UX §4.3 — no inline degree/delta text; the tooltip falls back to a single
 *  planetary reason with the angle). */
function aspectChipRecord(planetName: number, aspectType: number): Aspect {
    return {
        planetName,
        aspectType,
        planetAbsoluteDegree: 0,
        degreeGap: 0,
        exactAspectDegree: aspectType,
        isBeneficial: aspectType === 60 || aspectType === 120,
        delta: 0,
        reasons: [{ type: "planetary", angle: aspectType, delta: 0 }],
    };
}

/** Per-chart Warga Kendara Planets table (UX §4.3): Planet, Sign, Str, House, Conjunctions,
 *  Aspects, Other + (D1 only) Nakshatra (Pada) and Bhava Suchika. Desktop renders a real <table>
 *  (>= 640px); mobile renders complete-info cards per the warga mobile wireframe (no expansion).
 *  Conjunction/aspect cells are planet-only — never degree text (UI-WK-320). */
const WargaPlanetsTable = ({ entry, caption, isD1, bhavaSuchika }: WargaPlanetsTableProps) => {
    const { t } = useI18n();
    const getSignName = (sign: number): string => t(`astrology.signNames.${sign}`);
    const getPlanetName = (planetName: number): string => t(`astrology.planetNames.${planetName}`);
    const getNakshatraName = (nakshatra: number): string => t(`astrology.nakshatraNames.${nakshatra}`);
    const noDetails = t("astrology.wargaKendara.noDetails");

    const skeletons = otherItemSkeletons(entry, isD1, t);

    const ownershipByPlanet = new Map<number, number[]>(
        entry.planets.map((planet) => [planet.name, ownedHousesOf(planet.name, entry.houses)]),
    );

    const flagCell = (planet: WargaPlanetRow): OtherItem[] =>
        skeletons
            .filter((item) => flagApplies(entry, item.key, planet.name))
            .map((item) => ({
                ...item,
                strikethrough:
                    item.key === "wargoththama" &&
                    ((entry.gandanthaPlanets?.includes(planet.name) || entry.gandamulaPlanets?.includes(planet.name)) ??
                        false),
            }));

    const planetCell = (planetName: number): string =>
        `${PLANET_SYMBOLS[planetName] ?? ""} ${getPlanetName(planetName)}`.trim();

    const aspectCell = (planet: WargaPlanetRow) =>
        planet.aspects.length > 0 ? (
            <span className="inline-flex flex-wrap gap-1">
                {planet.aspects.map((aspect) => (
                    <AspectChip
                        key={aspect.planetName}
                        aspect={aspectChipRecord(aspect.planetName, aspect.aspectType)}
                        planetLabel={planetCell(aspect.planetName)}
                        aspectingSign={planet.sign}
                    />
                ))}
            </span>
        ) : (
            noDetails
        );

    const conjunctionCell = (planet: WargaPlanetRow): string =>
        planet.conjunctions.length > 0 ? planet.conjunctions.map(getPlanetName).join(", ") : noDetails;

    const nakshatraCell = (planet: WargaPlanetRow): string =>
        planet.nakshatra !== undefined && planet.pada !== undefined
            ? `${getNakshatraName(planet.nakshatra) || planet.nakshatra} (${getPlanetName(
                  getNakshatraLord(planet.nakshatra),
              )}) (${planet.pada})`
            : noDetails;

    const bhavaSuchikaCell = (planet: WargaPlanetRow): string => {
        const value = bhavaSuchika?.[planet.name];
        return value !== undefined ? `${value}` : noDetails;
    };

    const strengthLabel = (strength: PlanetaryStrength): string =>
        t(`astrology.${STRENGTH_TRANSLATION_KEYS[strength] ?? "neutral"}`);

    const renderFlags = (items: OtherItem[]) =>
        items.length > 0 ? (
            <span className="flex flex-wrap gap-1">
                {items.map((item) => (
                    <span
                        key={item.key}
                        className={`text-[10px] leading-tight px-1 rounded bg-gray-100 text-gray-600 ${
                            item.strikethrough ? "line-through" : ""
                        }`}
                    >
                        {item.label}
                    </span>
                ))}
            </span>
        ) : (
            noDetails
        );

    const rowText = (planet: WargaPlanetRow): string => {
        const parts = [
            planetCell(planet.name),
            getSignName(planet.sign),
            `${t("astrology.strength")} ${strengthLabel(planet.strength)}`,
            `${t("astrology.house")} ${planet.house}`,
            `${t("astrology.ownership")} ${ownershipByPlanet.get(planet.name)?.join(", ") || noDetails}`,
        ];
        if (isD1) {
            parts.push(`${t("astrology.nakshatra")} ${nakshatraCell(planet)}`);
            parts.push(`${t("astrology.bhavaSuchika.label")} ${bhavaSuchikaCell(planet)}`);
        }
        parts.push(`${t("astrology.conjunctions")} ${conjunctionCell(planet)}`);
        parts.push(
            `${t("astrology.aspects")} ${
                planet.aspects.map((aspect) => planetCell(aspect.planetName)).join(", ") || noDetails
            }`,
        );
        parts.push(
            `${t("astrology.other")} ${
                flagCell(planet)
                    .map((item) => item.label)
                    .join(", ") || noDetails
            }`,
        );
        return parts.join(" · ");
    };

    return (
        <section className="mt-4">
            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                {t("astrology.planets")}
            </h4>
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                    <caption className="sr-only">
                        {caption} — {t("astrology.planets")}
                    </caption>
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.planet")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.sign")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.strength")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.house")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.ownership")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.conjunctions")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.aspects")}
                            </th>
                            {isD1 && (
                                <th scope="col" className="py-1 pr-3 font-medium">
                                    {t("astrology.nakshatra")} ({t("astrology.pada")})
                                </th>
                            )}
                            {isD1 && (
                                <th scope="col" className="py-1 pr-3 font-medium">
                                    {t("astrology.bhavaSuchika.label")}
                                </th>
                            )}
                            <th scope="col" className="py-1 font-medium">
                                {t("astrology.other")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {entry.planets.map((planet) => (
                            <tr key={planet.name} className="border-b border-gray-50 align-top even:bg-gray-100">
                                <td className="py-1 pr-3 font-medium whitespace-nowrap">{planetCell(planet.name)}</td>
                                <td className="py-1 pr-3 whitespace-nowrap">{getSignName(planet.sign)}</td>
                                <td className="py-1 pr-3 whitespace-nowrap">{strengthLabel(planet.strength)}</td>
                                <td className="py-1 pr-3">{planet.house}</td>
                                <td className="py-1 pr-3 whitespace-nowrap">
                                    {ownershipByPlanet.get(planet.name)?.join(", ") || noDetails}
                                </td>
                                <td className="py-1 pr-3 whitespace-nowrap">{conjunctionCell(planet)}</td>
                                <td className="py-1 pr-3">{aspectCell(planet)}</td>
                                {isD1 && <td className="py-1 pr-3 whitespace-nowrap">{nakshatraCell(planet)}</td>}
                                {isD1 && <td className="py-1 pr-3 whitespace-nowrap">{bhavaSuchikaCell(planet)}</td>}
                                <td className="py-1">{renderFlags(flagCell(planet))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="sm:hidden space-y-2" role="list">
                {entry.planets.map((planet) => (
                    <div
                        key={planet.name}
                        role="listitem"
                        aria-label={rowText(planet)}
                        className="border rounded p-2 text-xs text-gray-700"
                    >
                        <p className="font-medium">
                            {planetCell(planet.name)} · {getSignName(planet.sign)} · {strengthLabel(planet.strength)} ·{" "}
                            {t("astrology.house")} {planet.house} · {t("astrology.ownership")}{" "}
                            {ownershipByPlanet.get(planet.name)?.join(", ") || noDetails}
                        </p>
                        {isD1 && (
                            <p className="mt-1">
                                {t("astrology.nakshatra")}: {nakshatraCell(planet)} ·{" "}
                                {t("astrology.bhavaSuchika.label")}: {bhavaSuchikaCell(planet)}
                            </p>
                        )}
                        <p className="text-gray-500 mt-1">
                            {t("astrology.conjunctions")}: {conjunctionCell(planet)} · {t("astrology.aspects")}:{" "}
                            {planet.aspects.map((aspect) => planetCell(aspect.planetName)).join(", ") || noDetails}
                        </p>
                        <div className="mt-1">
                            {t("astrology.other")}: {renderFlags(flagCell(planet))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default WargaPlanetsTable;
