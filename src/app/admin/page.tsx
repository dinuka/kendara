"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatDate } from "@/lib/date";
import Link from "next/link";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [tab, setTab] = useState<"horoscopes" | "users">("horoscopes");
    const [items, setItems] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/signin");
            return;
        }
        if (status !== "authenticated" || session?.user?.role !== "super-admin") {
            if (status === "authenticated") router.push("/");
            return;
        }

        const endpoint = tab === "horoscopes" ? "/api/admin" : "/api/admin/user";
        fetch(endpoint)
            .then((r) => r.json())
            .then((d) => {
                setItems(Array.isArray(d) ? d : []);
                setLoading(false);
            });
    }, [status, tab, router, session]);

    if (status === "loading") return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
    if (!session || session.user?.role !== "super-admin") return null;

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/admin/horoscope/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Delete failed");
            }
            setItems((prev) => prev.filter((item) => item._id !== id));
            setConfirmDelete(null);
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">{t("admin.title")}</h1>

            <div className="flex gap-1 mb-6 border-b">
                <button
                    onClick={() => setTab("horoscopes")}
                    className={`px-4 py-2 text-sm border-b-2 ${
                        tab === "horoscopes" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"
                    }`}
                >
                    {t("admin.horoscopes")}
                </button>
                <button
                    onClick={() => setTab("users")}
                    className={`px-4 py-2 text-sm border-b-2 ${
                        tab === "users" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"
                    }`}
                >
                    {t("admin.users")}
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">{t("common.loading")}</div>
            ) : (
                <div className="bg-white rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {tab === "horoscopes" ? (
                                    <>
                                        <th className="text-left px-4 py-2">Name</th>
                                        <th className="text-left px-4 py-2">Owner</th>
                                        <th className="text-left px-4 py-2">Public</th>
                                        <th className="text-left px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Actions</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="text-left px-4 py-2">Name</th>
                                        <th className="text-left px-4 py-2">Email</th>
                                        <th className="text-left px-4 py-2">Role</th>
                                        <th className="text-left px-4 py-2">Language</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: Record<string, unknown>, i: number) => (
                                <tr key={i} className="border-t hover:bg-gray-50">
                                    {tab === "horoscopes" ? (
                                        <>
                                            <td className="px-4 py-2">
                                                <Link
                                                    href={`/horoscopes/${item._id}`}
                                                    className="text-indigo-600 hover:underline"
                                                >
                                                    {item.name as string}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {(item.owner as { id?: string })?.id?.slice(-6)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span
                                                    className={`text-xs px-1.5 py-0.5 rounded ${item.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                                >
                                                    {item.isPublic ? "Yes" : "No"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {formatDate(item.createdAt as string)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Link
                                                        href={`/horoscopes/${item._id}`}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded hover:bg-indigo-50"
                                                        aria-label="View horoscope"
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="w-4 h-4"
                                                        >
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                        </svg>
                                                    </Link>
                                                    {item.isPublic === true && (
                                                        <button
                                                            onClick={() => setConfirmDelete(item._id as string)}
                                                            aria-label={`${t("common.delete")} ${item.name as string}`}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                className="w-4 h-4"
                                                            >
                                                                <path d="M3 6h18" />
                                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                                <line x1="10" y1="11" x2="10" y2="17" />
                                                                <line x1="14" y1="11" x2="14" y2="17" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-2 font-medium">{item.name as string}</td>
                                            <td className="px-4 py-2 text-gray-500">{item.email as string}</td>
                                            <td className="px-4 py-2">
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                                    {item.role as string}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {item.preferredLanguage as string}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
        </div>
    );
}
