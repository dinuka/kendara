declare module "jyotish-calculations" {
  export interface GrahaPosition {
    longitude: number;
    latitude: number;
    distance?: number;
    longitudeSpeed?: number;
    isRetrograde: boolean;
    rashi: string;
    nakshatra: { name: string; pada: number };
  }

  export interface BirthDetails {
    dateString: string;
    timeString: string;
    lat: number;
    lng: number;
    timezone: number;
  }

  export interface Options {
    zodiacType: string;
    ayanamsha: number;
    houseType: string;
  }

  export const grahas: {
    getGrahasPosition: (birthDetails: BirthDetails, options: Options) => Record<string, GrahaPosition>;
  };

  export const nakshatras: {
    getNakshatras: (degree: number) => { name: string; pada: number };
  };

  export const rashis: {
    getRashi: (degree: number) => string;
  };
}
