"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import HoroscopeCardList from "@/components/HoroscopeCardList";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { formatDate } from "@/lib/date";
import { writeHoroscopeSort } from "@/lib/horoscopeSort";
import Link from "next/link";

interface Horoscope {
    _id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    location?: { id: string } | null;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    isPublic: boolean;
    createdAt: string;
    owner: { id: string };
}

type SortableColumn = "name" | "birthDate" | "locationName" | "isPublic";

const SORT_LABEL_KEYS: Record<SortableColumn, string> = {
    name: "horoscope.name",
    birthDate: "horoscope.birthDate",
    locationName: "horoscope.location",
    isPublic: "horoscope.public",
};

/** `useSearchParams` needs a Suspense boundary for the static prerender. */
export default function HoroscopesPage() {
    return (
        <Suspense>
            <HoroscopesList />
        </Suspense>
    );
}

function HoroscopesList() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();
    const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [sortColumn, setSortColumn] = useState<SortableColumn>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

    // The top-bar search lands here with `?q=` (guests have no search page).
    useEffect(() => {
        setSearchQuery(searchParams.get("q") ?? "");
    }, [searchParams]);

    useEffect(() => {
        if (status === "loading") return;

        // Guests get the public horoscopes only (the API filters them).
        fetch("/api/horoscope")
            .then((r) => r.json())
            .then((data) => {
                setHoroscopes(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [status]);

    useEffect(() => {
        writeHoroscopeSort({ sortBy: sortColumn, sortDir: sortDirection });
    }, [sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const sortedHoroscopes = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? horoscopes.filter((h) => {
                  // formatDate gives yyyy-MM-dd, so this matches a full date, a year or a year-month.
                  const date = formatDate(h.birthDate);
                  const location = h.locationName || (h.latitude ? `${h.latitude}, ${h.longitude}` : "");
                  return (
                      h.name.toLowerCase().includes(query) ||
                      date.includes(query) ||
                      (h.birthTime ?? "").includes(query) ||
                      location.toLowerCase().includes(query)
                  );
              })
            : horoscopes;
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortColumn) {
                case "name":
                    cmp = a.name.localeCompare(b.name);
                    break;
                case "birthDate":
                    cmp = new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
                    break;
                case "locationName": {
                    const locA = a.locationName || "";
                    const locB = b.locationName || "";
                    cmp = locA.localeCompare(locB);
                    break;
                }
                case "isPublic":
                    cmp = Number(a.isPublic) - Number(b.isPublic);
                    break;
            }
            return sortDirection === "asc" ? cmp : -cmp;
        });
        return sorted;
    }, [horoscopes, sortColumn, sortDirection, searchQuery]);

    const SortIcon = ({ column }: { column: SortableColumn }) => {
        if (sortColumn !== column) {
            return <span className="ml-1 text-gray-300">↕</span>;
        }
        return <span className="ml-1 text-indigo-600">{sortDirection === "asc" ? "▲" : "▼"}</span>;
    };

    if (status === "loading" || loading) {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/horoscope/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setHoroscopes((prev) => prev.filter((h) => h._id !== id));
            setConfirmDelete(null);
        } catch {
            setDeleteError(t("common.error"));
        } finally {
            setDeletingId(null);
        }
    };

    const isOwner = (h: Horoscope) => !!session && h.owner?.id === session.user?.id;

    const total = horoscopes.length;
    const publicCount = horoscopes.filter((h) => h.isPublic).length;
    const privateCount = total - publicCount;

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold">{t("nav.horoscopes")}</h1>
                {session && (
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/horoscopes/new"
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors text-sm"
                        >
                            + {t("horoscope.addBirth")}
                        </Link>
                        <Link
                            href="/horoscopes/new/manual"
                            className="border border-indigo-600 text-indigo-600 px-4 py-2 rounded hover:bg-indigo-50 transition-colors text-sm"
                        >
                            + {t("horoscope.addCalculated")}
                        </Link>
                    </div>
                )}
            </div>

            {session && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border">
                        <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{total}</div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-1">{t("horoscope.charts")}</div>
                    </div>
                    <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border">
                        <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{publicCount}</div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-1">{t("horoscope.public")}</div>
                    </div>
                    <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border">
                        <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{privateCount}</div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-1">{t("horoscope.private")}</div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4" role="alert">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <ConfirmDeleteModal
                open={confirmDelete !== null}
                onConfirm={() => {
                    if (confirmDelete) handleDelete(confirmDelete);
                }}
                onCancel={() => {
                    setConfirmDelete(null);
                    setDeleteError(null);
                }}
                loading={deletingId !== null}
                error={deleteError}
            />

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-3 sm:px-4 py-3 border-b space-y-2">
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("horoscope.searchPlaceholder")}
                        aria-label={t("horoscope.searchPlaceholder")}
                        className="w-full sm:w-80 border rounded px-3 py-2 text-sm"
                    />
                    {/* Column headers do the sorting on the table; phones get this control instead. */}
                    <div className="flex items-center gap-2 md:hidden">
                        <label htmlFor="horoscope-sort" className="text-xs text-gray-500 shrink-0">
                            {t("horoscope.sortBy")}
                        </label>
                        <select
                            id="horoscope-sort"
                            value={sortColumn}
                            onChange={(e) => setSortColumn(e.target.value as SortableColumn)}
                            className="flex-1 min-w-0 border rounded px-2 py-1.5 text-sm bg-white"
                        >
                            {(Object.keys(SORT_LABEL_KEYS) as SortableColumn[]).map((col) => (
                                <option key={col} value={col}>
                                    {t(SORT_LABEL_KEYS[col])}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                            className="shrink-0 h-9 px-3 border rounded text-sm text-gray-600 hover:bg-gray-50"
                            aria-label={sortDirection === "asc" ? t("horoscope.sortAsc") : t("horoscope.sortDesc")}
                            title={sortDirection === "asc" ? t("horoscope.sortAsc") : t("horoscope.sortDesc")}
                        >
                            {sortDirection === "asc" ? "▲" : "▼"}
                        </button>
                    </div>
                </div>

                {sortedHoroscopes.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        {horoscopes.length === 0 ? t("search.noResults") : t("horoscope.searchNoResults")}
                    </div>
                ) : (
                    <>
                        <div className="md:hidden">
                            <HoroscopeCardList
                                items={sortedHoroscopes}
                                renderBadge={(h) => (
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded ${h.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                    >
                                        {h.isPublic ? t("horoscope.public") : t("horoscope.private")}
                                    </span>
                                )}
                                canEdit={isOwner}
                                onEdit={(h) => router.push(`/horoscopes/${h._id}/edit`)}
                                onDelete={(h) => setConfirmDelete(h._id)}
                            />
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th
                                            className="whitespace-nowrap text-left px-3 sm:px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                            onClick={() => handleSort("name")}
                                        >
                                            {t("horoscope.name")}
                                            <SortIcon column="name" />
                                        </th>
                                        <th
                                            className="whitespace-nowrap text-left px-3 sm:px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                            onClick={() => handleSort("birthDate")}
                                        >
                                            {t("horoscope.birthDate")}
                                            <SortIcon column="birthDate" />
                                        </th>
                                        <th
                                            className="whitespace-nowrap text-left px-3 sm:px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                            onClick={() => handleSort("locationName")}
                                        >
                                            {t("horoscope.location")}
                                            <SortIcon column="locationName" />
                                        </th>
                                        <th
                                            className="whitespace-nowrap text-center px-3 sm:px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                            onClick={() => handleSort("isPublic")}
                                        >
                                            {t("horoscope.public")}
                                            <SortIcon column="isPublic" />
                                        </th>
                                        <th className="px-4 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedHoroscopes.map((h) => (
                                        <tr
                                            key={h._id}
                                            className="border-t hover:bg-gray-50 cursor-pointer"
                                            onClick={() => router.push(`/horoscopes/${h._id}`)}
                                        >
                                            <td className="px-3 sm:px-4 py-3 font-medium text-indigo-600 whitespace-nowrap">{h.name}</td>
                                            <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {formatDate(h.birthDate)} {h.birthTime}
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-gray-500 min-w-[10rem]">
                                                {h.locationName || (h.latitude ? `${h.latitude}, ${h.longitude}` : "")}
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-center">
                                                <span
                                                    className={`text-xs px-1.5 py-0.5 rounded ${h.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                                >
                                                    {h.isPublic ? t("horoscope.public") : t("horoscope.private")}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                {isOwner(h) && (
                                                    <div className="flex gap-1 justify-end">
                                                        <button
                                                            onClick={() => router.push(`/horoscopes/${h._id}/edit`)}
                                                            aria-label={`${t("horoscope.edit")} ${h.name}`}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded hover:bg-indigo-50"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDelete(h._id)}
                                                            aria-label={`${t("common.delete")} ${h.name}`}
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
                    </>
                )}
            </div>
        </div>
    );
}
