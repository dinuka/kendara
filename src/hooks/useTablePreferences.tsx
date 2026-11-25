"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
    DEFAULT_TABLE_PREFERENCES,
    type TableKind,
    type TableLayout,
    type TablePreferences,
    type TableView,
    cloneLayout,
    normalizeTablePreferences,
} from "@/lib/tableColumns";

export type TablePreferencesSaveStatus = "idle" | "saving" | "saved" | "error";

interface TablePreferencesContextValue {
    preferences: TablePreferences;
    /** False for signed-out viewers (public horoscopes): defaults only, no menu. */
    canEdit: boolean;
    status: TablePreferencesSaveStatus;
    setLayout: (view: TableView, kind: TableKind, layout: TableLayout) => void;
    retry: () => void;
}

const API_PATH = "/api/user/table-preferences";
const CACHE_KEY = "kendara.tablePreferences";
const SAVE_DELAY_MS = 600;

const TablePreferencesContext = createContext<TablePreferencesContextValue | null>(null);

function readCache(): TablePreferences | null {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        return raw ? normalizeTablePreferences(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

function writeCache(preferences: TablePreferences) {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(preferences));
    } catch {
        // Storage unavailable (private mode) — the server copy still persists.
    }
}

/** Holds the signed-in user's table column layouts (one per view × table, shared by every
 *  horoscope). Changes apply instantly and are saved to the user's profile after a short debounce;
 *  a localStorage copy avoids flashing the defaults before the server copy arrives. */
export function TablePreferencesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
    const [preferences, setPreferences] = useState<TablePreferences>(DEFAULT_TABLE_PREFERENCES);
    const [status, setStatus] = useState<TablePreferencesSaveStatus>("idle");
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(preferences);
    // A user edit before the initial GET lands must not be overwritten by it.
    const dirty = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        const cached = readCache();
        if (cached) {
            latest.current = cached;
            setPreferences(cached);
        }
        let cancelled = false;
        fetch(API_PATH)
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (cancelled || dirty.current || !body) return;
                const loaded = normalizeTablePreferences(body.tablePreferences);
                latest.current = loaded;
                setPreferences(loaded);
                writeCache(loaded);
            })
            .catch(() => {
                // Offline / server error: keep the cached or default layouts.
            });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

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

    const setLayout = useCallback(
        (view: TableView, kind: TableKind, layout: TableLayout) => {
            dirty.current = true;
            const next: TablePreferences = {
                ...latest.current,
                [view]: { ...latest.current[view], [kind]: cloneLayout(layout) },
            };
            latest.current = next;
            setPreferences(next);
            writeCache(next);
            setStatus("saving");
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
        },
        [save],
    );

    const value = useMemo(
        () => ({ preferences, canEdit: enabled, status, setLayout, retry: save }),
        [preferences, enabled, status, setLayout, save],
    );

    return <TablePreferencesContext.Provider value={value}>{children}</TablePreferencesContext.Provider>;
}

/** The layout of one table in one view. Outside a provider: the defaults, read-only. */
export function useTableLayout(view: TableView, kind: TableKind) {
    const context = useContext(TablePreferencesContext);
    const preferences = context?.preferences ?? DEFAULT_TABLE_PREFERENCES;
    return {
        layout: preferences[view][kind],
        /** The same table's layout in the other view — for "copy layout from…". */
        otherViewLayout: preferences[view === "charts" ? "calculations" : "charts"][kind],
        canEdit: context?.canEdit ?? false,
        status: context?.status ?? "idle",
        setLayout: (layout: TableLayout) => context?.setLayout(view, kind, layout),
        retry: () => context?.retry(),
    };
}
