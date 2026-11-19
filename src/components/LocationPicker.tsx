"use client";

import { useI18n } from "@/hooks/useI18n";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const QuickAddLocationModal = dynamic(() => import("@/components/QuickAddLocationModal"), { ssr: false });

const SEARCH_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 250;

interface LocationOption {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    isPublic: boolean;
    createdBy: { id: string };
}

interface LocationPickerProps {
    selectedLocationId: string | null;
    onChange: (location: { id: string; name: string; latitude: number; longitude: number } | null) => void;
    disabled?: boolean;
}

export default function LocationPicker({ selectedLocationId, onChange, disabled }: LocationPickerProps) {
    const { t } = useI18n();

    const [open, setOpen] = useState(false);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [hasAnyLocations, setHasAnyLocations] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const ref = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const requestSeq = useRef(0);
    const isFirstLoad = useRef(true);

    /** Searches server-side — there are more locations than one page holds, so filtering a
     *  preloaded list in the browser would hide everything past the first page. */
    const fetchLocations = useCallback(
        async (query: string = "") => {
            const seq = ++requestSeq.current;
            if (isFirstLoad.current) setLoading(true);
            else setSearching(true);
            setError("");
            try {
                const params = new URLSearchParams({ limit: String(SEARCH_LIMIT) });
                if (query.trim()) params.set("search", query.trim());
                const res = await fetch(`/api/location?${params}`);
                if (!res.ok) throw new Error("Failed to load");
                const data = await res.json();
                if (seq !== requestSeq.current) return;
                setLocations(data.locations || []);
                if (!query.trim()) setHasAnyLocations((data.total ?? 0) > 0);
            } catch {
                if (seq === requestSeq.current) setError(t("location_picker.error"));
            } finally {
                if (seq === requestSeq.current) {
                    isFirstLoad.current = false;
                    setLoading(false);
                    setSearching(false);
                }
            }
        },
        [t],
    );

    useEffect(() => {
        const timer = setTimeout(() => fetchLocations(search), isFirstLoad.current ? 0 : SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [fetchLocations, search]);

    useEffect(() => {
        if (!selectedLocationId || selectedLocation?.id === selectedLocationId) return;

        const found = locations.find((l) => l.id === selectedLocationId);
        if (found) {
            setSelectedLocation(found);
            return;
        }

        // The selected location may not be in the current result page — load it directly.
        let cancelled = false;
        fetch(`/api/location/${selectedLocationId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((loc: LocationOption | null) => {
                if (!cancelled && loc) setSelectedLocation(loc);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [selectedLocationId, selectedLocation, locations]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (open && searchInputRef.current) {
            searchInputRef.current.focus();
            setFocusedIndex(-1);
        }
    }, [open]);

    const publicLocations = locations.filter((l) => l.isPublic);
    const myLocations = locations.filter((l) => !l.isPublic);

    // Results are already filtered server-side (with spelling tolerance), so no client filter here.
    const filteredPublic = publicLocations;
    const filteredMine = myLocations;

    const allFiltered = [...filteredPublic, ...filteredMine];

    const handleSelect = (loc: LocationOption) => {
        setSelectedLocation(loc);
        onChange({ id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude });
        setOpen(false);
        triggerRef.current?.focus();
    };

    const handleChange = () => {
        setSelectedLocation(null);
        onChange(null);
        setOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setFocusedIndex((prev) => Math.min(prev + 1, allFiltered.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, -1));
                break;
            case "Enter":
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < allFiltered.length) {
                    handleSelect(allFiltered[focusedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                break;
        }
    };

    const handleQuickAddSaved = (location: { id: string; name: string; latitude: number; longitude: number }) => {
        setShowQuickAdd(false);
        fetchLocations().then(() => {
            const newLoc = {
                id: location.id,
                name: location.name,
                latitude: location.latitude,
                longitude: location.longitude,
                isPublic: false,
                createdBy: { id: "" },
            };
            setSelectedLocation(newLoc);
            onChange(location);
        });
    };

    if (loading) {
        return (
            <div>
                <label className="block text-sm font-medium mb-1">{t("location_picker.title")}</label>
                <div className="h-10 bg-gray-100 animate-pulse rounded" />
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <label className="block text-sm font-medium mb-1">{t("location_picker.title")}</label>
                <div className="bg-red-50 border border-red-200 rounded p-3" role="alert">
                    <p className="text-xs text-red-600">{error}</p>
                    <button
                        type="button"
                        onClick={() => fetchLocations(search)}
                        className="text-xs text-red-600 underline mt-1 hover:no-underline"
                    >
                        {t("location_picker.retry")}
                    </button>
                </div>
            </div>
        );
    }

    if (!hasAnyLocations && !selectedLocation) {
        return (
            <div>
                <label className="block text-sm font-medium mb-1">{t("location_picker.title")}</label>
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">{t("location_picker.empty")}</p>
                    <button
                        type="button"
                        onClick={() => setShowQuickAdd(true)}
                        className="text-sm text-indigo-600 hover:underline"
                    >
                        {t("locations.add")}
                    </button>
                </div>
                {showQuickAdd && (
                    <QuickAddLocationModal onClose={() => setShowQuickAdd(false)} onSaved={handleQuickAddSaved} />
                )}
            </div>
        );
    }

    return (
        <div ref={ref}>
            <label className="block text-sm font-medium mb-1">{t("location_picker.title")}</label>

            {selectedLocation ? (
                <div>
                    <div className="flex items-center justify-between border rounded px-3 py-2">
                        <span className="text-sm truncate">📍 {selectedLocation.name}</span>
                        <button
                            type="button"
                            onClick={handleChange}
                            className="text-xs text-indigo-600 hover:underline ml-2 whitespace-nowrap"
                        >
                            {t("location_picker.change")}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{t("location_picker.cached_name")}</p>
                </div>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => !disabled && setOpen(true)}
                    disabled={disabled}
                    className="w-full text-left border rounded px-3 py-2 text-sm text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-colors"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-controls="location-picker-list"
                >
                    📍 {t("location_picker.placeholder")}
                </button>
            )}

            {open && (
                <div
                    className="mt-1 bg-white border rounded-lg shadow-lg z-10"
                    onKeyDown={handleKeyDown}
                    role="listbox"
                    id="location-picker-list"
                    aria-labelledby="location-picker-label"
                >
                    <div className="p-2 border-b">
                        <input
                            ref={searchInputRef}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setFocusedIndex(-1);
                            }}
                            placeholder={t("location_picker.search")}
                            className="w-full border rounded px-3 py-1.5 text-sm"
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        {search && !searching && allFiltered.length === 0 && (
                            <p className="px-3 py-4 text-sm text-gray-400 text-center">{t("locations.search_empty")}</p>
                        )}

                        {filteredPublic.length > 0 && (
                            <>
                                <div
                                    className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50"
                                    role="group"
                                    aria-label={t("location_picker.group_public")}
                                >
                                    {t("location_picker.group_public")}
                                </div>
                                {filteredPublic.map((loc, i) => (
                                    <button
                                        type="button"
                                        key={loc.id}
                                        onClick={() => handleSelect(loc)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 ${
                                            focusedIndex === i ? "bg-indigo-50" : ""
                                        }`}
                                        role="option"
                                        aria-selected={loc.id === selectedLocationId}
                                    >
                                        <span>📍</span>
                                        <span className="flex-1 truncate">{loc.name}</span>
                                        <span className="text-xs text-green-600">🌐</span>
                                    </button>
                                ))}
                            </>
                        )}

                        {filteredMine.length > 0 && (
                            <>
                                <div
                                    className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50"
                                    role="group"
                                    aria-label={t("location_picker.group_mine")}
                                >
                                    {t("location_picker.group_mine")}
                                </div>
                                {filteredMine.map((loc, i) => (
                                    <button
                                        type="button"
                                        key={loc.id}
                                        onClick={() => handleSelect(loc)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 ${
                                            focusedIndex === filteredPublic.length + i ? "bg-indigo-50" : ""
                                        }`}
                                        role="option"
                                        aria-selected={loc.id === selectedLocationId}
                                    >
                                        <span>📍</span>
                                        <span className="flex-1 truncate">{loc.name}</span>
                                        <span className="text-xs text-gray-500">🔒</span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>

                    <div className="border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setShowQuickAdd(true);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                            role="option"
                        >
                            {t("location_picker.add_new")}
                        </button>
                    </div>
                </div>
            )}

            {showQuickAdd && (
                <QuickAddLocationModal onClose={() => setShowQuickAdd(false)} onSaved={handleQuickAddSaved} />
            )}
        </div>
    );
}
