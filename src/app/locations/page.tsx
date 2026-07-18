"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface LocationItem {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    isPublic: boolean;
    createdBy: { id: string };
    createdAt: string;
}

export default function LocationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t, locale } = useI18n();

    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    if (status === "unauthenticated") {
        router.push("/signin");
        return null;
    }

    const fetchLocations = useCallback(
        async (p: number, q?: string) => {
            setLoading(true);
            setError("");
            try {
                const params = new URLSearchParams({ page: String(p), limit: "20" });
                if (q) params.set("search", q);
                const res = await fetch(`/api/location?${params}`);
                if (!res.ok) throw new Error("Failed to load");
                const data = await res.json();
                setLocations(data.locations || []);
                setTotal(data.total);
                setPage(data.page);
                setTotalPages(data.totalPages);
            } catch {
                setError(t("locations.load_error"));
            } finally {
                setLoading(false);
            }
        },
        [t],
    );

    useEffect(() => {
        fetchLocations(page, search);
    }, []);

    const handleSearch = (value: string) => {
        setSearch(value);
        fetchLocations(1, value);
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/location/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setLocations((prev) => prev.filter((l) => l.id !== id));
            setTotal((prev) => prev - 1);
            setConfirmDelete(null);
        } catch {
            setError(t("locations.save_error"));
        } finally {
            setDeletingId(null);
        }
    };

    const isOwner = (loc: LocationItem) => loc.createdBy.id === session?.user?.id;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">{t("locations.title")}</h1>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">{t("locations.title")}</h1>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                    <button
                        onClick={() => fetchLocations(page, search)}
                        className="mt-2 text-sm text-red-600 underline hover:no-underline"
                    >
                        {t("common.retry") || "Retry"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">{t("locations.title")}</h1>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={t("locations.search_placeholder")}
                    aria-label={t("locations.search_placeholder")}
                    className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <button
                    onClick={() => router.push("/locations/new")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                    {t("locations.add")}
                </button>
            </div>

            {confirmDelete && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setConfirmDelete(null)}
                >
                    <div
                        className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-2">{t("locations.delete_confirm")}</h3>
                        <p className="text-sm text-gray-600 mb-4">{t("locations.delete_warning")}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-4 py-2 border rounded text-sm hover:bg-gray-50 transition-colors"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDelete)}
                                disabled={deletingId === confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {deletingId === confirmDelete ? t("common.loading") : t("common.delete")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {locations.length === 0 ? (
                <div role="status" className="text-center py-12">
                    <p className="text-gray-500 mb-4">{search ? t("locations.search_empty") : t("locations.empty")}</p>
                    {!search && (
                        <button
                            onClick={() => router.push("/locations/new")}
                            className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700 transition-colors"
                        >
                            {t("locations.add")}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b text-left text-sm text-gray-500">
                                    <th className="pb-3 font-medium">{t("location_form.name")}</th>
                                    <th className="pb-3 font-medium">{t("locations.coordinates")}</th>
                                    <th className="pb-3 font-medium">{t("locations.added_date")}</th>
                                    <th className="pb-3 font-medium">{t("location_form.visibility")}</th>
                                    <th className="pb-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((loc) => (
                                    <tr
                                        key={loc.id}
                                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="py-3 text-sm">
                                            <span className="mr-1">📍</span>
                                            {loc.name}
                                        </td>
                                        <td className="py-3 text-sm text-gray-600">
                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                        </td>
                                        <td className="py-3 text-sm text-gray-500">{formatDate(loc.createdAt)}</td>
                                        <td className="py-3">
                                            {loc.isPublic ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">
                                                    🌐 {t("locations.badge_public")}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-600">
                                                    🔒 {t("locations.badge_private")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            {isOwner(loc) && (
                                                <div className="flex gap-1 justify-end">
                                                    <button
                                                        onClick={() => router.push(`/locations/${loc.id}/edit`)}
                                                        aria-label={`${t("locations.edit")} ${loc.name}`}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded hover:bg-indigo-50"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDelete(loc.id)}
                                                        aria-label={`${t("common.delete")} ${loc.name}`}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden space-y-3">
                        {locations.map((loc) => (
                            <div key={loc.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium">
                                            <span className="mr-1">📍</span>
                                            {loc.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                        </p>
                                    </div>
                                    {isOwner(loc) && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => router.push(`/locations/${loc.id}/edit`)}
                                                aria-label={`${t("locations.edit")} ${loc.name}`}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(loc.id)}
                                                aria-label={`${t("common.delete")} ${loc.name}`}
                                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    {loc.isPublic ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">
                                            🌐 {t("locations.badge_public")}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-600">
                                            🔒 {t("locations.badge_private")}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400">{formatDate(loc.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div
                            className="flex items-center justify-center gap-4 mt-6 text-sm"
                            role="navigation"
                            aria-label={`Page ${page} of ${totalPages}`}
                        >
                            <button
                                onClick={() => fetchLocations(page - 1, search)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                {t("common.back")}
                            </button>
                            <span className="text-gray-500" aria-current={page === page ? "page" : undefined}>
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => fetchLocations(page + 1, search)}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                {t("common.next") || "Next"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
