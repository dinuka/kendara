"use client";

import DoshaTagGroup from "@/components/yogaDosha/DoshaTagGroup";
import InfoGlyph from "@/components/yogaDosha/InfoGlyph";
import YogaTagGroup from "@/components/yogaDosha/YogaTagGroup";
import { useI18n } from "@/hooks/useI18n";

import { YogaDoshaResult } from "@/lib/yogaDosha";

interface YogaDoshaSectionProps {
    result: YogaDoshaResult;
}

/** Yogas & Doshas section — mounts between the Lagna card and the Houses table (UX spec §mount). */
const YogaDoshaSection = ({ result }: YogaDoshaSectionProps) => {
    const { t } = useI18n();

    return (
        <section id="yogas-doshas" aria-labelledby="yogas-doshas-title" className="bg-white rounded-lg border p-4">
            <h3
                id="yogas-doshas-title"
                className="font-semibold text-sm mb-3 text-indigo-700 uppercase tracking-wide inline-flex items-center"
            >
                {t("yogaDosha.title")}
                <InfoGlyph />
            </h3>
            <div className="space-y-4">
                <YogaTagGroup entries={result.yogas} />
                <DoshaTagGroup entries={result.doshas} />
            </div>
        </section>
    );
};

export default YogaDoshaSection;
