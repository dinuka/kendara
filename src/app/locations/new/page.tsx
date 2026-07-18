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
        <div className="max-w-2xl mx-auto">
            <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
                ← {t("common.back")}
            </button>

            <h1 className="text-2xl font-bold mb-6">{t("locations.add")}</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <div className="bg-white rounded-lg border">
                <div className="px-6 py-4 space-y-6">
                    <div ref={searchRef} className="relative">
                        <label className="block text-sm font-medium mb-1">{t("location_form.name")} *</label>
                        <input
                            value={searchQuery}
                            onChange={(e) => {
                                handleSearchChange(e.target.value);
                                setDirty(true);
                                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                            }}
                            placeholder={t("location_form.search_placeholder")}
                            className={`w-full border rounded px-3 py-2 text-sm ${fieldErrors.name ? "border-red-400" : ""}`}
                            role="combobox"
                            aria-expanded={suggestionsOpen}
                            aria-autocomplete="list"
                        />
                        {searchLoading && (
                            <svg
                                className="absolute right-2.5 top-9 h-4 w-4 animate-spin text-gray-400"
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
                        {fieldErrors.name && (
                            <p className="text-xs text-red-500 mt-1" aria-live="polite">
                                {fieldErrors.name}
                            </p>
                        )}
                        {suggestionsOpen && (
                            <ul
                                className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                role="listbox"
                                aria-label="Location suggestions"
                            >
                                {suggestions.map((s, i) => (
                                    <li
                                        key={i}
                                        onClick={() => handleSelectSuggestion(s)}
                                        role="option"
                                        aria-selected={false}
                                        className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                                    >
                                        <span className="block truncate">📍 {s.label}</span>
                                        <span className="block text-xs text-gray-400 mt-0.5">
                                            {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.latitude")} *</label>
                            <input
                                value={latitude}
                                onChange={(e) => {
                                    handleLatitudeChange(e.target.value);
                                    if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: "" }));
                                }}
                                placeholder={t("location_form.lat_placeholder")}
                                className={`w-full border rounded px-3 py-2 text-sm ${fieldErrors.latitude ? "border-red-400" : ""}`}
                                aria-required="true"
                            />
                            <p className="text-xs text-gray-400 mt-1">{t("location_form.lat_hint")}</p>
                            {fieldErrors.latitude && (
                                <p className="text-xs text-red-500 mt-1" aria-live="polite">
                                    {fieldErrors.latitude}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.longitude")} *</label>
                            <input
                                value={longitude}
                                onChange={(e) => {
                                    setLongitude(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.longitude) setFieldErrors((prev) => ({ ...prev, longitude: "" }));
                                }}
                                placeholder={t("location_form.lng_placeholder")}
                                className={`w-full border rounded px-3 py-2 text-sm ${fieldErrors.longitude ? "border-red-400" : ""}`}
                                aria-required="true"
                            />
                            {fieldErrors.longitude && (
                                <p className="text-xs text-red-500 mt-1" aria-live="polite">
                                    {fieldErrors.longitude}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">{t("location_form.visibility")}</label>
                        <div className="flex gap-6">
                            <button
                                onClick={() => setIsPublic(false)}
                                className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                                    !isPublic
                                        ? "bg-gray-100 border-gray-300 text-gray-700"
                                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                🔒 {t("locations.badge_private")}
                            </button>
                            <button
                                onClick={() => setIsPublic(true)}
                                className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                                    isPublic
                                        ? "bg-green-50 border-green-300 text-green-700"
                                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                🌐 {t("locations.badge_public")}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-6 pt-4">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 border rounded text-sm hover:bg-gray-50 transition-colors"
                        >
                            {t("location_form.cancel")}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            aria-busy={saving}
                        >
                            {saving ? t("location_form.saving") : t("location_form.save")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
