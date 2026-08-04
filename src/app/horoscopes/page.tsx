"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

export default function HoroscopesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [sortColumn, setSortColumn] = useState<SortableColumn>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated") return;

        fetch("/api/horoscope")
            .then((r) => r.json())
            .then((data) => {
                setHoroscopes(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [status, router]);

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
        const sorted = [...horoscopes];
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
    }, [horoscopes, sortColumn, sortDirection]);

    const SortIcon = ({ column }: { column: SortableColumn }) => {
        if (sortColumn !== column) {
            return <span className="ml-1 text-gray-300">↕</span>;
        }
        return <span className="ml-1 text-indigo-600">{sortDirection === "asc" ? "▲" : "▼"}</span>;
    };

    if (status === "loading" || loading) {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    if (!session) return null;

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

    const isOwner = (h: Horoscope) => h.owner?.id === session.user?.id;

    const total = horoscopes.length;
    const publicCount = horoscopes.filter((h) => h.isPublic).length;
    const privateCount = total - publicCount;

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">{t("nav.horoscopes")}</h1>
                <Link
                    href="/horoscopes/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors text-sm"
                >
                    + {t("nav.addHoroscope")}
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-3xl font-bold text-indigo-600">{total}</div>
                    <div className="text-sm text-gray-500 mt-1">{t("horoscope.charts")}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-3xl font-bold text-indigo-600">{publicCount}</div>
                    <div className="text-sm text-gray-500 mt-1">{t("horoscope.public")}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-3xl font-bold text-indigo-600">{privateCount}</div>
                    <div className="text-sm text-gray-500 mt-1">{t("horoscope.private")}</div>
                </div>
            </div>

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

            {horoscopes.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-400">
                    {t("search.noResults")}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="text-left px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    {t("horoscope.name")}
                                    <SortIcon column="name" />
                                </th>
                                <th
                                    className="text-left px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                    onClick={() => handleSort("birthDate")}
                                >
                                    {t("horoscope.birthDate")}
                                    <SortIcon column="birthDate" />
                                </th>
                                <th
                                    className="text-left px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                    onClick={() => handleSort("locationName")}
                                >
                                    {t("horoscope.location")}
                                    <SortIcon column="locationName" />
                                </th>
                                <th
                                    className="text-center px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
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
                                    <td className="px-4 py-3 font-medium text-indigo-600">{h.name}</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {formatDate(h.birthDate)} {h.birthTime}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {h.locationName || (h.latitude ? `${h.latitude}, ${h.longitude}` : "")}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`text-xs px-1.5 py-0.5 rounded ${h.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                        >
                                            {h.isPublic ? t("horoscope.public") : t("horoscope.private")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
            )}
        </div>
    );
}
