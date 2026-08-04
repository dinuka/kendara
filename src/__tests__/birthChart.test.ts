import { BirthChart } from "@/components/BirthChart";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calculateHoroscope } from "@/lib/calculation";

describe("BirthChart planet capacity", () => {
    const baseData = {
        name: "Repro",
        displayName: true,
        birthDate: new Date("1987-04-24"),
        birthTime: "23:57",
        location: "Sri Jayawardenepura General Hospital",
        latitude: 6.8967,
        longitude: 79.9073,
        gender: "male" as const,
        ayanamsha: "lahiri" as const,
        isPublic: false,
        owner: { id: "user-1" },
    } as unknown as any;

    const renderChart = () => {
        const result = calculateHoroscope(baseData);
        const svg = renderToStaticMarkup(
            React.createElement(BirthChart, {
                planets: result.planets.map((p) => ({
                    name: p.name,
                    house: p.house,
                    degree: p.degree,
                    retrograde: p.retrograde,
                })),
                houses: result.houses.map((h) => ({
                    houseNumber: h.houseNumber,
                    sign: h.sign,
                    lord: h.lord,
                })),
                ascendant: { sign: result.ascendant.sign, degree: result.ascendant.degree },
            }),
        );
        return { result, svg };
    };

    test("a house with 5 planets renders all of them, including Mercury", () => {
        const { result, svg } = renderChart();

        const house3Planets = result.planets.filter((p) => p.house === 3);
        expect(house3Planets).toHaveLength(5);
        expect(house3Planets.map((p) => p.name)).toContain(4); // Mercury

        const shortLabel = (name: number) =>
            ({ 1: "ර", 2: "ච", 3: "කු", 4: "බු", 5: "ගු", 6: "සි", 7: "ශ", 8: "රා", 9: "කේ" })[name];

        for (const p of house3Planets) {
            expect(svg).toContain(shortLabel(p.name));
        }
    });
});
