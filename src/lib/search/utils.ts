const SINHALA_UNICODE_RANGE = /[\u0D80-\u0DFF]/;

export const detectLanguage = (query: string): "si" | "en" => {
    return SINHALA_UNICODE_RANGE.test(query) ? "si" : "en";
};

export const generateAnonymousPlaceholder = (horoscopeId: string): string => {
    const suffix = horoscopeId.slice(-4).toUpperCase();
    return `Anonymous Horoscope #${suffix}`;
};

interface HoroscopeLike {
    _id?: { toString(): string } | string;
    id?: string;
    name: string;
    owner: { id: string };
    displayName: boolean;
}

interface ResultLike {
    horoscope: HoroscopeLike;
}

export const anonymizeSearchResults = <T extends ResultLike>(
    results: T[],
    userId: string,
    userRole?: string,
): T[] => {
    if (userRole === "super-admin") return results;

    return results.map((r) => {
        if (r.horoscope.owner.id !== userId && !r.horoscope.displayName) {
            const horoscopeId = r.horoscope._id
                ? r.horoscope._id.toString()
                : r.horoscope.id || "";

            return {
                ...r,
                horoscope: {
                    ...r.horoscope,
                    name: generateAnonymousPlaceholder(horoscopeId),
                },
            };
        }
        return r;
    });
};

export const paginateResults = <T>(items: T[], page: number, pageSize: number) => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
        results: paginatedItems,
        total,
        page: safePage,
        pageSize,
        totalPages,
    };
};
