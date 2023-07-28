import { Person, Chart, ChartFactory, ChartType } from "astrologyjs";


(async () => {
  try {
    let jack = await Person.create("Jack", "1970-01-01T00:00Z", { lat: 37.4381927, lng: -79.18932 });

    let natal = await ChartFactory.create("Basic natal", jack);

    console.log(natal)

  } catch (err) {
    console.log(err, "eeee");
  }
})();
