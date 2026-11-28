"use client";

import { useI18n } from "@/hooks/useI18n";
import { useEffect, useRef, useState } from "react";

interface Suggestion {
    label: string;
    lat: number;
    lng: number;
    type: string;
}

interface LocationInputProps {
    onSelect: (lat: number, lng: number, label: string) => void;
    lat: string;
    lng: string;
    onLatChange: (v: string) => void;
    onLngChange: (v: string) => void;
    initialValue?: string;
    onQueryChange?: (v: string) => void;
}

export function LocationInput({
    onSelect,
    lat,
    lng,
    onLatChange,
    onLngChange,
    initialValue,
    onQueryChange,
}: LocationInputProps) {
    const { t } = useI18n();
    const [query, setQuery] = useState(initialValue || "");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialValue) setQuery(initialValue);
    }, [initialValue]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleChange = (value: string) => {
        setQuery(value);
        onQueryChange?.(value);
        if (timer.current) clearTimeout(timer.current);

        if (value.length < 2) {
            setSuggestions([]);
            setOpen(false);
            return;
        }

        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/location/search?q=${encodeURIComponent(value)}`);
                const data = await res.json();
                setSuggestions(data.results || []);
                setOpen(data.results?.length > 0);
            } catch {
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const handleSelect = (s: Suggestion) => {
        setQuery(s.label);
        setOpen(false);
        onSelect(s.lat, s.lng, s.label);
    };

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={t("horoscope.location") + " (e.g. Colombo, Maharagama, Sri Jayawardanapura Hospital)"}
                    className="w-full border rounded px-3 py-2 text-sm pr-8"
                />
                {loading && (
                    <svg
                        className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
            </div>

            {open && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.length === 0 && (
                        <li className="px-3 py-2 text-sm text-gray-400">{t("common.loading")}</li>
                    )}
                    {suggestions.map((s, i) => (
                        <li
                            key={i}
                            onClick={() => handleSelect(s)}
                            className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                        >
                            <span className="block truncate">{s.label}</span>
                            <span className="block text-xs text-gray-400 mt-0.5">
                                {s.lat.toFixed(4)}, {s.lng.toFixed(4)} — {s.type}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                    <label className="block text-sm font-medium mb-1">{t("horoscope.latitude")}</label>
                    <input
                        type="number"
                        step="any"
                        value={lat}
                        onChange={(e) => onLatChange(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{t("horoscope.longitude")}</label>
                    <input
                        type="number"
                        step="any"
                        value={lng}
                        onChange={(e) => onLngChange(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
            </div>
        </div>
    );
}
