"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { LocationInput } from "@/components/LocationInput";

export default function NewHoroscopePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  if (status === "unauthenticated") {
    router.push("/signin");
    return null;
  }

  const handleLocationSelect = (latitude: number, longitude: number, label: string) => {
    setLat(latitude.toString());
    setLng(longitude.toString());
    setLocationLabel(label);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name"),
      birthDate: form.get("birthDate"),
      birthTime: form.get("birthTime"),
      location: locationLabel,
      latitude: parseFloat(lat) || 0,
      longitude: parseFloat(lng) || 0,
      gender: form.get("gender"),
      ayanamsha: form.get("ayanamsha") || "lahiri",
      isPublic: form.get("isPublic") === "true",
      displayName: true,
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
            <input name="birthDate" type="date" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("horoscope.birthTime")}</label>
            <input name="birthTime" type="time" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("horoscope.location")}</label>
          <LocationInput
            onSelect={handleLocationSelect}
            lat={lat}
            lng={lng}
            onLatChange={setLat}
            onLngChange={setLng}
          />
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

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input name="isPublic" type="checkbox" value="true" />
            {t("horoscope.public")}
          </label>
        </div>

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
