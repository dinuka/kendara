"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditLocationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const { t } = useI18n();

    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState(false);

    if (status === "unauthenticated") {
        router.push("/signin");
        return null;
    }

    useEffect(() => {
        const fetchLocation = async () => {
            try {
                const res = await fetch(`/api/location/${params.id}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        router.push("/locations");
                        return;
                    }
                    throw new Error("Failed to load");
                }
                const data = await res.json();
                setName(data.name || "");
                setLatitude(String(data.latitude || ""));
                setLongitude(String(data.longitude || ""));
                setIsPublic(data.isPublic || false);
            } catch {
                setError(t("locations.load_error"));
            } finally {
                setLoading(false);
            }
        };
        fetchLocation();
    }, [params.id, router, t]);

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
            const res = await fetch(`/api/location/${params.id}`, {
                method: "PUT",
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

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="h-4 w-24 bg-gray-100 animate-pulse rounded mb-4" />
                <div className="h-8 w-64 bg-gray-100 animate-pulse rounded mb-6" />
                <div className="bg-white rounded-lg border p-6 space-y-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
                ← {t("common.back")}
            </button>

            <h1 className="text-2xl font-bold mb-6">{t("locations.edit")}</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <aside
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4"
                role="note"
                aria-label={t("locations.edit_independence")}
            >
                <p className="text-xs text-amber-700">⚠️ {t("locations.edit_independence")}</p>
            </aside>
            <div className="bg-white rounded-lg border">
                <div className="px-6 py-4 space-y-6">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</h2>

                    <div>
                        <label className="block text-sm font-medium mb-1">{t("location_form.name")} *</label>
                        <input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setDirty(true);
                                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                            }}
                            className={`w-full border rounded px-3 py-2 text-sm ${fieldErrors.name ? "border-red-400" : ""}`}
                            aria-required="true"
                        />
                        {fieldErrors.name && (
                            <p className="text-xs text-red-500 mt-1" aria-live="polite">
                                {fieldErrors.name}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.latitude")} *</label>
                            <input
                                type="number"
                                step="any"
                                value={latitude}
                                onChange={(e) => {
                                    setLatitude(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: "" }));
                                }}
                                className={`w-full border rounded px-3 py-2 text-sm ${fieldErrors.latitude ? "border-red-400" : ""}`}
                                aria-required="true"
                            />
                            {fieldErrors.latitude && (
                                <p className="text-xs text-red-500 mt-1" aria-live="polite">
                                    {fieldErrors.latitude}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("location_form.longitude")} *</label>
                            <input
                                type="number"
                                step="any"
                                value={longitude}
                                onChange={(e) => {
                                    setLongitude(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.longitude) setFieldErrors((prev) => ({ ...prev, longitude: "" }));
                                }}
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
                                onClick={() => {
                                    setIsPublic(false);
                                    setDirty(true);
                                }}
                                className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                                    !isPublic
                                        ? "bg-gray-100 border-gray-300 text-gray-700"
                                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                🔒 {t("locations.badge_private")}
                            </button>
                            <button
                                onClick={() => {
                                    setIsPublic(true);
                                    setDirty(true);
                                }}
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
                            {saving ? t("location_form.saving") : t("location_form.save_changes")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
