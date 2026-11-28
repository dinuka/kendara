"use client";

import LocationPicker from "@/components/LocationPicker";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatDate } from "@/lib/date";

export default function EditHoroscopePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [locationName, setLocationName] = useState("");
    const [locationId, setLocationId] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;

        fetch(`/api/horoscope/${params.id}`)
            .then((r) => r.json())
            .then((d) => {
                const h = d.horoscope;
                setForm({
                    name: h.name || "",
                    birthDate: formatDate(h.birthDate) || "",
                    birthTime: h.birthTime || "",
                    gender: h.gender || "male",
                    ayanamsha: h.ayanamsha || "lahiri",
                    isPublic: h.isPublic ? "true" : "false",
                });
                setLat(String(h.latitude ?? ""));
                setLng(String(h.longitude ?? ""));
                setLocationName(h.locationName || "");
                setLocationId(h.location?.id ?? null);
                setLoading(false);
            });
    }, [status, params.id, router]);

    const handleLocationChange = (
        location: { id: string; name: string; latitude: number; longitude: number } | null,
    ) => {
        if (location) {
            setLocationId(location.id);
            setLocationName(location.name);
            setLat(location.latitude.toString());
            setLng(location.longitude.toString());
        } else {
            setLocationId(null);
            setLocationName("");
            setLat("");
            setLng("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const res = await fetch(`/api/horoscope/${params.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...form,
                location: locationId ? { id: locationId } : null,
                locationName,
                latitude: parseFloat(lat) || 0,
                longitude: parseFloat(lng) || 0,
            }),
        });

        if (res.ok) {
            router.push(`/horoscopes/${params.id}`);
        } else {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">{t("horoscope.edit")}</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t("horoscope.name")}</label>
                    <input
                        name="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.birthDate")}</label>
                        <input
                            type="date"
                            value={form.birthDate}
                            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                            required
                            lang="sv"
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.birthTime")}</label>
                        <input
                            type="time"
                            value={form.birthTime}
                            onChange={(e) => setForm({ ...form, birthTime: e.target.value })}
                            required
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div>
                    <LocationPicker selectedLocationId={locationId} onChange={handleLocationChange} />

                    {(locationId || locationName) && (
                        <div className="mt-3 space-y-2">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {t("location_picker.cached_name")}
                                </label>
                                <input
                                    value={locationName}
                                    onChange={(e) => setLocationName(e.target.value)}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">{t("horoscope.latitude")}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={lat}
                                        onChange={(e) => setLat(e.target.value)}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">{t("horoscope.longitude")}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={lng}
                                        onChange={(e) => setLng(e.target.value)}
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">{t("location_picker.override_hint")}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.gender")}</label>
                        <select
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                        >
                            <option value="male">{t("horoscope.male")}</option>
                            <option value="female">{t("horoscope.female")}</option>
                            <option value="other">{t("horoscope.other")}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.ayanamsha")}</label>
                        <select
                            value={form.ayanamsha}
                            onChange={(e) => setForm({ ...form, ayanamsha: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                        >
                            <option value="lahiri">{t("horoscope.lahiri")}</option>
                            <option value="raman">{t("horoscope.raman")}</option>
                            <option value="krishnamurti">{t("horoscope.krishnamurti")}</option>
                            <option value="yukteshwar">{t("horoscope.yukteshwar")}</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isPublic === "true"}
                            onChange={(e) => setForm({ ...form, isPublic: e.target.checked ? "true" : "false" })}
                        />
                        {t("horoscope.public")}
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? t("horoscope.calculating") : t("horoscope.save")}
                </button>
            </form>
        </div>
    );
}
