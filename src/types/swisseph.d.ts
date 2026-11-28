declare module "swisseph-v2" {
    export const SEFLG_SIDEREAL: number;
    export const SEFLG_SPEED: number;
    export const SE_GREG_CAL: number;
    export const SE_SUN: number;
    export const SE_MOON: number;
    export const SE_MARS: number;
    export const SE_MERCURY: number;
    export const SE_JUPITER: number;
    export const SE_VENUS: number;
    export const SE_SATURN: number;
    export const SE_CALC_RISE: number;
    export const SE_CALC_SET: number;
    export const SEFLG_SWIEPH: number;

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

    export function swe_calc_ut(
        julianDayUT: number,
        planet: number,
        flags: number,
    ):
        | { longitude: number; latitude: number; longitudeSpeed: number; error?: undefined }
        | { error: string; longitude?: undefined; latitude?: undefined; longitudeSpeed?: undefined };

    export function swe_rise_trans(
        julianDayUT: number,
        planet: number,
        starName: string,
        ephemerisFlags: number,
        riseSetFlags: number,
        lon: number,
        lat: number,
        height: number,
        pressure: number,
        temperature: number,
    ): { name: string; transitTime: number; error?: undefined } | { error: string; transitTime?: undefined };

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
