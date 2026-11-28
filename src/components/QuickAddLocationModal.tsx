"use client";

import { useI18n } from "@/hooks/useI18n";
import { useState } from "react";

interface QuickAddProps {
    onClose: () => void;
    onSaved: (location: { id: string; name: string; latitude: number; longitude: number }) => void;
}

export default function QuickAddLocationModal({ onClose, onSaved }: QuickAddProps) {
    const { t } = useI18n();

    const [name, setName] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!name.trim() || !latitude || !longitude) {
            setError(t("location_form.name_required"));
            return;
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            setError(t("location_form.lat_invalid"));
            return;
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            setError(t("location_form.lon_invalid"));
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch("/api/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    latitude: lat,
                    longitude: lon,
                    isPublic,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || t("locations.save_error"));
                return;
            }

            const location = await res.json();
            onSaved({
                id: location.id,
                name: location.name,
                latitude: location.latitude,
                longitude: location.longitude,
            });
        } catch {
            setError(t("locations.save_error"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={t("quick_add.title")}
            >
                <h2 className="text-lg font-semibold mb-4">{t("quick_add.title")}</h2>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("location_form.name")} *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.latitude")} *</label>
                            <input
                                type="number"
                                step="any"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.longitude")} *</label>
                            <input
                                type="number"
                                step="any"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsPublic(false)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                !isPublic
                                    ? "bg-gray-100 border-gray-300 text-gray-700"
                                    : "bg-white border-gray-200 text-gray-500"
                            }`}
                        >
                            🔒 {t("locations.badge_private")}
                        </button>
                        <button
                            onClick={() => setIsPublic(true)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                isPublic
                                    ? "bg-green-50 border-green-300 text-green-700"
                                    : "bg-white border-gray-200 text-gray-500"
                            }`}
                        >
                            🌐 {t("locations.badge_public")}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded text-sm hover:bg-gray-50 transition-colors"
                    >
                        {t("common.cancel")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? t("common.loading") : t("quick_add.add_and_select")}
                    </button>
                </div>
            </div>
        </div>
    );
}
