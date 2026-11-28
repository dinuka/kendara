"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Below Tailwind's `sm` breakpoint (640px) — the phone layouts. */
export const PHONE_QUERY = "(max-width: 639.98px)";

/** Live `matchMedia` result. False during SSR and the first hydration pass. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const media = window.matchMedia(query);
            media.addEventListener("change", onChange);
            return () => media.removeEventListener("change", onChange);
        },
        [query],
    );
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false,
    );
}
