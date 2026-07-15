"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";

interface HoroscopeData {
  _id: string;
  name: string;
  isPublic: boolean;
  displayName?: boolean;
  birthDate: string;
  birthTime: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gender?: string;
  ayanamsha?: string;
  owner?: { id: string };
}

export default function HoroscopeDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { t, locale } = useI18n();
  const [data, setData] = useState<{
    horoscope: HoroscopeData;
    calculatedDetails: Record<string, unknown> | null;
    charts: unknown[];
    metadata: unknown[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState("charts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }
    if (status !== "authenticated") return;

    fetch(`/api/horoscope/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, params.id, router]);

  if (loading || status === "loading") {
    return <div className="text-center py-20 text-gray-500">{t("common.loading")}</div>;
  }

  if (!data) return <div className="text-center py-20 text-gray-400">{t("common.error")}</div>;

  const { horoscope, calculatedDetails, charts } = data;

  const planetNames: Record<number, string> = {
    1: locale === "si" ? "රවි" : "Sun",
    2: locale === "si" ? "සඳ" : "Moon",
    3: locale === "si" ? "කුජ" : "Mars",
    4: locale === "si" ? "බුධ" : "Mercury",
    5: locale === "si" ? "ගුරු" : "Jupiter",
    6: locale === "si" ? "සිකුරු" : "Venus",
    7: locale === "si" ? "ශනි" : "Saturn",
    8: locale === "si" ? "රාහු" : "Rahu",
    9: locale === "si" ? "කේතු" : "Ketu",
  };

  const signNames: Record<number, string> = {
    1: locale === "si" ? "මේෂ" : "Aries",
    2: locale === "si" ? "වෘෂභ" : "Taurus",
    3: locale === "si" ? "මිථුන" : "Gemini",
    4: locale === "si" ? "කටක" : "Cancer",
    5: locale === "si" ? "සිංහ" : "Leo",
    6: locale === "si" ? "කන්යා" : "Virgo",
    7: locale === "si" ? "තුලා" : "Libra",
    8: locale === "si" ? "වෘශ්චික" : "Scorpio",
    9: locale === "si" ? "ධනු" : "Sagittarius",
    10: locale === "si" ? "මකර" : "Capricorn",
    11: locale === "si" ? "කුම්භ" : "Aquarius",
    12: locale === "si" ? "මීන" : "Pisces",
  };

  const tabs = [
    { id: "charts", label: t("horoscope.charts") },
    { id: "calculations", label: t("horoscope.calculations") },
    { id: "dashas", label: t("horoscope.dashas") },
    { id: "metadata", label: t("horoscope.metadata") },
  ];

  const chartTypes = [
    "birth", "house", "navamsa-d9", "drekkana-d3",
    "dasamsa-d10", "shodasha-vargas", "chandra-lagna", "surya-lagna",
  ];

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{horoscope.name}</h1>
          <p className="text-sm text-gray-500">
            {new Date(horoscope.birthDate).toLocaleDateString()} {horoscope.birthTime} |{" "}
            {horoscope.location || `${horoscope.latitude}, ${horoscope.longitude}`}
          </p>
        </div>
        <div className="flex gap-2">
          {horoscope.owner?.id === session?.user?.id && (
            <>
              <button
                onClick={() => router.push(`/horoscopes/${params.id}/edit`)}
                className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
              >
                {t("horoscope.edit")}
              </button>
              <span className={`text-xs px-2 py-1 rounded ${horoscope.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {horoscope.isPublic ? t("horoscope.public") : t("horoscope.private")}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "charts" && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {chartTypes.map((type) => (
              <button
                key={type}
                className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 capitalize"
              >
                {type.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-lg border p-6 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
            <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">{charts.length} charts available</p>
          </div>
        </div>
      )}

      {activeTab === "calculations" && calculatedDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-sm mb-2">Ascendant</h3>
            <p className="text-lg">
              {(calculatedDetails.ascendant as { sign?: number; degree?: number })?.sign
                ? signNames[(calculatedDetails.ascendant as { sign: number }).sign]
                : "-"}{" "}
              {(calculatedDetails.ascendant as { degree?: number })?.degree ?? ""}°
            </p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-sm mb-2">Planets</h3>
            <div className="space-y-1">
              {(calculatedDetails.planets as Array<{ name: number; sign: number; degree: number; house: number; strength: number }>)?.map((p, i) => (
                <div key={i} className="text-sm flex justify-between">
                  <span>{planetNames[p.name] || p.name}</span>
                  <span className="text-gray-500">
                    {signNames[p.sign] || p.sign} {p.degree}° H{p.house}
                    {p.strength === 1 ? " ↑" : p.strength === -1 ? " ↓" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-sm mb-2">Nakshatra</h3>
            <p className="text-sm text-gray-600">
              Moon: {(calculatedDetails.nakshatra as { moonNakshatra?: { id: number } })?.moonNakshatra?.id ?? "-"}
            </p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-sm mb-2">Maraka / Badhaka</h3>
            <div className="text-sm">
              <p>Maraka: {(calculatedDetails.marakaPlanets as number[])?.map((p: number) => planetNames[p]).join(", ") || "-"}</p>
              <p>Atmakaraka: {planetNames[(calculatedDetails.atmakaraka as number)] || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "dashas" && calculatedDetails && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-sm mb-2">Dashas</h3>
          <pre className="text-xs text-gray-600 overflow-auto">
            {JSON.stringify(calculatedDetails.dashas, null, 2)}
          </pre>
        </div>
      )}

      {activeTab === "metadata" && (
        <div className="bg-white rounded-lg border p-6 text-center text-gray-400">
          <p>{t("horoscope.metadata")}</p>
        </div>
      )}
    </div>
  );
}
