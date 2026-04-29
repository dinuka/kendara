export type Planet = {
  id: number;
  name: string;
  code: string;
};

export type Sign = {
  id: number;
  name: string;
  load: Planet;
};

export type House = {
  id: number;
};

export type Nakshatra = {
  id: number;
  name: string;
  load: Planet;
};

export type Degrees = {
  d: number;
  m: number;
  s: number;
};

export type PlanetaryPosition = {
  planet: Planet;
  degrees: Degrees;
  house: House;
  sign: Sign;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
  direct: boolean;
};

export type CuspalPosition = {
  id: number;
  sign: Sign;
  degrees: Degrees;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
};

export type DashaPeriod = {
  lord: Planet;
  startDate: string;
  endDate: string;
  subDashaPeriods: DashaPeriod[];
};

export type ChartData = {
  nakshatra: Nakshatra;
  nakshatraPada: number;
  tithi: {
    paksha: string;
    number: number;
  };
  planetaryPositions: PlanetaryPosition[];
  cuspalPositions: CuspalPosition[];
  dashas: DashaPeriod[];
};

export type Horoscope = {
  id: string;
  owner: { id: string };
  name: string;
  birthTime: string;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  chartData?: ChartData;
  createdAt: string;
  updatedAt: string;
};

export type ParsedHoroscope = Pick<Horoscope, 'name' | 'timezone' | 'location'> & {
  birthDate: string;
  birthTimeOfDay: string;
  chartData: ChartData;
};
