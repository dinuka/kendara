"use client";

import { useI18n } from "@/hooks/useI18n";
import { Fragment, type ReactNode, memo } from "react";

import { DASHA_NUMBER_GROUP_STARTS } from "@/lib/dashaNumbers";
import type { DashaNumber, PlanetDashaNumbers } from "@/lib/dashaNumbers";

import DashaNumberChip from "./DashaNumberChip";

interface DashaNumberTagsProps {
    numbers: PlanetDashaNumbers | undefined;
    getPlanetName: (id: number) => string;
    getSignName: (id: number) => string;
    /** Which groups to show (Dasha display settings). Conjunction groups include the nakshatra
     *  lord's conjunctions. */
    showOwn?: boolean;
    showNakshatraLord?: boolean;
    showConjunctions?: boolean;
}

const DashaNumberTags = ({
    numbers,
    getPlanetName,
    getSignName,
    showOwn = true,
    showNakshatraLord = true,
    showConjunctions = true,
}: DashaNumberTagsProps) => {
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
            <Fragment key={`${keyPrefix}-${index}`}>
                {index > 0 && DASHA_NUMBER_GROUP_STARTS.has(item.reason) && (
                    <span aria-hidden="true" className="mx-px">
                        ·
                    </span>
                )}
                <DashaNumberChip value={item.value} lines={heading ? [heading, describe(item)] : [describe(item)]} />
            </Fragment>
        ));

    const { own, nakshatraLord, nakshatraLordNumbers, conjunctions, nakshatraLordConjunctions } = numbers;

    const groups: ReactNode[] = [];
    if (showOwn) groups.push(renderTags(own, null, "own"));
    if (showNakshatraLord && nakshatraLord !== null && nakshatraLordNumbers.length > 0) {
        groups.push(
            renderTags(
                nakshatraLordNumbers,
                t("astrology.dashaNumbers.nakshatraLord", { planet: getPlanetName(nakshatraLord) }),
                "nak",
            ),
        );
    }
    if (showConjunctions) {
        conjunctions.forEach(({ planet, numbers: conjunctionNumbers }) =>
            groups.push(
                renderTags(
                    conjunctionNumbers,
                    t("astrology.dashaNumbers.conjunction", { planet: getPlanetName(planet) }),
                    `conj-${planet}`,
                ),
            ),
        );
        if (nakshatraLord !== null) {
            nakshatraLordConjunctions.forEach(({ planet, numbers: conjunctionNumbers }) =>
                groups.push(
                    renderTags(
                        conjunctionNumbers,
                        t("astrology.dashaNumbers.nakshatraLordConjunction", {
                            planet: getPlanetName(planet),
                            lord: getPlanetName(nakshatraLord),
                        }),
                        `nak-conj-${planet}`,
                    ),
                ),
            );
        }
    }
    if (groups.length === 0) return null;

    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
            (
            {groups.map((group, index) => (
                <Fragment key={index}>
                    {index > 0 && <span className="mx-0.5">|</span>}
                    {group}
                </Fragment>
            ))}
            )
        </span>
    );
};

export default memo(DashaNumberTags);
