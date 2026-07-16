declare module "swisseph-v2" {
    export const SEFLG_SIDEREAL: number;
    export const SE_GREG_CAL: number;

    export function swe_utc_time_zone(
        year: number,
        month: number,
        day: number,
        hour: number,
        min: number,
        sec: number,
        timezone: number,
    ): {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
    };

    export function swe_utc_to_jd(
        year: number,
        month: number,
        day: number,
        hour: number,
        min: number,
        sec: number,
        calendar: number,
    ): {
        julianDayET: number;
        julianDayUT: number;
        returnCode: number;
    };

    export function swe_set_sid_mode(ayanamsha: number, t0: number, ayan_t0: number): void;

    export function swe_houses_ex(
        julianDayUT: number,
        flags: number,
        lat: number,
        lon: number,
        houseSystem: string,
    ): {
        house: number[];
        ascendant: number;
        mc: number;
    };
}
