"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatDate } from "@/lib/date";

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
    const { t } = useI18n();

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

    if (loading) {
        return (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6">
                    {t("locations.title_pair")}
                </h1>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
                    ))}
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6">
                    {t("locations.title_pair")}
                </h1>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                    <button
                        onClick={() => fetchLocations(page, search)}
                        className="mt-2 text-sm text-red-600 underline hover:no-underline focus-visible:ring-2 focus-visible:ring-red-500 outline-none rounded"
                    >
                        {t("common.retry") || "Retry"}
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6">{t("locations.title_pair")}</h1>

            <fieldset className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm shadow-gray-900/5 mb-6">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
                    {t("locations.section_search_add")}
                </legend>
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                        <span
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                            aria-hidden="true"
                        >
                            🔍
                        </span>
                        <input
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={t("locations.search_placeholder")}
                            aria-label={t("locations.search_placeholder")}
                            className="w-full border border-gray-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-shadow"
                        />
                    </div>
                    <button
                        onClick={() => router.push("/locations/new")}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none shadow-sm shadow-indigo-600/20 transition-colors whitespace-nowrap"
                    >
                        + {t("locations.add")}
                    </button>
                </div>
            </fieldset>

            {confirmDelete && (
                <div
                    className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                    onClick={() => setConfirmDelete(null)}
                >
                    <div
                        className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full shadow-xl shadow-gray-900/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-gray-900 mb-2">{t("locations.delete_confirm")}</h3>
                        <p className="text-sm text-gray-500 mb-5">{t("locations.delete_warning")}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none transition-colors"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDelete)}
                                disabled={deletingId === confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 outline-none disabled:opacity-50 transition-colors"
                            >
                                {deletingId === confirmDelete ? t("common.loading") : t("common.delete")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <fieldset className="border border-gray-200 rounded-2xl bg-white shadow-sm shadow-gray-900/5 overflow-hidden">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 ml-4">
                    {t("locations.section_list")}
                </legend>

                {locations.length === 0 ? (
                    <div role="status" className="text-center py-16">
                        <p className="text-2xl mb-3" aria-hidden="true">
                            📍
                        </p>
                        <p className="text-gray-500 mb-4 text-sm">
                            {search ? t("locations.search_empty") : t("locations.empty")}
                        </p>
                        {!search && (
                            <button
                                onClick={() => router.push("/locations/new")}
                                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none shadow-sm shadow-indigo-600/20 transition-colors"
                            >
                                {t("locations.add")}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <table className="w-full border-collapse hidden md:table">
                            <thead>
                                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50/80">
                                    <th className="px-5 py-3">{t("location_form.name")}</th>
                                    <th className="px-5 py-3">{t("locations.coordinates")}</th>
                                    <th className="px-5 py-3">{t("locations.added_date")}</th>
                                    <th className="px-5 py-3">{t("location_form.visibility")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {locations.map((loc) => (
                                    <tr key={loc.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                                            <span className="mr-1.5" aria-hidden="true">
                                                📍
                                            </span>
                                            {loc.name}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 font-mono tabular-nums">
                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500">
                                            {formatDate(loc.createdAt)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {loc.isPublic ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-600/15">
                                                    🌐 {t("locations.badge_public")}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-500/10">
                                                    🔒 {t("locations.badge_private")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {isOwner(loc) && (
                                                <div className="flex gap-1 justify-end">
                                                    <button
                                                        onClick={() => router.push(`/locations/${loc.id}/edit`)}
                                                        aria-label={`${t("locations.edit")} ${loc.name}`}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-colors rounded-md hover:bg-indigo-50"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDelete(loc.id)}
                                                        aria-label={`${t("common.delete")} ${loc.name}`}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 outline-none transition-colors rounded-md hover:bg-red-50"
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

                        <div className="md:hidden divide-y divide-gray-100">
                            {locations.map((loc) => (
                                <div key={loc.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                <span className="mr-1.5" aria-hidden="true">
                                                    📍
                                                </span>
                                                {loc.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 font-mono tabular-nums">
                                                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                            </p>
                                        </div>
                                        {isOwner(loc) && (
                                            <div className="flex gap-1 -mr-1.5 -mt-1">
                                                <button
                                                    onClick={() => router.push(`/locations/${loc.id}/edit`)}
                                                    aria-label={`${t("locations.edit")} ${loc.name}`}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none transition-colors rounded-md hover:bg-indigo-50"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(loc.id)}
                                                    aria-label={`${t("common.delete")} ${loc.name}`}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 outline-none transition-colors rounded-md hover:bg-red-50"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2.5">
                                        {loc.isPublic ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-600/15">
                                                🌐 {t("locations.badge_public")}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-500/10">
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
                                className="flex items-center justify-center gap-4 px-5 py-4 border-t border-gray-100 text-sm"
                                role="navigation"
                                aria-label={t("common.page_of", { page, total: totalPages })}
                            >
                                <button
                                    onClick={() => fetchLocations(page - 1, search)}
                                    disabled={page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← {t("common.previous")}
                                </button>
                                <span className="text-gray-500" aria-current="page">
                                    {t("common.page_of", { page, total: totalPages })}
                                </span>
                                <button
                                    onClick={() => fetchLocations(page + 1, search)}
                                    disabled={page >= totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t("common.next")} →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </fieldset>
        </>
    );
}
