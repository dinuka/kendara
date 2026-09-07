"use client";

import { useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { YogaEvaluation } from "@/lib/yogaDosha";

import YogaDoshaDetailPanel from "@/components/yogaDosha/YogaDoshaDetailPanel";
import YogaDoshaTag from "@/components/yogaDosha/YogaDoshaTag";

interface YogaTagGroupProps {
    entries: YogaEvaluation[];
}

/** Yoga chips in a row with their detail panels expanding below (multi-open, UX spec). */
const YogaTagGroup = ({ entries }: YogaTagGroupProps) => {
    const { t } = useI18n();
    const [openIds, setOpenIds] = useState<string[]>([]);
    const present = entries.filter((entry) => entry.isPresent);

    const toggle = (id: string) =>
        setOpenIds((current) =>
            current.includes(id) ? current.filter((cur) => cur !== id) : [...current, id],
        );

    return (
        <div role="group" aria-label={t("yogaDosha.groupYogaAria")}>
            <h4 className="font-semibold text-sm text-gray-700">
                {t("yogaDosha.yogaGroup")}{" "}
                {present.length > 0 && (
                    <span className="text-xs font-normal text-gray-500">
                        {t("yogaDosha.countLabel", { count: present.length })}
                    </span>
                )}
            </h4>
            {present.length === 0 ? (
                <p role="status" className="text-sm text-gray-500 mt-1">
                    {t("yogaDosha.emptyYogas")}
                </p>
            ) : (
                <>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {present.map((entry) => (
                            <YogaDoshaTag
                                key={entry.id}
                                entry={entry}
                                open={openIds.includes(entry.id)}
                                onToggle={() => toggle(entry.id)}
                            />
                        ))}
                    </div>
                    <div className="mt-2 space-y-2">
                        {present
                            .filter((entry) => openIds.includes(entry.id))
                            .map((entry) => (
                                <YogaDoshaDetailPanel
                                    key={entry.id}
                                    entry={entry}
                                    panelId={`yoga-${entry.id}-panel`}
                                    titleId={`yoga-${entry.id}-title`}
                                />
                            ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default YogaTagGroup;