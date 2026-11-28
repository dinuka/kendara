import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import { NextIntlClientProvider } from "next-intl";
import path from "path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BirthChart } from "@/components/BirthChart";
import { HouseChart } from "@/components/HouseChart";

import siMessages from "@/messages/si.json";

import type { CalculationResult } from "@/lib/astrology";
import { getChartData, toBirthChartData } from "@/lib/chartDataTransform";
import {
    birthChartAscendantDegreeLabel,
    exactSunLongitude,
    houseChartAscAbsDeg,
    houseChartAscNavamsaNum,
    houseChartPlanets,
    navamsaChartData,
} from "@/lib/chartRenderProps";
import { ChartType } from "@/lib/chartTypes";
import { buildDrekkanaChart } from "@/lib/drekkana";
import { type ManualHousePlacements, manualTrimshamshaSource } from "@/lib/manualChart";
import { buildTrimshamshaChart } from "@/lib/trimshamsha";

/** Server-side chart image rendering: the SAME React components the horoscope page shows
 *  (BirthChart / HouseChart) rendered to static SVG markup, so the stored images match the web
 *  chart — special lagnas, upagrahas, zodiac icons and all. Only interactivity is lost. */

export interface ChartRenderContext {
    isManual: boolean;
    manualHousePlacements?: ManualHousePlacements | null;
}

/** Builds the chart element exactly as the horoscope page does, always from the D1 calculation (the
 *  page derives every figure from CalculatedDetails). Returns null for chart types the page has no
 *  figure for (D10, Shodasha Vargas — name + tags only) or that don't exist for this horoscope
 *  (a manual chart without Navamsa / degree data). */
const chartElement = (type: ChartType, d1: CalculationResult, ctx: ChartRenderContext): ReactElement | null => {
    const { isManual, manualHousePlacements: mhp } = ctx;

    switch (type) {
        case ChartType.BIRTH:
            return (
                <BirthChart
                    {...toBirthChartData(d1)}
                    ascendantDegreeLabel={birthChartAscendantDegreeLabel(isManual, mhp)}
                    showInduLagna
                    horaLagnaSign={d1.horaLagna?.sign}
                    gulikaLagnaSign={d1.gulikaLagna?.sign}
                    pranapadaLagnaSign={d1.pranapadaLagna?.sign}
                    sunLongitude={exactSunLongitude(d1.planets, isManual, mhp)}
                />
            );

        case ChartType.HOUSE:
            return (
                <HouseChart
                    planets={houseChartPlanets(d1.planets, isManual, mhp)}
                    houses={d1.houses}
                    ascendant={d1.ascendant}
                    ascNavamsaNum={houseChartAscNavamsaNum(isManual, mhp)}
                    ascAbsDeg={houseChartAscAbsDeg(isManual, mhp)}
                    svgOnly
                />
            );

        case ChartType.NAVAMSA_D9: {
            const navamsa = navamsaChartData({ ...d1, manualHousePlacements: mhp }, isManual);
            return navamsa && <BirthChart {...toBirthChartData(navamsa)} showAscendantDegree={false} />;
        }

        case ChartType.SURYA_LAGNA:
        case ChartType.CHANDRA_LAGNA:
            return <BirthChart {...toBirthChartData(getChartData(d1, type))} />;

        case ChartType.DREKKANA_D3:
        case ChartType.TRIMSHAMSHA_D30: {
            // Manual charts only have real degrees for the lagna / planets the user entered.
            const source = isManual ? manualTrimshamshaSource(d1.planets, mhp) : d1;
            if (!source) return null;
            const chart = type === ChartType.DREKKANA_D3 ? buildDrekkanaChart(source) : buildTrimshamshaChart(source);
            return <BirthChart {...toBirthChartData(chart)} showAscendantDegree={false} />;
        }

        default:
            return null;
    }
};

const ZODIAC_DIR = path.join(process.cwd(), "public", "zodiac");
/** Source icons are 404x275; downscaled for embedding — still sharp at the 2x PNG export, but
 *  ~20x smaller than the originals so each SVG stays small. */
const ICON_WIDTH = 120;
const ICON_HEIGHT = Math.round((ICON_WIDTH * 275) / 404);

const iconCache = new Map<string, string>();

/** The zodiac icon as a downscaled PNG data URI, so the SVG is self-contained (no /zodiac/ URLs). */
const zodiacIconDataUri = (name: string): string => {
    const cached = iconCache.get(name);
    if (cached) return cached;
    const original = fs.readFileSync(path.join(ZODIAC_DIR, `${name}.png`)).toString("base64");
    const wrapper =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_WIDTH}" height="${ICON_HEIGHT}">` +
        `<image href="data:image/png;base64,${original}" width="${ICON_WIDTH}" height="${ICON_HEIGHT}"/></svg>`;
    const small = new Resvg(wrapper).render().asPng();
    const uri = `data:image/png;base64,${Buffer.from(small).toString("base64")}`;
    iconCache.set(name, uri);
    return uri;
};

/** Turns React's inline markup into a standalone SVG file. */
const toStandaloneSvg = (markup: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    markup
        .replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
        // web-only attributes (Tailwind classes, CSS max-width) mean nothing outside the page
        .replace(/ class="[^"]*"/g, "")
        .replace(/ style="max-width:[^"]*"/g, "")
        .replace(/href="\/zodiac\/([a-z]+)\.png"/g, (_, name: string) => `href="${zodiacIconDataUri(name)}"`);

/** Renders a chart exactly as the horoscope page draws it, as a standalone SVG document — or null
 *  when the page shows no figure for this chart type. `d1` is the horoscope's D1 calculation. */
export const renderChartSvg = (type: ChartType, d1: CalculationResult, ctx: ChartRenderContext): string | null => {
    const element = chartElement(type, d1, ctx);
    if (!element) return null;
    return toStandaloneSvg(
        renderToStaticMarkup(
            <NextIntlClientProvider locale="si" messages={siMessages} timeZone="Asia/Colombo">
                {element}
            </NextIntlClientProvider>,
        ),
    );
};
