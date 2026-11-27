import { revalidateTag } from "next/cache";

import logger from "@/lib/logger";

/** Cache tag of one horoscope's server-rendered public view (src/lib/horoscopeView.ts). */
export const horoscopeTag = (id: string): string => `horoscope:${id}`;

/** Cache tag covering every horoscope view plus the sitemap. */
export const HOROSCOPES_TAG = "horoscopes";

/** Expires cache tags immediately. A failed purge must never fail the save that triggered it —
 *  outside a Next request scope (background jobs, unit tests) `revalidateTag` throws, and the
 *  views then fall back to their daily revalidate. */
const expireTags = (tags: string[]): void => {
    try {
        for (const tag of tags) revalidateTag(tag, { expire: 0 });
    } catch (err) {
        logger.warn("could not revalidate cache tags %s: %s", tags.join(","), (err as Error).message);
    }
};

/** Expires the cached public view of one horoscope (and the sitemap) after it changed. */
export const revalidateHoroscope = (id: string): void => {
    logger.debug("revalidating horoscope cache: id=%s", id);
    expireTags([horoscopeTag(id), `${HOROSCOPES_TAG}:list`]);
};

/** Expires every cached horoscope view, e.g. after a system-wide recalculation. */
export const revalidateAllHoroscopes = (): void => {
    logger.debug("revalidating all horoscope caches");
    expireTags([HOROSCOPES_TAG]);
};
