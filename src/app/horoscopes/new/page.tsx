"use client";

import LocationPicker from "@/components/LocationPicker";
import PrivacyToggle from "@/components/PrivacyToggle";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewHoroscopePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [birthDate, setBirthDate] = useState("");
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [locationName, setLocationName] = useState("");
    const [locationId, setLocationId] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [displayName, setDisplayName] = useState(true);

    if (status === "unauthenticated") {
        router.push("/signin");
        return null;
    }

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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const form = new FormData(e.currentTarget);
        const data = {
            name: form.get("name"),
            birthDate,
            birthTime: form.get("birthTime"),
            location: locationId ? { id: locationId } : null,
            locationName: locationName,
            latitude: parseFloat(lat) || 0,
            longitude: parseFloat(lng) || 0,
            gender: form.get("gender"),
            ayanamsha: form.get("ayanamsha") || "lahiri",
            isPublic,
            displayName,
        };

        try {
            const res = await fetch("/api/horoscope", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                const h = await res.json();
                router.push(`/horoscopes/${h._id}`);
            }
        } catch {
            alert(t("common.error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">{t("horoscope.add")}</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t("horoscope.name")}</label>
                    <input name="name" required className="w-full border rounded px-3 py-2 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.birthDate")}</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            required
                            lang="sv"
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.birthTime")}</label>
                        <input
                            name="birthTime"
                            type="time"
                            required
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div>
                    <LocationPicker selectedLocationId={locationId} onChange={handleLocationChange} />

                    {locationId && (
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
                            <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.gender")}</label>
                        <select name="gender" required className="w-full border rounded px-3 py-2 text-sm">
                            <option value="male">{t("horoscope.male")}</option>
                            <option value="female">{t("horoscope.female")}</option>
                            <option value="other">{t("horoscope.other")}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("horoscope.ayanamsha")}</label>
                        <select name="ayanamsha" className="w-full border rounded px-3 py-2 text-sm">
                            <option value="lahiri">{t("horoscope.lahiri")}</option>
                            <option value="raman">{t("horoscope.raman")}</option>
                            <option value="krishnamurti">{t("horoscope.krishnamurti")}</option>
                            <option value="yukteshwar">{t("horoscope.yukteshwar")}</option>
                        </select>
                    </div>
                </div>

                <PrivacyToggle
                    isPublic={isPublic}
                    displayName={displayName}
                    onChange={(settings) => {
                        if (settings.isPublic !== undefined) setIsPublic(settings.isPublic);
                        if (settings.displayName !== undefined) setDisplayName(settings.displayName);
                    }}
                    saving={false}
                    error={null}
                    context="create"
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? t("horoscope.calculating") : t("horoscope.save")}
                </button>
            </form>
        </div>
    );
}
