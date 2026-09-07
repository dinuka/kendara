"use client";

import { useI18n } from "@/hooks/useI18n";
import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface ExpressionBlockProps {
    entry: YogaDoshaEvaluation;
}

/** Expression paragraph lines (finalAssessment.expressionKeys). */
const ExpressionBlock = ({ entry }: ExpressionBlockProps) => {
    const { t } = useI18n();
    const root = `${entry.kind}.${entry.id}`;

    if (entry.finalAssessment.expressionKeys.length === 0) return null;

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">
                {t("yogaDosha.expression")}
            </h5>
            <div className="mt-1 space-y-1 text-sm text-gray-800">
                {entry.finalAssessment.expressionKeys.map((key) => (
                    <p key={key}>{t(`${root}.${key}`)}</p>
                ))}
            </div>
        </div>
    );
};

export default ExpressionBlock;