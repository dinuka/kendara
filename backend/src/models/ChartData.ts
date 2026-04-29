interface Planet {
  id: number;
  name: string;
  code: string;
}

interface Sign {
  id: number;
  name: string;
  load: Planet;
}

interface Nakshatra {
  id: number;
  name: string;
  load: Planet;
}

interface House {
  id: number;
}

interface Degrees {
  d: number;
  m: number;
  s: number;
}

interface PlanetaryPosition {
  planet: Planet;
  degrees: Degrees;
  house: House;
  sign: Sign;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
  direct: boolean;
}

interface CuspalPosition {
  id: number;
  sign: Sign;
  degrees: Degrees;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
}

interface DashaPeriod {
  lord: Planet;
  startDate: string;
  endDate: string;
  subDashaPeriods: DashaPeriod[];
}

interface ChartData {
  nakshatra: Nakshatra;
  nakshatraPada: number;
  tithi: {
    paksha: string;
    number: number;
  };
  planetaryPositions: PlanetaryPosition[];
  cuspalPositions: CuspalPosition[];
  dashas: DashaPeriod[];
}

export default ChartData;
