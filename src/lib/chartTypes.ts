export enum ChartType {
    BIRTH = "birth",
    NAVAMSA_D9 = "navamsa-d9",
    HOUSE = "house",
    CHANDRA_LAGNA = "chandra-lagna",
    SURYA_LAGNA = "surya-lagna",
    DREKKANA_D3 = "drekkana-d3",
    DASAMSA_D10 = "dasamsa-d10",
    SHODASHA_VARGAS = "shodasha-vargas",
    TRIMSHAMSHA_D30 = "trimshamsha-d30",
}

export const ALL_CHART_TYPES: ChartType[] = Object.values(ChartType);
