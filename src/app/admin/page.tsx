"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [tab, setTab] = useState<"horoscopes" | "users">("horoscopes");
    const [items, setItems] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

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
                                                {item.createdAt
                                                    ? new Date(item.createdAt as string).toLocaleDateString()
                                                    : ""}
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
        </div>
    );
}
