"use client";

import { useI18n } from "@/hooks/useI18n";

import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface MitigationBlockProps {
    entry: YogaDoshaEvaluation;
}

/** Mitigation — distinct section with its own heading + tinted border. Rendered when mitigation
 *  factors exist OR the status reads Mitigated (3). Never presented as a cancellation. */
const MitigationBlock = ({ entry }: MitigationBlockProps) => {
    const { t } = useI18n();
    const root = `${entry.kind}.${entry.id}`;

    const visible = entry.mitigation.length > 0 || entry.cancellation.status === 3;
    if (!visible) return null;

    return (
        <div className="border-l-2 border-amber-300 pl-3">
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">{t("yogaDosha.mitigation")}</h5>
            <p className="mt-0.5 text-xs text-gray-500">{t("yogaDosha.mitigationNote")}</p>
            {entry.mitigation.length > 0 && (
                <ul className="mt-1 space-y-1 text-sm text-gray-800">
                    {entry.mitigation.map((factor) => {
                        const suffix = factor.factorKey.split(".").pop() ?? factor.factorKey;
                        return <li key={factor.factorKey}>{t(`${root}.mitigation.${suffix}`)}</li>;
                    })}
                </ul>
            )}
        </div>
    );
};

export default MitigationBlock;
