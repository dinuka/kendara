/**
 * Prana dasha periods, derived on demand from their Sukshama.
 *
 * Stored dasha trees stop at Sukshama (`computeSubPeriods(..., 4, ...)` — Prana would multiply the
 * stored tree by 9). Prana is pure arithmetic on its Sukshama, so the browser computes the nine
 * periods only for the Sukshama rows actually opened, with the same rule as the server's depth-5
 * branch: the cycle starts at the Sukshama lord, each Prana lasts sukshama × years(lord) / 120,
 * rounded to whole hours (sub-hour periods skipped except the last), and the last Prana ends
 * exactly at the Sukshama's end.
 */
import type { Prana, Sukshama } from "./astrology";
import { TOTAL_VIMSHOTTARI_YEARS, getCyclePlanets, getPlanetYears, getStartPlanetIndex } from "./vimshottari";

const HOUR_MS = 3_600_000;
const YEAR_MS = 365.25 * 24 * HOUR_MS;

/** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm[:ss]" → a local Date (the format calculation.ts writes).
 *  `new Date("YYYY-MM-DD")` would read UTC midnight instead, off by the zone offset. */
export function parseDashaDate(value: string): Date {
    const [date, time = "00:00:00"] = value.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [hh = 0, mm = 0, ss = 0] = time.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, ss);
}

/** Local Date → "YYYY-MM-DDTHH:mm:ss" (calculation.ts `toISODatetime`). */
function formatLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

export function computePranas(sukshama: Sukshama): Prana[] {
    const start = parseDashaDate(sukshama.startDate);
    const end = parseDashaDate(sukshama.endDate);
    const spanMs = end.getTime() - start.getTime();
    if (!(spanMs > 0)) return [];
    const sukshamaHours = spanMs / HOUR_MS;

    const lords = getCyclePlanets(getStartPlanetIndex(sukshama.planet), 9);
    const result: Prana[] = [];
    let cursor = start.getTime();
    lords.forEach((lord, index) => {
        const last = index === lords.length - 1;
        const hours = Math.round((sukshamaHours * getPlanetYears(lord)) / TOTAL_VIMSHOTTARI_YEARS);
        if (hours < 1 && !last) return;
        const prStart = cursor;
        const prEnd = last ? end.getTime() : prStart + hours * HOUR_MS;
        result.push({
            planet: lord,
            startDate: formatLocal(new Date(prStart)),
            endDate: formatLocal(new Date(prEnd)),
            durationHours: last ? Math.round((prEnd - prStart) / HOUR_MS) : hours,
            startAge: +(sukshama.startAge + (prStart - start.getTime()) / YEAR_MS).toFixed(4),
        });
        cursor = prEnd;
    });
    return result;
}

/** The stored Prana list when present (older/manual trees may carry one), else computed. */
export function pranasOf(sukshama: Sukshama): Prana[] {
    return sukshama.prana && sukshama.prana.length > 0 ? sukshama.prana : computePranas(sukshama);
}
