"use client";

import { useI18n } from "@/hooks/useI18n";

import { YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface DashaNoteBlockProps {
    entry: YogaDoshaEvaluation;
}

/** Soft dasha note: a muted footnote, never a timing prediction (UI-YD-537). Omitted when absent. */
const DashaNoteBlock = ({ entry }: DashaNoteBlockProps) => {
    const { t } = useI18n();

    if (!entry.dashaActivation) return null;

    return <p className="text-xs text-gray-500 italic">{t(entry.dashaActivation.noteKey)}</p>;
};

export default DashaNoteBlock;
