const getAnonymousPlaceholder = (horoscopeId: string): string => {
    const suffix = horoscopeId.slice(-4).toUpperCase();
    return `Anonymous Horoscope #${suffix}`;
};

interface HoroscopeLike {
    _id?: { toString(): string } | string;
    id?: string;
    name: string;
    owner: { id: string };
    displayName: boolean;
    isPublic: boolean;
}

const anonymizeIfNeeded = <T extends HoroscopeLike>(horoscope: T, viewerId: string, viewerRole?: string): T => {
    if (viewerRole === "super-admin") return horoscope;

    if (horoscope.owner.id === viewerId) return horoscope;

    if (horoscope.displayName) return horoscope;

    const horoscopeId = horoscope._id ? horoscope._id.toString() : horoscope.id || "";

    return {
        ...horoscope,
        name: getAnonymousPlaceholder(horoscopeId),
    };
};

export { anonymizeIfNeeded, getAnonymousPlaceholder };
