"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { useEffect } from "react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  if (status === "loading") return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
  if (!session) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
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

        <p className="text-xs text-green-600">{t("settings.saved")}</p>
      </div>
    </div>
  );
}
