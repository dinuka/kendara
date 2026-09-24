"use client";

import AspectChip from "@/components/aspects/AspectChip";
import { useI18n } from "@/hooks/useI18n";

import type { Aspect } from "@/lib/astrology";
import type { WargaHouseRow, WargaPlanetRow } from "@/lib/wargaKendara";

interface WargaHousesTableProps {
    houses: WargaHouseRow[];
    /** The chart's planet rows — the aspecting planet's sign for the rashi tooltip line. */
    planets: WargaPlanetRow[];
    /** Localized figure caption — combined with the table title for the sr-only caption. */
    caption: string;
    /** D1 only: house → the calculation tab's aspect records (true deltas from the house middle).
     *  When present these replace the whole-sign row aspects. */
    aspectMap?: Record<number, Aspect[]>;
}

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

/** Build the AspectChip record for a warga house aspect: the whole-sign angle IS the aspect, there is
 *  no degree gap or delta (UX §4.3 — no inline degree/delta text; the tooltip falls back to a single
 *  planetary reason with the angle and the house counted from the aspecting planet). */
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

/** Per-chart Warga Kendara Houses table (UX §4.3): #, Sign, Planets, Aspects. Desktop renders a
 *  real <table> (>= 640px); mobile renders complete-info cards per the warga mobile wireframe (all
 *  columns visible, no expansion). Aspect cells render the aspecting planets as AspectChip tags —
 *  same chips as the Planets table, each anchoring the compact aspect tooltip (UI-WK-320). */
const WargaHousesTable = ({ houses, planets, caption, aspectMap }: WargaHousesTableProps) => {
    const { t } = useI18n();
    const getSignName = (sign: number): string => t(`astrology.signNames.${sign}`);
    const getPlanetName = (planetName: number): string => t(`astrology.planetNames.${planetName}`);
    const noDetails = t("astrology.wargaKendara.noDetails");

    const planetCell = (planetName: number): string =>
        `${PLANET_SYMBOLS[planetName] ?? ""} ${getPlanetName(planetName)}`.trim();

    const planetsCell = (planets: number[]): string =>
        planets.length > 0 ? planets.map(getPlanetName).join(", ") : noDetails;

    const effectiveAspects = ({ houseNumber, aspects }: WargaHouseRow): Aspect[] =>
        aspectMap?.[houseNumber] ??
        aspects.map(({ planetName, aspectType }) => aspectChipRecord(planetName, aspectType));

    const aspectsCell = (house: WargaHouseRow) =>
        effectiveAspects(house).length > 0 ? (
            <span className="inline-flex flex-wrap gap-1">
                {effectiveAspects(house).map((aspect) => (
                    <AspectChip
                        key={aspect.planetName}
                        aspect={aspect}
                        planetLabel={getPlanetName(aspect.planetName)}
                        aspectingSign={planets.find(({ name }) => name === aspect.planetName)?.sign}
                    />
                ))}
            </span>
        ) : (
            noDetails
        );

    const rowText = (house: WargaHouseRow): string =>
        `${house.houseNumber} · ${getSignName(house.sign)} · ${planetsCell(house.planets)} · ${t(
            "astrology.aspects",
        )} ${
            effectiveAspects(house)
                .map((aspect) => planetCell(aspect.planetName))
                .join(", ") || noDetails
        }`;

    return (
        <section className="mt-4">
            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                {t("astrology.houses")}
            </h4>
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {caption} — {t("astrology.houses")}
                    </caption>
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th scope="col" className="py-1 pr-3 font-medium">
                                #
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.sign")}
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                                {t("astrology.planets")}
                            </th>
                            <th scope="col" className="py-1 font-medium">
                                {t("astrology.aspects")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {houses.map((house) => (
                            <tr key={house.houseNumber} className="border-b border-gray-50 align-top even:bg-gray-100">
                                <th scope="row" className="py-1 pr-3 font-medium text-left">
                                    {house.houseNumber}
                                </th>
                                <td className="py-1 pr-3 whitespace-nowrap">{getSignName(house.sign)}</td>
                                <td className="py-1 pr-3 whitespace-nowrap">{planetsCell(house.planets)}</td>
                                <td className="py-1">{aspectsCell(house)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="sm:hidden space-y-2" role="list">
                {houses.map((house) => (
                    <div
                        key={house.houseNumber}
                        role="listitem"
                        aria-label={rowText(house)}
                        className="border rounded p-2 text-xs text-gray-700"
                    >
                        <p className="font-medium">
                            {house.houseNumber} · {getSignName(house.sign)} · {planetsCell(house.planets)}
                        </p>
                        <p className="text-gray-500 mt-1">
                            {t("astrology.aspects")}: {aspectsCell(house)}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default WargaHousesTable;
