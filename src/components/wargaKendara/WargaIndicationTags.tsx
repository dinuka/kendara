"use client";

import { useI18n } from "@/hooks/useI18n";
import type { WargaVargaKey } from "@/lib/wargaKendara";

interface WargaIndicationTagsProps {
    /** Which chart the tags describe — resolves the astrology.wargaKendara.vargas.{key}.indication message. */
    chartKey: WargaVargaKey;
}

/** Main-indication tag chips under a Warga Kendara figure caption (UX Q6): the indication string of
 *  the displayed chart's own varga key, i18n-resolved and comma/semicolon-split into individual
 *  chips. An unresolvable indication renders a single `—` chip so the group is never empty. */
const WargaIndicationTags = ({ chartKey }: WargaIndicationTagsProps) => {
    const { t } = useI18n();
    const indicationKey = `astrology.wargaKendara.vargas.${chartKey}.indication`;
    const indication = t.has(indicationKey) ? t(indicationKey) : null;
    const chips = indication
        ? indication
              .split(/[,;]/)
              .map((chip) => chip.trim())
              .filter((chip) => chip.length > 0)
        : [];
    const items = chips.length > 0 ? chips : [t("astrology.wargaKendara.noDetails")];

    return (
        <div role="group" aria-label={t("astrology.wargaKendara.indicationLabel")} className="mt-2">
            <span className="flex flex-wrap gap-1">
                {items.map((chip, index) => (
                    <span
                        key={`${chip}-${index}`}
                        className="text-xs leading-tight px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-600"
                    >
                        {chip}
                    </span>
                ))}
            </span>
        </div>
    );
};

export default WargaIndicationTags;
