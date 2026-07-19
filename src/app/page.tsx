"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

interface Horoscope {
    _id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    isPublic: boolean;
    createdAt: string;
    owner: { id: string };
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t, locale } = useI18n();
    const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [error, setError] = useState("");

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

    if (status === "loading" || loading) {
        return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    }

    if (!session) return null;

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/horoscope/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setHoroscopes((prev) => prev.filter((h) => h._id !== id));
            setConfirmDelete(null);
        } catch {
            setError(t("common.error"));
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
                <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
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

            {confirmDelete && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setConfirmDelete(null)}
                >
                    <div
                        className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-2">{t("horoscope.deleteConfirm")}</h3>
                        <p className="text-sm text-gray-600 mb-4">{t("horoscope.deleteWarning")}</p>
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

            {horoscopes.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-400">
                    {t("search.noResults")}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">{t("horoscope.name")}</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">
                                    {t("horoscope.birthDate")}
                                </th>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">
                                    {t("horoscope.location")}
                                </th>
                                <th className="text-center px-4 py-2 font-medium text-gray-600">
                                    {t("horoscope.public")}
                                </th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {horoscopes.map((h) => (
                                <tr
                                    key={h._id}
                                    className="border-t hover:bg-gray-50 cursor-pointer"
                                    onClick={() => router.push(`/horoscopes/${h._id}`)}
                                >
                                    <td className="px-4 py-3 font-medium text-indigo-600">{h.name}</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {new Date(h.birthDate).toLocaleDateString(locale === "si" ? "si-LK" : "en-US")}{" "}
                                        {h.birthTime}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {h.location || (h.latitude ? `${h.latitude}, ${h.longitude}` : "")}
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
