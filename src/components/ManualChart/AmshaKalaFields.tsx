"use client";

import { useI18n } from "@/hooks/useI18n";

import { degreeFromAmshaKala, splitAmshaKala } from "@/lib/manualChart";

export interface AmshaKalaInput {
    amsha: string;
    kala: string;
}

export function toAmshaKalaInput(degree: number | undefined | null): AmshaKalaInput {
    if (degree === undefined || degree === null || !Number.isFinite(degree)) return { amsha: "", kala: "" };
    const { amsha, kala } = splitAmshaKala(degree);
    return { amsha: String(amsha), kala: String(kala) };
}

/** Degree from amsha + kala text inputs. Amsha is required; an empty kala counts as 0. */
export function parseAmshaKala(input: AmshaKalaInput | undefined): number | null {
    if (!input || input.amsha.trim() === "") return null;
    const amsha = Number(input.amsha);
    const kala = input.kala.trim() === "" ? 0 : Number(input.kala);
    return degreeFromAmshaKala(amsha, kala);
}

/** Amsha (අංශක, 0-29) + kala (කලා, 0-59) inputs, e.g. 23° 20'. */
export default function AmshaKalaFields({
    value,
    onChange,
    label,
    size = "sm",
}: {
    value: AmshaKalaInput;
    onChange: (field: keyof AmshaKalaInput, value: string) => void;
    label: string;
    size?: "sm" | "md";
}) {
    const { t } = useI18n();
    const inputClass =
        size === "md"
            ? "w-16 border rounded px-2 py-2 text-sm text-right"
            : "w-10 border rounded px-1 py-0 text-xs text-right";
    const invalid = value.amsha.trim() !== "" && parseAmshaKala(value) === null;
    return (
        <span className="inline-flex items-center gap-0.5">
            <input
                type="number"
                inputMode="numeric"
                min={0}
                max={29}
                step={1}
                value={value.amsha}
                onChange={(e) => onChange("amsha", e.target.value)}
                placeholder={size === "md" ? t("manualChart.amsha") : "°"}
                aria-label={`${label} ${t("manualChart.amsha")}`}
                aria-invalid={invalid || undefined}
                className={`${inputClass} ${invalid ? "border-red-400" : ""}`}
            />
            <span className="text-gray-500">°</span>
            <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                value={value.kala}
                onChange={(e) => onChange("kala", e.target.value)}
                placeholder={size === "md" ? t("manualChart.kala") : "′"}
                aria-label={`${label} ${t("manualChart.kala")}`}
                aria-invalid={invalid || undefined}
                className={`${inputClass} ${invalid ? "border-red-400" : ""}`}
            />
            <span className="text-gray-500">′</span>
        </span>
    );
}
