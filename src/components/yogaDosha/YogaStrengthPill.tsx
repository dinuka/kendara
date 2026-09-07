"use client";

import { useI18n } from "@/hooks/useI18n";

interface YogaStrengthPillProps {
    severity: number;
}

const PILL_STYLES: Record<number, string> = {
    1: "bg-red-100 text-red-800 border-red-300",
    2: "bg-orange-100 text-orange-800 border-orange-300",
    3: "bg-yellow-100 text-yellow-800 border-yellow-300",
    4: "bg-green-100 text-green-800 border-green-300",
};

/** Severity pill (1 = Very Strong / most severe → 4 = Weak). Lower value = stronger. */
const YogaStrengthPill = ({ severity }: YogaStrengthPillProps) => {
    const { t } = useI18n();
    const label = t(`yogaStrength.${severity}`);

    return (
        <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border ${PILL_STYLES[severity] ?? PILL_STYLES[4]}`}
        >
            {label}
        </span>
    );
};

export default YogaStrengthPill;