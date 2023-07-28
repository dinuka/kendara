const example1: Kendara = {
  "name": "Dinuka",
  "lagna": {
    "name": "makara"
  },
  "navansaka": {
    "name": "makara"
  },
  "nekatha": {
    "name": "puwaputupa",
    "padaya": 4,
  },
  thithi: 27,
  degree: 0,
  grahas: [
    {
      name: "ravi",
      rashi: { name: "mesha" },
      degree: 10,
      bhava: { index: 4 },
      lagnayata: -1,
      rashiyata: 1.1,
      avastha: 7,
      status: -1,
    },
    {
      name: "sandu",
      rashi: { name: "meena" },
      degree: 0,
      bhava: { index: 3 },
      lagnayata: -1,
      rashiyata: 0.1,
      avastha: 10,
      status: 1
    }
  ],
  bhavas: [],
  sanyogas: [],
  yogas: []
}


interface Graha {
  name: string;
  rashi: Pick<Rashi, "name">;
  degree: number;
  bhava: Pick<Bhava, "index">;
  lagnayata: LagnaStatus;
  rashiyata: RashiStatus;
  drushti: Drushti[];
  avastha: Awastha;
  isLagnadipathi?: boolean;
  is22Derkana?: boolean;
  is64Navanshaka?: boolean;
  isMaraka?: boolean;
  isYogakaraka?: boolean;
}