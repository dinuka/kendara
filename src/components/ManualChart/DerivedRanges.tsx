"use client";

import { useI18n } from "@/hooks/useI18n";

import { type DerivedRanges, deriveBirthDateRange } from "@/lib/manualChart";

interface DerivedRangesSectionProps {
    ranges: DerivedRanges;
    birthDate?: Date | string | null;
}

export default function DerivedRangesSection({ ranges, birthDate }: DerivedRangesSectionProps) {
    const { t, locale } = useI18n();

    const hasBirthDate = !!birthDate;
    const birthDateRange = deriveBirthDateRange(ranges.birthMonthRange, ranges.birthDateCandidates);

    return (
        <section
            role="region"
            aria-label={t("manualChart.derivedRangesTitle")}
            className="bg-white rounded-lg border p-4"
        >
            <h3 className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide">
                {t("manualChart.derivedRangesTitle")}
            </h3>
            <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                    <dt className="text-gray-500 w-32 shrink-0">⏱ {t("manualChart.birthTime")}</dt>
                    <dd className="text-gray-700">
                        {ranges.birthTimeRange ? (
                            `${ranges.birthTimeRange.start} – ${ranges.birthTimeRange.end}`
                        ) : (
                            <span className="text-gray-400 italic">{t("manualChart.placeRaviFirst")}</span>
                        )}
                    </dd>
                </div>
                {!hasBirthDate && (
                    <>
                        <div className="flex gap-2">
                            <dt className="text-gray-500 w-32 shrink-0">📅 {t("manualChart.birthDate")}</dt>
                            <dd className="text-gray-700">
                                {birthDateRange ? (
                                    `${formatDate(birthDateRange.start, t)} – ${formatDate(birthDateRange.end, t)}`
                                ) : (
                                    <span className="text-gray-400 italic">{t("manualChart.placeRaviFirst")}</span>
                                )}
                            </dd>
                        </div>
                        <div className="flex gap-2">
                            <dt className="text-gray-500 w-32 shrink-0">🎂 {t("manualChart.ages")}</dt>
                            <dd className="text-gray-700">
                                {ranges.ageRanges.length > 0 ? (
                                    ranges.ageRanges
                                        .map(
                                            (a, i) =>
                                                `${ordinal(i + 1, locale)} ≈${Math.round(a.valueYears)}y${a.warning ? " ⚠" : ""}`,
                                        )
                                        .join(" · ")
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </dd>
                        </div>
                    </>
                )}
            </dl>
            <p className="text-xs text-gray-400 mt-3">ℹ {t("manualChart.estimateDisclaimer")}</p>
        </section>
    );
}

function formatDate(d: { month: number; day: number }, t: (key: string) => string): string {
    return `${t(`manualChart.months.${d.month}`)} ${d.day}`;
}

function ordinal(n: number, locale: string): string {
    if (locale === "si") {
        return `${n}වන`;
    }
    const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return `${n}${suffix}`;
}
