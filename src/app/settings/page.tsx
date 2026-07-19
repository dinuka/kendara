"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface OrbSettings {
    [key: string]: number;
}

const DEFAULT_ORBS: OrbSettings = {
    "1": 15, "2": 12, "3": 8, "4": 7, "5": 9, "6": 7, "7": 9, "8": 0, "9": 0,
};

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t, locale, setLocale } = useI18n();
    const [orbs, setOrbs] = useState<OrbSettings>(DEFAULT_ORBS);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;

        fetch("/api/settings")
            .then((r) => r.json())
            .then((data) => {
                if (data.planetaryOrbs) setOrbs(data.planetaryOrbs);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [status, router]);

    const updateOrb = (planetId: string, value: string) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 30) return;
        setOrbs((prev) => ({ ...prev, [planetId]: num }));
    };

    const save = async () => {
        await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planetaryOrbs: orbs }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const resetDefaults = () => {
        setOrbs(DEFAULT_ORBS);
    };

    if (status === "loading" || loading) return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    if (!session) return null;

    const planetPairs = [["1", "2"], ["3", "4"], ["5", "6"], ["7"], ["8", "9"]];

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

            <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">{t("settings.language")}</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setLocale("si")}
                            className={`px-4 py-2 rounded text-sm border transition-colors ${
                                locale === "si" ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"
                            }`}
                        >
                            {t("settings.sinhala")}
                        </button>
                        <button
                            onClick={() => setLocale("en")}
                            className={`px-4 py-2 rounded text-sm border transition-colors ${
                                locale === "en" ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"
                            }`}
                        >
                            {t("settings.english")}
                        </button>
                    </div>
                </div>

                <hr className="border-gray-200" />

                <div>
                    <h2 className="text-lg font-semibold mb-3">{t("settings.planetaryOrbs")}</h2>
                    <p className="text-sm text-gray-500 mb-4">{t("settings.orbDescription")}</p>
                    <div className="space-y-2">
                        {planetPairs.map((pair) => (
                            <div key={pair.join("-")} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {pair.map((id) => (
                                    <div key={id} className="flex items-center gap-3">
                                        <label className="w-24 text-sm font-medium text-gray-700">
                                            {t(`astrology.planetNames.${id}`)}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="30"
                                            step="0.5"
                                            value={orbs[id] ?? 0}
                                            onChange={(e) => updateOrb(id, e.target.value)}
                                            className="w-20 px-2 py-1.5 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs text-gray-400">°</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={save}
                            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                        >
                            {t("common.save")}
                        </button>
                        <button
                            onClick={resetDefaults}
                            className="px-4 py-2 border rounded text-sm hover:bg-gray-50 transition-colors"
                        >
                            {t("settings.resetDefaults")}
                        </button>
                    </div>
                    {saved && <p className="text-xs text-green-600 mt-2">{t("settings.saved")}</p>}
                </div>
            </div>
        </div>
    );
}
