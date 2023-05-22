const graha = [
  "kethu",
  "sikuru",
  "ravi",
  "sandu",
  "kuja",
  "rahu",
  "guru",
  "shani",
  "budha",
];

export const grahaValue: Record<string, number> = {
  kethu: 0,
  sikuru: -2,
  ravi: 2,
  sandu: -3,
  kuja: 3,
  rahu: -2,
  guru: 2,
  shani: 1,
  budha: -1,
}

const nekathToDasha = {
  asvidha: "kethu",
  ma: "kethu",
  mula: "kethu",
  berena: "sikuru",
  puwapal: "sikuru",
  puwasala: "sikuru",
  kathi: "ravi",
  uthurupal: "ravi",
  uthurusala: "ravi",
  rehena: "sandu",
  hatha: "sandu",
  suwana: "sandu",
  muwasirasa: "kuja",
  sitha: "kuja",
  denata: "kuja",
  ada: "rahu",
  sa: "rahu",
  siyawasa: "rahu",
  punawasa: "guru",
  visa: "guru",
  puwaputupa: "guru",
  pusa: "shani",
  anura: "shani",
  uthuruputupa: "shani",
  aslisa: "budha",
  deta: "budha",
  rewathi: "budha",
};

export const dasas = [
  { graha: "kethu", "years": 7 },
  { graha: "sikuru", "years": 20 },
  { graha: "ravi", "years": 6 },//2
  { graha: "sandu", "years": 10 },
  { graha: "kuja", "years": 7 },
  { graha: "rahu", "years": 18 },//5
  { graha: "guru", "years": 16 },//6
  { graha: "shani", "years": 19 },//7
  { graha: "budha", "years": 17 }//8
];