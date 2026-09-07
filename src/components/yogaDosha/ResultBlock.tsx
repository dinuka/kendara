"use client";

import { useI18n } from "@/hooks/useI18n";
import { ThemeInfo, YogaDoshaEvaluation } from "@/lib/yogaDosha";

interface ResultBlockProps {
    entry: YogaDoshaEvaluation;
}

const HOUSE_THEME_PATTERN = /^theme\.house(\d+)$/;

/** Groups interpretation themes per house (house{n} keys); non-house themes land in General. */
const ResultBlock = ({ entry }: ResultBlockProps) => {
    const { t } = useI18n();
    const root = `${entry.kind}.${entry.id}`;

    if (entry.interpretation.themes.length === 0) return null;

    const grouped = new Map<string, ThemeInfo[]>();
    for (const theme of entry.interpretation.themes) {
        const match = theme.key.match(HOUSE_THEME_PATTERN);
        const groupKey = match ? `house-${match[1]}` : "general";
        const list = grouped.get(groupKey) ?? [];
        list.push(theme);
        grouped.set(groupKey, list);
    }

    return (
        <div>
            <h5 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">
                {t("yogaDosha.result")}
            </h5>
            <dl className="mt-1 space-y-2 text-sm text-gray-800">
                {[...grouped.entries()].map(([groupKey, themes]) => (
                    <div key={groupKey}>
                        <dt className="font-medium text-gray-600">
                            {groupKey.startsWith("house-")
                                ? t("yogaDosha.houseHeading", { house: groupKey.slice("house-".length) })
                                : t("yogaDosha.itemGroup")}
                        </dt>
                        {themes.map((theme) => (
                            <dd key={theme.key} className="ml-3">
                                {t(`${root}.${theme.key}`, theme.params)}
                            </dd>
                        ))}
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default ResultBlock;