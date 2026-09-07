"use client";

import { useI18n } from "@/hooks/useI18n";
import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface CancellationBlockProps {
    entry: YogaDoshaEvaluation;
}

/** Cancellation status line — always rendered (US-YD/UX: block 4, cancellation always visible). */
const CancellationBlock = ({ entry }: CancellationBlockProps) => {
    const { t } = useI18n();

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">
                {t("yogaDosha.cancellation")}
            </h5>
            <p className="mt-1 text-sm text-gray-800">{t(`cancellationStatus.${entry.cancellation.status}`)}</p>
        </div>
    );
};

export default CancellationBlock;