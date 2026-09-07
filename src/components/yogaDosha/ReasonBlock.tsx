"use client";

import { useI18n } from "@/hooks/useI18n";
import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface ReasonBlockProps {
    entry: YogaDoshaEvaluation;
}

/** "Why it forms" — the formation.reasons lines (one per triggered catalog rule). */
const ReasonBlock = ({ entry }: ReasonBlockProps) => {
    const { t } = useI18n();
    const root = `${entry.kind}.${entry.id}`;

    if (entry.formation.reasons.length === 0) return null;

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">
                {t("yogaDosha.whyItForms")}
            </h5>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
                {entry.formation.reasons.map((reason) => (
                    <li key={reason.rule}>
                        {t(`${root}.${reason.reasonKey}`, reason.params)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ReasonBlock;