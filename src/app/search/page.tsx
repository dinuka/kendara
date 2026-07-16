"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Array<{ horoscope: Record<string, unknown>; score: number }>>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [config, setConfig] = useState<Record<string, boolean>>({
        birthChart: true,
        houseChart: true,
        navamsaD9: true,
        yogas: true,
        doshas: true,
        dashas: true,
    });

    if (status === "unauthenticated") {
        router.push("/signin");
        return null;
    }

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setSearched(true);

        try {
            const res = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            setResults(data.results || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">{t("search.title")}</h1>

            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                <div className="flex gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder={t("search.placeholder")}
                        className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
                    >
                        {loading ? t("common.loading") : t("search.search")}
                    </button>
                    <button
                        onClick={() => setConfigOpen(!configOpen)}
                        className="border px-3 py-2 rounded hover:bg-gray-50 text-sm"
                    >
                        {t("search.configPanel")}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">{t("search.basicSearch")}</p>
                <p className="text-xs text-gray-400">{t("search.complexSearch")}</p>
            </div>

            {configOpen && (
                <div className="bg-white rounded-lg border p-4 mb-6">
                    <h3 className="font-semibold text-sm mb-3">{t("search.configPanel")}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(config).map(([key, val]) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={val}
                                    onChange={() => setConfig({ ...config, [key]: !val })}
                                />
                                {key.replace(/([A-Z])/g, " $1")}
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={() =>
                            setConfig({
                                birthChart: true,
                                houseChart: true,
                                navamsaD9: true,
                                yogas: true,
                                doshas: true,
                                dashas: true,
                            })
                        }
                        className="text-xs text-indigo-600 mt-2 hover:underline"
                    >
                        {t("search.resetConfig")}
                    </button>
                </div>
            )}

            {searched && (
                <div>
                    <p className="text-sm text-gray-500 mb-4">
                        {results.length} {t("search.results").toLowerCase()}
                    </p>

                    {results.length === 0 ? (
                        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
                            {t("search.noResults")}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {results.map((r, i) => (
                                <div
                                    key={i}
                                    onClick={() => router.push(`/horoscopes/${(r.horoscope as { _id: string })._id}`)}
                                    className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">{(r.horoscope as { name: string }).name}</h3>
                                            <p className="text-sm text-gray-500">
                                                {(r.horoscope as { birthDate?: string }).birthDate
                                                    ? new Date(
                                                          (r.horoscope as { birthDate: string }).birthDate,
                                                      ).toLocaleDateString()
                                                    : ""}
                                            </p>
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                                            {t("search.relevance")}: {r.score}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!searched && (
                <div className="text-center py-20 text-gray-400">
                    <svg
                        className="w-12 h-12 mx-auto mb-3 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    <p className="text-sm">{t("search.placeholder")}</p>
                </div>
            )}
        </div>
    );
}
