"use client";

import { useI18n } from "@/hooks/useI18n";
import { Fragment, memo } from "react";

import type { DashaNumber, PlanetDashaNumbers } from "@/lib/dashaNumbers";

import DashaNumberChip from "./DashaNumberChip";

interface DashaNumberTagsProps {
    numbers: PlanetDashaNumbers | undefined;
    getPlanetName: (id: number) => string;
    getSignName: (id: number) => string;
}

const DashaNumberTags = ({ numbers, getPlanetName, getSignName }: DashaNumberTagsProps) => {
    const { t } = useI18n();

    if (!numbers || numbers.own.length === 0) return null;

    const describe = ({ value, reason, planet, source, sign }: DashaNumber): string =>
        t(`astrology.dashaNumbers.${reason}`, {
            planet: getPlanetName(planet),
            source: getPlanetName(source),
            sign: sign ? getSignName(sign) : "",
            house: value,
        });

    const renderTags = (list: DashaNumber[], heading: string | null, keyPrefix: string) =>
        list.map((item, index) => (
            <DashaNumberChip
                key={`${keyPrefix}-${index}`}
                value={item.value}
                lines={heading ? [heading, describe(item)] : [describe(item)]}
            />
        ));

    const { own, nakshatraLord, nakshatraLordNumbers } = numbers;

    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
            ({renderTags(own, null, "own")}
            {nakshatraLord !== null && nakshatraLordNumbers.length > 0 && (
                <Fragment>
                    <span className="mx-0.5">|</span>
                    {renderTags(
                        nakshatraLordNumbers,
                        t("astrology.dashaNumbers.nakshatraLord", {
                            planet: getPlanetName(nakshatraLord),
                        }),
                        "nak",
                    )}
                </Fragment>
            )}
            )
        </span>
    );
};

export default memo(DashaNumberTags);
