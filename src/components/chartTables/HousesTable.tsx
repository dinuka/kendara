"use client";

import { useI18n } from "@/hooks/useI18n";
import { useTableLayout } from "@/hooks/useTablePreferences";
import type { ReactNode } from "react";

import type { HouseTableData, HouseTableRow } from "@/lib/chartTableRows";
import { type ColumnSetting, type HouseColumnId, columnDef, optionOn, visibleColumns } from "@/lib/tableColumns";
import type { TableView } from "@/lib/tableColumns";

import TableColumnsMenu from "./TableColumnsMenu";
import { AspectChips, NO_VALUE, TableHeading, VIEW_STYLES } from "./tableCells";

interface HousesTableProps {
    /** Which saved layout to use — the Charts tab figures or the Calculations tab. */
    view: TableView;
    data: HouseTableData;
    /** Planet → sign on this chart, for the aspect tooltips' rashi line. */
    planetSigns: Record<number, number>;
    /** Aspect tooltips show the degree delta only on degree-based charts. */
    showAspectDelta: boolean;
    /** Chart caption, prefixed to the table's screen-reader caption. */
    caption?: string;
}

/** Houses table shared by the Charts and Calculations tabs. Columns, their order and value options
 *  come from the user's saved layout for `view`; columns the chart cannot fill are skipped. Desktop
 *  renders a <table>, mobile renders one labeled card per house. */
export default function HousesTable({ view, data, planetSigns, showAspectDelta, caption }: HousesTableProps) {
    const { t } = useI18n();
    const { layout } = useTableLayout(view, "houses");
    const columns = visibleColumns(layout, data.available);
    const getSignName = (sign: number): string => t(`astrology.signNames.${sign}`);
    const getPlanetName = (planet: number): string => t(`astrology.planetNames.${planet}`);
    const title = t("astrology.houses");

    const label = (setting: ColumnSetting): string =>
        setting.id === "number" ? "#" : t(columnDef("houses", setting.id)?.labelKey ?? "");

    const cell = (setting: ColumnSetting, row: HouseTableRow): ReactNode => {
        switch (setting.id as HouseColumnId) {
            case "number":
                return row.houseNumber;
            case "sign":
                return getSignName(row.sign);
            case "start":
                return row.start ?? NO_VALUE;
            case "mid":
                return row.mid ?? NO_VALUE;
            case "end":
                return row.end ?? NO_VALUE;
            case "planets": {
                if (row.planets.length === 0) return NO_VALUE;
                const withDegree = optionOn(setting, "degree");
                return row.planets
                    .map(({ name, degreeLabel }) =>
                        withDegree && degreeLabel ? `${getPlanetName(name)} (${degreeLabel})` : getPlanetName(name),
                    )
                    .join(", ");
            }
            case "upagraha": {
                if (!row.upagrahas?.length) return NO_VALUE;
                const withDegree = optionOn(setting, "degree");
                return row.upagrahas
                    .map(({ key, degreeLabel }) => {
                        const name = t(`astrology.upagraha.${key}`);
                        return withDegree ? `${name} (${degreeLabel})` : name;
                    })
                    .join(", ");
            }
            case "other": {
                if (!row.specialLagnas?.length) return NO_VALUE;
                const withDegree = optionOn(setting, "degree");
                return row.specialLagnas
                    .map(({ key, degreeLabel }) => {
                        const name = t(`astrology.specialLagna.${key}`);
                        return withDegree && degreeLabel ? `${name} (${degreeLabel})` : name;
                    })
                    .join(", ");
            }
            case "aspects":
                return (
                    <AspectChips
                        aspects={row.aspects}
                        getPlanetName={getPlanetName}
                        withSymbol={optionOn(setting, "symbol")}
                        showDelta={showAspectDelta}
                        signOf={(planet) => planetSigns[planet]}
                    />
                );
            case "kendrasthana":
                return (
                    <AspectChips
                        aspects={row.kendrasthana ?? []}
                        getPlanetName={getPlanetName}
                        withSymbol={optionOn(setting, "symbol")}
                        showDelta={showAspectDelta}
                    />
                );
            default:
                return NO_VALUE;
        }
    };

    const muted = (id: string) => (["start", "mid", "end"].includes(id) ? "text-gray-600" : "");
    const detailColumns = columns.filter((c) => c.id !== "number" && c.id !== "sign");
    const signShown = columns.some((c) => c.id === "sign");

    return (
        <section className={VIEW_STYLES[view].section}>
            <TableHeading
                title={title}
                view={view}
                menu={<TableColumnsMenu view={view} kind="houses" available={data.available} />}
            />
            <div className="hidden sm:block overflow-x-auto">
                <table className={`w-full ${VIEW_STYLES[view].houses}`}>
                    <caption className="sr-only">{caption ? `${caption} — ${title}` : title}</caption>
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            {columns.map((setting) => (
                                <th key={setting.id} scope="col" className="py-1 pr-3 font-medium">
                                    {label(setting)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((row) => (
                            <tr key={row.houseNumber} className="border-b border-gray-100 align-top even:bg-gray-100">
                                {columns.map((setting) =>
                                    setting.id === "number" ? (
                                        <th key={setting.id} scope="row" className="py-1 pr-3 font-medium text-left">
                                            {row.houseNumber}
                                        </th>
                                    ) : (
                                        <td key={setting.id} className={`py-1 pr-3 ${muted(setting.id)}`}>
                                            {cell(setting, row)}
                                        </td>
                                    ),
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="sm:hidden space-y-2" aria-label={caption ? `${caption} — ${title}` : title}>
                {data.rows.map((row) => (
                    <li key={row.houseNumber} className="border rounded p-2 text-xs text-gray-700">
                        <p className="font-medium">
                            {t("astrology.house")} {row.houseNumber}
                            {signShown && ` · ${getSignName(row.sign)}`}
                        </p>
                        {detailColumns.map((setting) => (
                            <p key={setting.id} className="mt-1 text-gray-600">
                                <span className="font-medium text-gray-700">{label(setting)}:</span>{" "}
                                {cell(setting, row)}
                            </p>
                        ))}
                    </li>
                ))}
            </ul>
        </section>
    );
}
