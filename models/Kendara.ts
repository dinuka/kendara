interface Rashi {
  name: string;
}

interface Nekatha {
  name: string;
  padaya: number;
}

enum LagnaStatus {
  SUBA = 1,
  ASUBA = -1,
  SAMA = 0
}

enum RashiStatus {
  ATHI_UCHCHA = 1.1,
  UCHCHA = 1,
  MULA_THRIKONA = 0.75,
  SAVAKSHETHRA = 0.5,
  MITHRA = 0.1,
  SAMA = 0,
  SATHURU = -0.1,
  NEECHA = -1,
  ATHI_NEECHA = -1.1,
}

interface Drushti {
  graha: Pick<Graha, "name">;
  distance: number;
  status: boolean; //Mithur/Sathuru
}

enum Awastha {
  SHAYANA = 1,
  UPAVESHANA = 2,
  NETHRAPANI = 3,
  PRAKASHA = 4,
  GAMANA = 5,
  AGAMANA = 6,
  SABHA = 7,
  AGAMA = 8,
  BOJANA = 9,
  NRUTHYA_LIPSA = 10,
  KAUTHUKA = 11,
  NIDRA = 12
}

interface Graha {
  name: string;
  rashi: Pick<Rashi, "name">;
  degree: number;
  bhava: Pick<Bhava, "index">;
  lagnayata: LagnaStatus;
  rashiyata: RashiStatus;
  avastha: Awastha;
  drushti?: Drushti[];
  status: LagnaStatus;
  isLagnadipathi?: boolean;
  is22Derkana?: boolean;
  is64Navanshaka?: boolean;
  isMaraka?: boolean;
  isYogakaraka?: boolean;
}

interface Bhava {
  index: number;
  bavadipathi: Pick<Graha, "name">;
  bavadipathiPosition: Bhava & { status: boolean };
  drushti?: Drushti[];
  grahas: Pick<Graha, "name">[];
}

interface Sanyoga {
  grahas: Pick<Graha, "name">[];
  range: number;
  bhava: Pick<Bhava, "index">[];
}

interface Yoga {
  name: string;
  description?: string;
}

interface Kendara {
  name: string;
  lagna: Pick<Rashi, "name">;
  navansaka: Pick<Rashi, "name">;
  nekatha: Nekatha;
  thithi: number;
  degree: number;
  grahas: Graha[];
  bhavas: Bhava[];
  sanyogas: Sanyoga[];
  yogas: Yoga[];
}