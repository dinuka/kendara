"use client";

import SubaAsubaBadge from "@/components/papiGrahayan/SubaAsubaBadge";
import { useI18n } from "@/hooks/useI18n";
import { useTableLayout } from "@/hooks/useTablePreferences";
import type { ReactNode } from "react";

import { getNakshatraLord } from "@/lib/astrology";
import type { PlanetTableData, PlanetTableRow } from "@/lib/chartTableRows";
import { CompoundRelationship, Relationship } from "@/lib/grahaMaitri";
import {
    type ColumnSetting,
    type MaitriColumnId,
    type PlanetColumnId,
    columnDef,
    optionOn,
    visibleColumns,
} from "@/lib/tableColumns";
import type { TableView } from "@/lib/tableColumns";

import MaitriChip from "./MaitriChip";
import TableColumnsMenu from "./TableColumnsMenu";
import { AspectChips, NO_VALUE, PLANET_SYMBOLS, TableHeading, VIEW_STYLES, strengthKey } from "./tableCells";

interface PlanetsTableProps {
    /** Which saved layout to use — the Charts tab figures or the Calculations tab. */
    view: TableView;
    data: PlanetTableData;
    /** Chart caption, prefixed to the table's screen-reader caption. */
    caption?: string;
}

/** Compound relationship grade listed by each Graha Maitri column. */
const MAITRI_GRADE: Record<MaitriColumnId, CompoundRelationship> = {
    adhiMitra: CompoundRelationship.ADHI_MITRA,
    mitra: CompoundRelationship.MITRA,
    sama: CompoundRelationship.SAMA,
    shatru: CompoundRelationship.SHATRU,
    adhiShatru: CompoundRelationship.ADHI_SHATRU,
};

/** Tag colours, green (friendship) through grey to red (enmity). */
const MAITRI_TAG_STYLES: Record<MaitriColumnId, string> = {
    adhiMitra: "border-green-300 bg-green-100 text-green-900 hover:border-green-500",
    mitra: "border-green-200 bg-green-50 text-green-700 hover:border-green-400",
    sama: "border-gray-200 bg-white text-gray-700 hover:border-indigo-300",
    shatru: "border-red-200 bg-red-50 text-red-700 hover:border-red-400",
    adhiShatru: "border-red-300 bg-red-100 text-red-900 hover:border-red-500",
};

const RELATIONSHIP_KEY: Record<Relationship, string> = {
    [Relationship.FRIEND]: "astrology.grahaMaitri.friend",
    [Relationship.NEUTRAL]: "astrology.grahaMaitri.neutral",
    [Relationship.ENEMY]: "astrology.grahaMaitri.enemy",
};

/** Columns shown inline in a mobile card's first line; the rest get their own labeled line. */
const MOBILE_INLINE: ReadonlySet<PlanetColumnId> = new Set(["subaAsuba", "sign", "strength", "house"]);

/** Planets table shared by the Charts and Calculations tabs. Columns, their order and value options
 *  come from the user's saved layout for `view`; columns the chart cannot fill are skipped. Desktop
 *  renders a <table>, mobile renders one card per planet. */
export default function PlanetsTable({ view, data, caption }: PlanetsTableProps) {
    const { t } = useI18n();
    const { layout } = useTableLayout(view, "planets");
    const columns = visibleColumns(layout, data.available);
    const getSignName = (sign: number): string => t(`astrology.signNames.${sign}`);
    const getPlanetName = (planet: number): string => t(`astrology.planetNames.${planet}`);
    const getNakshatraName = (id: number): string => t(`astrology.nakshatraNames.${id}`);
    const title = t("astrology.planets");
    const planetSigns = new Map(data.rows.map((row) => [row.name, row.sign]));
    const signOf = (planet: number) => planetSigns.get(planet);

    const label = (setting: ColumnSetting): string => {
        if (setting.id === "sign" && optionOn(setting, "degree"))
            return `${t("astrology.sign")} (${t("astrology.degree")})`;
        return t(columnDef("planets", setting.id)?.labelKey ?? "");
    };

    const header = (setting: ColumnSetting): ReactNode =>
        setting.id === "bhavaSuchika" ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                {label(setting)}
                <span
                    title={t("astrology.bhavaSuchika.tooltip")}
                    aria-label={t("astrology.bhavaSuchika.infoGlyph")}
                    className="cursor-help text-gray-400 hover:text-indigo-600"
                >
                    ⓘ
                </span>
            </span>
        ) : (
            label(setting)
        );

    const planetLabel = (setting: ColumnSetting | undefined, row: PlanetTableRow): string => {
        const name = getPlanetName(row.name);
        const isRetrograde = row.retrograde && row.name !== 8 && row.name !== 9;
        const text = isRetrograde && optionOn(setting, "retrograde") ? `(${name})` : name;
        return optionOn(setting, "symbol") ? `${PLANET_SYMBOLS[row.name] ?? ""} ${text}`.trim() : text;
    };

    const cell = (setting: ColumnSetting, row: PlanetTableRow): ReactNode => {
        const chips = (aspects: PlanetTableRow["aspects"] | undefined, sign?: (p: number) => number | undefined) => (
            <AspectChips
                aspects={aspects ?? []}
                getPlanetName={getPlanetName}
                withSymbol={optionOn(setting, "symbol")}
                showDelta={data.showAspectDelta}
                signOf={sign}
            />
        );
        if (setting.id in MAITRI_GRADE) {
            const column = setting.id as MaitriColumnId;
            const entries = row.maitri?.filter((m) => m.compound === MAITRI_GRADE[column]) ?? [];
            if (entries.length === 0) return NO_VALUE;
            const from = getPlanetName(row.name);
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {entries.map((m) => {
                        const planet = getPlanetName(m.planet);
                        const reason: string[] = [
                            t("astrology.grahaMaitri.reasonTitle", {
                                from,
                                planet,
                                grade: t(`astrology.grahaMaitri.${column}`),
                            }),
                            t("astrology.grahaMaitri.reasonNatural", { relation: t(RELATIONSHIP_KEY[m.natural]) }),
                            t("astrology.grahaMaitri.reasonTemporary", {
                                relation: t(RELATIONSHIP_KEY[m.temporary]),
                                planet,
                                house: m.distance,
                                from,
                            }),
                        ];
                        return (
                            <MaitriChip
                                key={m.planet}
                                label={planet}
                                lines={reason}
                                className={MAITRI_TAG_STYLES[column]}
                            />
                        );
                    })}
                </span>
            );
        }
        switch (setting.id as PlanetColumnId) {
            case "planet":
                return planetLabel(setting, row);
            case "subaAsuba":
                return row.subaAsuba ? (
                    <SubaAsubaBadge planet={row.name} entry={row.subaAsuba} getPlanetName={getPlanetName} />
                ) : (
                    NO_VALUE
                );
            case "sign":
                return optionOn(setting, "degree") && row.degreeLabel
                    ? `${getSignName(row.sign)} (${row.degreeLabel})`
                    : getSignName(row.sign);
            case "strength":
                return t(strengthKey(row.strength));
            case "house":
                return row.house;
            case "ownership":
                return row.ownership.join(", ") || NO_VALUE;
            case "navamsa":
                return row.navamsaSign !== undefined ? getSignName(row.navamsaSign) : NO_VALUE;
            case "navamsaStrength":
                return row.navamsaStrength !== undefined ? t(strengthKey(row.navamsaStrength)) : NO_VALUE;
            case "nakshatra":
                return row.nakshatra
                    ? `${getNakshatraName(row.nakshatra.id) || row.nakshatra.id} (${getPlanetName(
                          getNakshatraLord(row.nakshatra.id),
                      )}) (${row.nakshatra.pada})`
                    : NO_VALUE;
            case "bhavaSuchika":
                if (row.bhavaSuchika === undefined) return NO_VALUE;
                return optionOn(setting, "name")
                    ? `${row.bhavaSuchika} — ${t(`astrology.bhavaSuchika.names.${row.bhavaSuchika}`)}`
                    : `${row.bhavaSuchika}`;
            case "conjunctions":
                return chips(row.conjunctions, () => row.sign);
            case "aspects":
                return chips(row.aspects, signOf);
            case "kendrasthana":
                return chips(row.kendrasthana);
            case "other": {
                const tags = row.tags.filter((tag) => optionOn(setting, tag.key));
                if (tags.length === 0) return NO_VALUE;
                return (
                    <span className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag.key}
                                className={`text-[10px] leading-tight px-1 rounded bg-gray-100 text-gray-600 whitespace-nowrap ${
                                    tag.strikethrough ? "line-through" : ""
                                }`}
                            >
                                {tag.text}
                            </span>
                        ))}
                    </span>
                );
            }
            default:
                return NO_VALUE;
        }
    };

    const nowrap = (id: string) =>
        ["planet", "sign", "strength", "ownership", "nakshatra", "bhavaSuchika"].includes(id) ? "whitespace-nowrap" : "";
    const planetSetting = columns.find((c) => c.id === "planet");
    const inlineColumns = columns.filter((c) => MOBILE_INLINE.has(c.id as PlanetColumnId));
    const detailColumns = columns.filter((c) => c.id !== "planet" && !MOBILE_INLINE.has(c.id as PlanetColumnId));

    return (
        <section className={VIEW_STYLES[view].section}>
            <TableHeading
                title={title}
                view={view}
                menu={<TableColumnsMenu view={view} kind="planets" available={data.available} />}
            />
            <div className="hidden sm:block overflow-x-auto">
                <table className={`w-full ${VIEW_STYLES[view].planets}`}>
                    <caption className="sr-only">{caption ? `${caption} — ${title}` : title}</caption>
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            {columns.map((setting) => (
                                <th key={setting.id} scope="col" className="py-1 pr-3 font-medium">
                                    {header(setting)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row) => (
                            <tr key={row.name} className="border-b border-gray-100 align-top even:bg-gray-100">
                                {columns.map((setting) => (
                                    <td
                                        key={setting.id}
                                        className={`py-1 pr-3 ${nowrap(setting.id)} ${
                                            setting.id === "planet" ? "font-medium text-gray-700" : ""
                                        }`}
                                    >
                                        {cell(setting, row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="sm:hidden space-y-2" aria-label={caption ? `${caption} — ${title}` : title}>
                {data.rows.map((row) => (
                    <li key={row.name} className="border rounded p-2 text-xs text-gray-700">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-sm">{planetLabel(planetSetting, row)}</span>
                            {inlineColumns.map((setting) => (
                                <span key={setting.id} className="text-gray-600 whitespace-nowrap">
                                    {setting.id === "house" ? `${t("astrology.house")} ${row.house}` : cell(setting, row)}
                                </span>
                            ))}
                        </div>
                        {detailColumns.map((setting) => (
                            <div key={setting.id} className="mt-1 text-gray-600">
                                <span className="font-medium text-gray-700">{label(setting)}:</span>{" "}
                                {cell(setting, row)}
                            </div>
                        ))}
                    </li>
                ))}
            </ul>
        </section>
    );
}
