"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PHONE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

import type { DashaDisplay } from "@/lib/dashaDisplay";

import {
    DEFAULT_TABLE_PREFERENCES,
    type TableDevice,
    type TableKind,
    type TableLayout,
    type TablePreferences,
    type TableView,
    cloneLayout,
    deviceLayouts,
    normalizeTablePreferences,
} from "@/lib/tableColumns";

export type TablePreferencesSaveStatus = "idle" | "saving" | "saved" | "error";

/** Where layouts persist: the signed-in user's profile, this browser only (guests), or nowhere yet
 *  (session still loading — defaults, read-only). */
export type TablePreferencesMode = "account" | "device" | "off";

interface TablePreferencesContextValue {
    preferences: TablePreferences;
    /** False only while the session is still loading. */
    canEdit: boolean;
    /** Guests: layouts live in this browser only. */
    savedOnDevice: boolean;
    status: TablePreferencesSaveStatus;
    setLayout: (device: TableDevice, view: TableView, kind: TableKind, layout: TableLayout) => void;
    setDashaDisplay: (device: TableDevice, display: DashaDisplay) => void;
    retry: () => void;
}

const API_PATH = "/api/user/table-preferences";
const CACHE_KEY = "kendara.tablePreferences";
/** Guests get their own key so a shared device never mixes a guest's and an account's layouts. */
const GUEST_CACHE_KEY = "kendara.tablePreferences.guest";
const SAVE_DELAY_MS = 600;

const TablePreferencesContext = createContext<TablePreferencesContextValue | null>(null);

function readCache(key: string): TablePreferences | null {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? normalizeTablePreferences(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

function writeCache(key: string, preferences: TablePreferences) {
    try {
        window.localStorage.setItem(key, JSON.stringify(preferences));
    } catch {
        // Storage unavailable (private mode) — the server copy still persists.
    }
}

/** Holds the viewer's table column layouts (one per device × view × table, shared by every
 *  horoscope). Changes apply instantly. Signed-in users: saved to the profile after a short
 *  debounce, with a localStorage copy so the defaults don't flash before the server copy arrives.
 *  Guests: saved to localStorage only. */
export function TablePreferencesProvider({ mode, children }: { mode: TablePreferencesMode; children: ReactNode }) {
    const cacheKey = mode === "account" ? CACHE_KEY : GUEST_CACHE_KEY;
    const [preferences, setPreferences] = useState<TablePreferences>(DEFAULT_TABLE_PREFERENCES);
    const [status, setStatus] = useState<TablePreferencesSaveStatus>("idle");
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(preferences);
    // A user edit before the initial GET lands must not be overwritten by it.
    const dirty = useRef(false);

    useEffect(() => {
        if (mode === "off") return;
        const cached = readCache(cacheKey);
        if (cached) {
            latest.current = cached;
            setPreferences(cached);
        }
        if (mode === "device") return;
        let cancelled = false;
        fetch(API_PATH)
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (cancelled || dirty.current || !body) return;
                const loaded = normalizeTablePreferences(body.tablePreferences);
                latest.current = loaded;
                setPreferences(loaded);
                writeCache(cacheKey, loaded);
            })
            .catch(() => {
                // Offline / server error: keep the cached or default layouts.
            });
        return () => {
            cancelled = true;
        };
    }, [mode, cacheKey]);

    const save = useCallback(async () => {
        setStatus("saving");
        try {
            const res = await fetch(API_PATH, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tablePreferences: latest.current }),
            });
            setStatus(res.ok ? "saved" : "error");
        } catch {
            setStatus("error");
        }
    }, []);

    useEffect(
        () => () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        },
        [],
    );

    /** Apply a change instantly, cache it, and (signed in) debounce-save it to the profile. */
    const commit = useCallback(
        (next: TablePreferences) => {
            dirty.current = true;
            latest.current = next;
            setPreferences(next);
            writeCache(cacheKey, next);
            if (mode !== "account") return;
            setStatus("saving");
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
        },
        [save, mode, cacheKey],
    );

    const setLayout = useCallback(
        (device: TableDevice, view: TableView, kind: TableKind, layout: TableLayout) => {
            const current = latest.current;
            const layouts = deviceLayouts(current, device);
            const updated = { ...layouts, [view]: { ...layouts[view], [kind]: cloneLayout(layout) } };
            commit(device === "mobile" ? { ...current, mobile: updated } : { ...current, ...updated });
        },
        [commit],
    );

    const setDashaDisplay = useCallback(
        (device: TableDevice, display: DashaDisplay) => {
            const current = latest.current;
            commit({
                ...current,
                dasha: { ...current.dasha, [device]: { fields: { ...display.fields }, depth: display.depth } },
            });
        },
        [commit],
    );

    const value = useMemo(
        () => ({
            preferences,
            canEdit: mode !== "off",
            savedOnDevice: mode === "device",
            status,
            setLayout,
            setDashaDisplay,
            retry: save,
        }),
        [preferences, mode, status, setLayout, setDashaDisplay, save],
    );

    return <TablePreferencesContext.Provider value={value}>{children}</TablePreferencesContext.Provider>;
}

/** The layout of one table in one view, for the current screen class (phones have their own).
 *  Outside a provider: the defaults, read-only. */
export function useTableLayout(view: TableView, kind: TableKind) {
    const context = useContext(TablePreferencesContext);
    const device: TableDevice = useMediaQuery(PHONE_QUERY) ? "mobile" : "desktop";
    const layouts = deviceLayouts(context?.preferences ?? DEFAULT_TABLE_PREFERENCES, device);
    return {
        device,
        layout: layouts[view][kind],
        /** This device's default layout — for "reset" and the changed-dot. */
        defaultLayout: deviceLayouts(DEFAULT_TABLE_PREFERENCES, device)[view][kind],
        /** The same table's layout in the other view — for "copy layout from…". */
        otherViewLayout: layouts[view === "charts" ? "calculations" : "charts"][kind],
        canEdit: context?.canEdit ?? false,
        savedOnDevice: context?.savedOnDevice ?? false,
        status: context?.status ?? "idle",
        setLayout: (layout: TableLayout) => context?.setLayout(device, view, kind, layout),
        retry: () => context?.retry(),
    };
}

/** The Dasha tab's row display settings for the current screen class (phones have their own).
 *  Saved with the table layouts. Outside a provider: the defaults, read-only. */
export function useDashaDisplay() {
    const context = useContext(TablePreferencesContext);
    const device: TableDevice = useMediaQuery(PHONE_QUERY) ? "mobile" : "desktop";
    const preferences = context?.preferences ?? DEFAULT_TABLE_PREFERENCES;
    return {
        device,
        display: preferences.dasha[device],
        defaultDisplay: DEFAULT_TABLE_PREFERENCES.dasha[device],
        canEdit: context?.canEdit ?? false,
        savedOnDevice: context?.savedOnDevice ?? false,
        status: context?.status ?? "idle",
        setDisplay: (display: DashaDisplay) => context?.setDashaDisplay(device, display),
        retry: () => context?.retry(),
    };
}
