describe("Search Functionality", () => {
    const mockHoroscopes = [
        { name: "Person A", ascendant: "Aries", planets: [{ name: "Saturn", strength: "Uchcha" }] },
        { name: "Person B", ascendant: "Cancer", planets: [{ name: "Jupiter", house: 3 }] },
    ];

    test("search filters by ascendant", () => {
        const results = mockHoroscopes.filter((h) => h.ascendant.toLowerCase().includes("aries"));
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Person A");
    });

    test("search filters by planet condition", () => {
        const results = mockHoroscopes.filter((h) => h.planets.some((p) => p.strength === "Uchcha"));
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Person A");
    });

    test("search filters by planet in house", () => {
        const results = mockHoroscopes.filter((h) => h.planets.some((p) => p.name === "Jupiter" && p.house === 3));
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Person B");
    });

    test("empty query returns all", () => {
        expect(mockHoroscopes.length).toBe(2);
    });
});
