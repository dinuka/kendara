import { writeFile } from "fs";
import moment, { Moment } from "moment";
import { dasas, grahaValue } from "./constants";

const birthDate = process.env.BIRTH_DATE;

if (!birthDate) {
  console.log("process.env.BIRTH_DATE not set");
  process.exit();
}

let nextMahaDasa = process.env.NEXT_MAHA_DASA;

if (!nextMahaDasa) {
  console.log("process.env.NEXT_MAHA_DASA not set");
  process.exit();
}

let nextMahaDasaStart = process.env.NEXT_MAHA_DASA_START;

if (!nextMahaDasaStart) {
  console.log("process.env.NEXT_MAHA_DASA_START not set");
  process.exit();
}

type Dasha = {
  graha: string,
  start: Moment,
  end: Moment,
  subDasha?: Dasha[];
}

const getDasha = (startGraha: string, startDate: Moment, endDate: Moment, dateRange: number, dashaCount: number) => {
  const userDasha: Dasha[] = [];

  let mahaDashaStart = startDate.toISOString();

  let dashaIndex = dasas.findIndex(({ graha }) => graha === startGraha);

  while (dashaCount <= 9) {
    const dashaStart = moment(mahaDashaStart);
    const dashaSeconds = (dateRange * (dasas[dashaIndex].years / 120));
    const dashaEnd = moment(mahaDashaStart).add(dashaSeconds, "s");

    if (dashaEnd.isSameOrAfter(endDate.add(1, "minute")))
      break;

    const dasha: Dasha = {
      graha: startGraha!,
      start: dashaStart,
      end: dashaEnd
    };

    userDasha.push(dasha);

    if (dasas[dashaIndex].graha === "budha")
      dashaIndex = 0;
    else
      dashaIndex++;

    startGraha = dasas[dashaIndex].graha;
    mahaDashaStart = dashaEnd.toISOString();

    dashaCount++;
  }

  return userDasha;
}

const getValue = (value: number, power: number) => {
  const powValue = value ** power;

  if (value < 0 && powValue > 0)
    return powValue * -1;

  return powValue;
}

const endDate = moment(birthDate).add(120, "years");

let userDasha = getDasha(nextMahaDasa!, moment(nextMahaDasaStart), endDate, endDate.diff(birthDate, "s"), 1);

const dashaTable: string[] = [];

const reportStart = moment();
const reportEnd = moment().add(5, "years");

userDasha = userDasha.map(dasha => {
  let subDasha = getDasha(dasha.graha, dasha.start, dasha.end, dasha.end.diff(dasha.start, "s"), 0);

  subDasha = subDasha.map(sd => {
    let subDasha2 = getDasha(sd.graha, sd.start, sd.end, sd.end.diff(sd.start, "s"), 0);

    subDasha2 = subDasha2.map(sd2 => {
      let subDasha3 = getDasha(sd2.graha, sd2.start, sd2.end, sd2.end.diff(sd2.start, "s"), 0);

      subDasha3.forEach(sd3 => {
        if (sd3.start.isAfter(reportStart) && sd3.end.isBefore(reportEnd)) {
          const value1 = grahaValue[sd3.graha];
          const value2 = getValue(grahaValue[sd2.graha], 2);
          const value3 = getValue(grahaValue[sd.graha], 3);
          const value4 = getValue(grahaValue[dasha.graha], 4);

          dashaTable.push([
            dasha.graha,
            sd.graha,
            sd2.graha,
            sd3.graha,
            sd3.start.format("L"),
            sd3.end.format("L"),
            value4,
            value3,
            value2,
            value1,
            value1 + value2 + value3 + value4
          ].join(","));
        }
      });

      return {
        ...sd2,
        subDasha: subDasha3
      };
    });

    return {
      ...sd,
      subDasha: subDasha2
    };
  });

  return {
    ...dasha,
    subDasha
  };
});

writeFile('output.csv', dashaTable.join("\n"), 'utf8', err => {
  if (err) {
    console.error('Error writing CSV file:', err);
  } else {
    console.log('CSV file has been successfully generated!');
  }
}); 