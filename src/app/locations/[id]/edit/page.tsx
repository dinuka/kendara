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
            <div className="max-w-xl mx-auto">
                <div className="h-4 w-24 bg-gray-100 animate-pulse rounded mb-5" />
                <div className="h-8 w-64 bg-gray-100 animate-pulse rounded mb-6" />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm shadow-gray-900/5 p-6 space-y-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto">
            <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none rounded mb-5 transition-colors"
            >
                <span aria-hidden="true">←</span> {t("common.back")}
            </button>

            <h1 className="text-[1.75rem] font-semibold tracking-tight text-gray-900 mb-6">{t("locations.edit")}</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <aside
                className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4"
                role="note"
                aria-label={t("locations.edit_independence")}
            >
                <span aria-hidden="true">⚠️</span>
                <p className="text-xs text-amber-700 leading-relaxed">{t("locations.edit_independence")}</p>
            </aside>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm shadow-gray-900/5">
                <div className="px-6 py-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("location_form.name")} <span className="text-indigo-500">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setDirty(true);
                                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                            }}
                            className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-shadow ${
                                fieldErrors.name
                                    ? "border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-400"
                                    : "border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            }`}
                            aria-required="true"
                        />
                        {fieldErrors.name && (
                            <p className="text-xs text-red-500 mt-1.5" aria-live="polite">
                                {fieldErrors.name}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {t("location_form.latitude")} <span className="text-indigo-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={latitude}
                                onChange={(e) => {
                                    setLatitude(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: "" }));
                                }}
                                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-shadow ${
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
                                type="number"
                                step="any"
                                value={longitude}
                                onChange={(e) => {
                                    setLongitude(e.target.value);
                                    setDirty(true);
                                    if (fieldErrors.longitude) setFieldErrors((prev) => ({ ...prev, longitude: "" }));
                                }}
                                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-shadow ${
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("location_form.visibility")}
                        </label>
                        <div className="inline-flex p-1 bg-gray-100 rounded-lg gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPublic(false);
                                    setDirty(true);
                                }}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-all ${
                                    !isPublic ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                🔒 {t("locations.badge_private")}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPublic(true);
                                    setDirty(true);
                                }}
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
                        {saving ? t("location_form.saving") : t("location_form.save_changes")}
                    </button>
                </div>
            </div>
        </div>
    );
}
