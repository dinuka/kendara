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

const anonymizeIfNeeded = <T extends HoroscopeLike>(horoscope: T, viewerId?: string, viewerRole?: string): T => {
    if (viewerRole === "super-admin") return horoscope;

    if (viewerId && horoscope.owner.id === viewerId) return horoscope;

    if (horoscope.displayName) return horoscope;

    const horoscopeId = horoscope._id ? horoscope._id.toString() : horoscope.id || "";

    return {
        ...horoscope,
        name: getAnonymousPlaceholder(horoscopeId),
    };
};

interface ViewerLike {
    id?: string;
    role?: string;
}

/** Whether a viewer may read a horoscope: its owner, a super-admin, or anyone (signed-out guests
 *  included) when it is public. Pass `undefined` for a guest. */
const canViewHoroscope = (horoscope: { owner: { id: string }; isPublic: boolean }, viewer?: ViewerLike): boolean => {
    if (horoscope.isPublic) return true;
    if (!viewer?.id) return false;
    return horoscope.owner.id === viewer.id || viewer.role === "super-admin";
};

/** Mongo filter for the horoscopes a viewer can list — guests see only public ones. */
const visibleHoroscopeFilter = (viewer?: ViewerLike) =>
    viewer?.id ? { $or: [{ "owner.id": viewer.id }, { isPublic: true }] } : { isPublic: true };

export { anonymizeIfNeeded, canViewHoroscope, getAnonymousPlaceholder, visibleHoroscopeFilter };
