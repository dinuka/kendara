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
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t, locale } = useI18n();
    const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
    const [loading, setLoading] = useState(true);

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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
