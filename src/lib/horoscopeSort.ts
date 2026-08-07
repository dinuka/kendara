export interface HoroscopeSort {
    sortBy: "name" | "birthDate" | "locationName" | "isPublic";
    sortDir: "asc" | "desc";
}

export const HOROSCOPE_SORT_KEY = "kendara.horoscopeSort";

export const DEFAULT_HOROSCOPE_SORT: HoroscopeSort = { sortBy: "name", sortDir: "asc" };

const SORT_BY_VALUES: HoroscopeSort["sortBy"][] = ["name", "birthDate", "locationName", "isPublic"];

const readHoroscopeSort = (): HoroscopeSort => {
    if (typeof window === "undefined") return DEFAULT_HOROSCOPE_SORT;
    try {
        const stored = window.localStorage.getItem(HOROSCOPE_SORT_KEY);
        if (stored) {
            const parsed: Partial<HoroscopeSort> = JSON.parse(stored);
            return {
                sortBy:
                    parsed.sortBy && SORT_BY_VALUES.includes(parsed.sortBy)
                        ? parsed.sortBy
                        : DEFAULT_HOROSCOPE_SORT.sortBy,
                sortDir: parsed.sortDir === "desc" ? "desc" : "asc",
            };
        }
    } catch {}
    return DEFAULT_HOROSCOPE_SORT;
};

const writeHoroscopeSort = (sort: HoroscopeSort) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOROSCOPE_SORT_KEY, JSON.stringify(sort));
};

export { readHoroscopeSort, writeHoroscopeSort };
