"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import Link from "next/link";

export default function SharedHoroscopePage() {
  const params = useParams();
  const { t, locale } = useI18n();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/${params.token}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [params.token]);

  if (loading) return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="text-center py-20 text-gray-400">{t("common.error")}: {error}</div>;
  if (!data) return null;

  const horoscope = data.horoscope as Record<string, unknown>;

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700 mb-6">
        Shared horoscope — view only
      </div>

      <h1 className="text-2xl font-bold mb-2">{horoscope.name as string}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {horoscope.birthDate ? new Date(horoscope.birthDate as string).toLocaleDateString() : ""} |{" "}
        {horoscope.location as string}
      </p>

      <Link href="/" className="text-indigo-600 hover:underline text-sm">
        {t("common.back")}
      </Link>
    </div>
  );
}
