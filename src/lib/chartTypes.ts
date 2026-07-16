export enum ChartType {
    BIRTH = "birth",
    HOUSE = "house",
    NAVAMSA_D9 = "navamsa-d9",
    DREKKANA_D3 = "drekkana-d3",
    DASAMSA_D10 = "dasamsa-d10",
    SHODASHA_VARGAS = "shodasha-vargas",
    CHANDRA_LAGNA = "chandra-lagna",
    SURYA_LAGNA = "surya-lagna",
}

export const ALL_CHART_TYPES: ChartType[] = Object.values(ChartType);
