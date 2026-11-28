"use client";

import CancellationBlock from "@/components/yogaDosha/CancellationBlock";
import DashaNoteBlock from "@/components/yogaDosha/DashaNoteBlock";
import ExpressionBlock from "@/components/yogaDosha/ExpressionBlock";
import MitigationBlock from "@/components/yogaDosha/MitigationBlock";
import PlanetsBlock from "@/components/yogaDosha/PlanetsBlock";
import ReasonBlock from "@/components/yogaDosha/ReasonBlock";
import ResultBlock from "@/components/yogaDosha/ResultBlock";
import StateBadge from "@/components/yogaDosha/StateBadge";
import { useI18n } from "@/hooks/useI18n";

import { CancellationStatus } from "@/lib/astrologyEnums";
import { YogaDoshaEvaluation, classificationNameKey } from "@/lib/yogaDosha";

interface YogaDoshaDetailPanelProps {
    entry: YogaDoshaEvaluation;
    panelId: string;
    titleId: string;
}

/** Disclosure panel body — header (name, plus a "cancelled" sub tag when cancelled) + the planets and the six blocks. */
const YogaDoshaDetailPanel = ({ entry, panelId, titleId }: YogaDoshaDetailPanelProps) => {
    const { t } = useI18n();
    const root = `${entry.kind}.${entry.id}`;
    const titleKey = classificationNameKey(entry) ?? `${root}.name`;

    return (
        <div
            id={panelId}
            role="region"
            aria-labelledby={titleId}
            className="mt-2 rounded border border-gray-100 bg-gray-50 p-3 space-y-3"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h4 id={titleId} className="text-sm font-semibold text-gray-900">
                    {t(titleKey)}
                </h4>
                {/* Only a cancellation is worth a sub tag — tradition and strength are not shown. */}
                {entry.cancellation.status === CancellationStatus.CANCELLED && (
                    <StateBadge status={entry.cancellation.status} />
                )}
            </div>

            <PlanetsBlock entry={entry} />
            <ReasonBlock entry={entry} />
            <ResultBlock entry={entry} />
            <ExpressionBlock entry={entry} />
            <CancellationBlock entry={entry} />
            <MitigationBlock entry={entry} />
            <DashaNoteBlock entry={entry} />
        </div>
    );
};

export default YogaDoshaDetailPanel;
