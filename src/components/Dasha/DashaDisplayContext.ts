"use client";

import { createContext, useContext } from "react";

import { DEFAULT_DASHA_DISPLAY, type DashaDisplay } from "@/lib/dashaDisplay";

/** The viewer's Dasha row display settings, provided by DashaSection to every row in the tree. */
export const DashaDisplayContext = createContext<DashaDisplay>(DEFAULT_DASHA_DISPLAY.desktop);

export function useDashaRowDisplay(): DashaDisplay {
    return useContext(DashaDisplayContext);
}
