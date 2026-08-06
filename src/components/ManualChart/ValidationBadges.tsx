"use client";

import { useI18n } from "@/hooks/useI18n";

import type { PlacementValidation, ValidationStatus } from "@/lib/manualChart";

const STATUS_STYLE: Record<ValidationStatus, string> = {
    valid: "bg-green-100 text-green-700 border-green-200",
    invalid: "bg-red-100 text-red-700 border-red-200",
    incomplete: "bg-amber-100 text-amber-700 border-amber-200",
    skipped: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_KEY: Record<ValidationStatus, string> = {
    valid: "✓",
    invalid: "✗",
    incomplete: "⏳",
    skipped: "—",
};

interface BadgeSpec {
    key: string;
    base: string;
    count: boolean;
}

interface ValidationBadgesProps {
    validation: PlacementValidation;
    scope?: "birth" | "navamsa";
}

export default function ValidationBadges({ validation, scope = "birth" }: ValidationBadgesProps) {
    const { t } = useI18n();

    const badges: BadgeSpec[] =
        scope === "birth"
            ? [
                  { key: "budha", base: "budha", count: false },
                  { key: "sikuru", base: "sikuru", count: false },
                  { key: "rahu", base: "rahuKetu", count: false },
                  { key: "planets", base: "planetCount", count: true },
              ]
            : [{ key: "navamsa", base: "navamsaPlanetCount", count: true }];

    const resultOf = (b: BadgeSpec): { status: ValidationStatus; message: string; count?: number } => {
        switch (b.key) {
            case "budha":
                return validation.budha;
            case "sikuru":
                return validation.sikuru;
            case "rahu":
                return validation.rahuKethuAxis;
            case "planets":
                return validation.planetCount;
            default:
                return validation.navamsaPlanetCount;
        }
    };

    const messageOf = (b: BadgeSpec, status: ValidationStatus, count?: number): string => {
        const key = `manualChart.${b.base}${statusKeySuffix(status)}`;
        return b.count ? t(key, { count: String(count ?? 0) }) : t(key);
    };

    return (
        <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs mt-2">
            <span className="font-semibold text-gray-500">{t("manualChart.validation")}:</span>
            {badges.map((b) => {
                const result = resultOf(b);
                const text = messageOf(b, result.status, result.count);
                return (
                    <span
                        key={b.key}
                        title={result.status === "valid" || result.status === "skipped" ? "" : result.message}
                        className={`inline-flex items-center gap-1 border rounded px-2 py-0.5 ${STATUS_STYLE[result.status]}`}
                    >
                        <span aria-hidden>{STATUS_KEY[result.status]}</span>
                        {text}
                    </span>
                );
            })}
        </div>
    );
}

function statusKeySuffix(status: ValidationStatus): string {
    switch (status) {
        case "valid":
            return "Valid";
        case "invalid":
            return "Invalid";
        case "skipped":
            return "Skipped";
        case "incomplete":
            return "Incomplete";
    }
}
