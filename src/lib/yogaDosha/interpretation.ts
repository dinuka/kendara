/**
 * Yoga / Dosha — interpretation generation.
 * Produces theme keys (Result block groups by the house{n} prefix) and expression keys from the
 * rules a formation triggered. Theme meanings: 4/7/8/10 shaniMangala, 1/2/4/7/8/12 manglik
 * (Kuja Dosha). Houses outside the confirmed set stay pending domain — their SI strings fall
 * back to English placeholders (BI-YD-703).
 */
import { RuleEvaluation, ThemeInfo } from "@/lib/yogaDosha/types";

function uniqueHouses(ruleResults: RuleEvaluation[]): number[] {
    const seen = new Set<number>();
    ruleResults.forEach((result) => result.houseImpact?.forEach((house) => seen.add(house)));
    return [...seen].sort((a, b) => a - b);
}

const paramsForHouse = (house: number) => ({ house });

/** Generic house-theme interpreter — one theme per impacted house, expression keys from the
 *  catalog entry (shaniMangala: `expression.main`, manglik: `expression.partnershipStress`). */
export function interpretHouses(
    ruleResults: RuleEvaluation[],
    expressionKeys: string[],
): { themes: ThemeInfo[]; expressionKeys: string[] } {
    const themes = uniqueHouses(ruleResults).map((house) => ({
        key: `theme.house${house}` as const,
        params: paramsForHouse(house),
    }));
    return { themes, expressionKeys };
}
