"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Suggestion {
    label: string;
    lat: number;
    lng: number;
    type: string;
}

export default function NewLocationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();

    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const [name, setName] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [isPublic, setIsPublic] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState(false);

    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSuggestionsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    if (status === "unauthenticated") {
        router.push("/signin");
        return null;
    }

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setName(value);
        if (timer.current) clearTimeout(timer.current);

        if (value.length < 2) {
            setSuggestions([]);
            setSuggestionsOpen(false);
            return;
        }

        timer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await fetch(`/api/location/search?q=${encodeURIComponent(value)}`);
                const data = await res.json();
                setSuggestions(data.results || []);
                setSuggestionsOpen(data.results?.length > 0);
                setFocusedIndex(-1);
            } catch {
                setSuggestions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSelectSuggestion = (s: Suggestion) => {
        setName(s.label);
        setLatitude(String(s.lat));
        setLongitude(String(s.lng));
        setSuggestionsOpen(false);
        setSearchQuery(s.label);
        setDirty(true);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (!suggestionsOpen) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setFocusedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, -1));
                break;
            case "Enter":
                if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
                    e.preventDefault();
                    handleSelectSuggestion(suggestions[focusedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                setSuggestionsOpen(false);
                break;
        }
    };

    const handleLatitudeChange = (value: string) => {
        setLatitude(value);
        setDirty(true);
        if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: "" }));

        const commaIndex = value.indexOf(",");
        if (commaIndex !== -1) {
            const latPart = value.slice(0, commaIndex).trim();
            const lonPart = value.slice(commaIndex + 1).trim();
            const lat = parseFloat(latPart);
            const lon = parseFloat(lonPart);
            if (!isNaN(lat) && !isNaN(lon)) {
                setLatitude(latPart);
                setLongitude(lonPart);
            }
        }
    };

    const validate = (): boolean => {
        const errors: Record<string, string> = {};
        if (!name.trim()) errors.name = t("location_form.name_required");

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (!latitude || isNaN(lat) || lat < -90 || lat > 90) {
            errors.latitude = t("location_form.lat_invalid");
        }
        if (!longitude || isNaN(lon) || lon < -180 || lon > 180) {
            errors.longitude = t("location_form.lon_invalid");
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    isPublic,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (data.fields) setFieldErrors(data.fields);
                if (data.error) setError(data.error);
                return;
            }

            router.push("/locations");
        } catch {
            setError(t("locations.save_error"));
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (dirty) {
            if (!confirm(t("location_form.discard"))) return;
        }
        router.push("/locations");
    };

    return (
        <div className="max-w-xl mx-auto">
            <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none rounded mb-5 transition-colors"
            >
                <span aria-hidden="true">←</span> {t("common.back")}
            </button>

            <h1 className="text-[1.75rem] font-semibold tracking-tight text-gray-900 mb-6">{t("locations.add")}</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm shadow-gray-900/5">
                <div className="px-6 py-6 space-y-6">
                    <div ref={searchRef} className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("location_form.name")} <span className="text-indigo-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    handleSearchChange(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                                }}
                                onKeyDown={handleSearchKeyDown}
                                placeholder={t("location_form.search_placeholder")}
                                aria-label={t("location_form.name")}
                                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-shadow ${
                                    fieldErrors.name
                                        ? "border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-400"
                                        : "border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                }`}
                                role="combobox"
                                aria-expanded={suggestionsOpen}
                                aria-autocomplete="list"
                                aria-controls="location-search-list"
                                aria-activedescendant={
                                    focusedIndex >= 0 ? `location-suggestion-${focusedIndex}` : undefined
                                }
                            />
                            {searchLoading && (
                                <svg
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                            )}
                        </div>
                        {fieldErrors.name && (
                            <p className="text-xs text-red-500 mt-1.5" aria-live="polite">
                                {fieldErrors.name}
                            </p>
                        )}
                        {suggestionsOpen && (
                            <ul
                                id="location-search-list"
                                className="absolute z-10 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-900/10 max-h-60 overflow-y-auto py-1 px-1"
                                role="listbox"
                                aria-label="Location suggestions"
                            >
                                {suggestions.map((s, i) => (
                                    <li
                                        key={i}
                                        id={`location-suggestion-${i}`}
                                        role="option"
                                        aria-selected={focusedIndex === i}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSelectSuggestion(s)}
                                            onMouseEnter={() => setFocusedIndex(i)}
                                            className={`w-full text-left px-3.5 py-2.5 text-sm outline-none cursor-pointer rounded-lg ${
                                                focusedIndex === i ? "bg-gray-50" : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <span className="block truncate text-gray-800">📍 {s.label}</span>
                                            <span className="block text-xs text-gray-400 mt-0.5">
                                                {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    {t("location_form.latitude")} <span className="text-indigo-500">*</span>
                                </label>
                                <input
                                    value={latitude}
                                    onChange={(e) => {
                                        handleLatitudeChange(e.target.value);
                                        if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: "" }));
                                    }}
                                    placeholder={t("location_form.lat_placeholder")}
                                    inputMode="decimal"
                                    aria-invalid={!!fieldErrors.latitude}
                                    className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-shadow ${
                                        fieldErrors.latitude
                                            ? "border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-400"
                                            : "border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    }`}
                                    aria-required="true"
                                />
                                {fieldErrors.latitude && (
                                    <p className="text-xs text-red-500 mt-1.5" aria-live="polite">
                                        {fieldErrors.latitude}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    {t("location_form.longitude")} <span className="text-indigo-500">*</span>
                                </label>
                                <input
                                    value={longitude}
                                    onChange={(e) => {
                                        setLongitude(e.target.value);
                                        setDirty(true);
                                        if (fieldErrors.longitude)
                                            setFieldErrors((prev) => ({ ...prev, longitude: "" }));
                                    }}
                                    placeholder={t("location_form.lng_placeholder")}
                                    inputMode="decimal"
                                    aria-invalid={!!fieldErrors.longitude}
                                    className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-shadow ${
                                        fieldErrors.longitude
                                            ? "border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-400"
                                            : "border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    }`}
                                    aria-required="true"
                                />
                                {fieldErrors.longitude && (
                                    <p className="text-xs text-red-500 mt-1.5" aria-live="polite">
                                        {fieldErrors.longitude}
                                    </p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">{t("location_form.lat_hint")}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("location_form.visibility")}
                        </label>
                        <div className="inline-flex p-1 bg-gray-100 rounded-lg gap-1">
                            <button
                                type="button"
                                onClick={() => setIsPublic(false)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-all ${
                                    !isPublic ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                🔒 {t("locations.badge_private")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPublic(true)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-all ${
                                    isPublic ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                🌐 {t("locations.badge_public")}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-gray-100 px-6 py-5">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none transition-colors"
                    >
                        {t("location_form.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none disabled:opacity-50 shadow-sm shadow-indigo-600/20 transition-colors"
                        aria-busy={saving}
                    >
                        {saving ? t("location_form.saving") : t("location_form.save")}
                    </button>
                </div>
            </div>
        </div>
    );
}
