"use client";

import { useI18n } from "@/hooks/useI18n";

import { formatDegree } from "@/lib/astrology";
import type { Nisheka } from "@/lib/nishekaLagna";

interface NishekaDetailsProps {
    nisheka: Nisheka;
}

/** The intermediate values of the Nisheka calculation (docs/nisheka-lagna.md), shown above the
 *  Nisheka chart so each step can be checked by hand. */
const NishekaDetails = ({ nisheka }: NishekaDetailsProps) => {
    const { t } = useI18n();
    const k = (key: string) => t(`astrology.wargaKendara.nisheka.${key}`);
    const sign = (longitude: number) => t(`astrology.signNames.${Math.floor((((longitude % 360) + 360) % 360) / 30) + 1}`);
    const position = (longitude: number) => `${sign(longitude)} ${formatDegree(longitude % 30)}`;
    const arc = (degrees: number) => formatDegree(degrees);
    const hemisphere =
        nisheka.lagnaLordInvisible === null
            ? k("onHorizon")
            : nisheka.lagnaLordInvisible
              ? k("invisible")
              : k("visible");
    const { months, days, hours, minutes } = nisheka.elapsed;

    const rows: [string, string][] = [
        [
            k("saturnMandi"),
            `${position(nisheka.saturnLongitude)} – ${position(nisheka.mandiLongitude)} = ${arc(nisheka.saturnMandiDistance)}`,
        ],
        [
            k("lagnaNinth"),
            `${position(nisheka.ascendantLongitude)} → ${position(nisheka.ninthCuspLongitude)} = ${arc(nisheka.lagnaNinthDistance)}`,
        ],
        [
            k("lagnaLord"),
            `${t(`astrology.planetNames.${nisheka.lagnaLord}`)} ${position(nisheka.lagnaLordLongitude)} · ${hemisphere}`,
        ],
        [
            k("moonCorrection"),
            nisheka.lagnaLordInvisible ? arc(nisheka.moonCorrection) : `${arc(nisheka.moonLongitude % 30)} (${k("notAdded")})`,
        ],
        [k("total"), arc(nisheka.totalAngle)],
        [k("elapsed"), t("astrology.wargaKendara.nisheka.elapsedValue", { months, days, hours, minutes })],
        [k("dateTime"), `${nisheka.localDate} ${nisheka.localTime}`],
        [k("lagna"), position(nisheka.ascendant.absoluteDegree)],
    ];

    return (
        <details className="mt-3 text-xs text-gray-700 border rounded" open>
            <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-700">{k("title")}</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pb-3">
                {rows.map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-gray-500 whitespace-nowrap">{label}</dt>
                        <dd className="font-mono break-words">{value}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
};

export default NishekaDetails;
