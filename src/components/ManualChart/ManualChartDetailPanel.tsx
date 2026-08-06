"use client";

import DerivedRangesSection from "@/components/ManualChart/DerivedRanges";
import PlanetsTable from "@/components/ManualChart/PlanetsTable";
import { useMemo } from "react";

import ValidationBadges from "@/components/ManualChart/ValidationBadges";
import type { DerivedRanges, ManualChartResult, ManualHousePlacements } from "@/lib/manualChart";
import { compute } from "@/lib/manualChart";

interface ManualChartDetailPanelProps {
    manualHousePlacements: ManualHousePlacements;
    derivedRanges: DerivedRanges;
}

export default function ManualChartDetailPanel({ manualHousePlacements, derivedRanges }: ManualChartDetailPanelProps) {
    const result: ManualChartResult | null = useMemo(() => {
        try {
            const houses: Record<number, number[]> = {};
            manualHousePlacements.houses.forEach((h) => {
                if (h.planets.length > 0) houses[h.houseNumber] = h.planets;
            });
            const navamsaHouses: Record<number, number[]> = {};
            manualHousePlacements.navamsaHouses?.forEach((h) => {
                if (h.planets.length > 0) navamsaHouses[h.houseNumber] = h.planets;
            });
            const navamsaLagna = manualHousePlacements.navamsaLagna ?? manualHousePlacements.lagna;
            return compute(
                {
                    lagna: manualHousePlacements.lagna,
                    navamsaLagna,
                    houses,
                    navamsaHouses: Object.keys(navamsaHouses).length > 0 ? navamsaHouses : undefined,
                },
                null,
            );
        } catch {
            return null;
        }
    }, [manualHousePlacements]);

    if (!result) {
        return <div className="bg-white rounded-lg border p-4 text-sm text-gray-400">—</div>;
    }

    return (
        <div className="space-y-4">
            <ValidationBadges validation={manualHousePlacements.validation} scope="birth" />
            <PlanetsTable result={result} />
            <DerivedRangesSection ranges={derivedRanges} />
        </div>
    );
}
