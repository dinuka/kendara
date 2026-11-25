import {
    COLUMN_DEFS,
    DEFAULT_TABLE_PREFERENCES,
    type TableLayout,
    layoutsEqual,
    moveColumn,
    normalizeTableLayout,
    normalizeTablePreferences,
    optionOn,
    parseTablePreferences,
    setColumnOptions,
    setColumnVisible,
    visibleColumns,
} from "@/lib/tableColumns";

const ids = (layout: TableLayout, onlyVisible = true) =>
    layout.filter((s) => !onlyVisible || s.visible).map((s) => s.id);

describe("default layouts reproduce the historical tables", () => {
    it("Charts tab Houses: #, Sign, Planets, Aspects", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.charts.houses)).toEqual(["number", "sign", "planets", "aspects"]);
    });

    it("Calculations tab Houses: #, Start, Mid, End, Planets, Aspects, Kendrasthana", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.calculations.houses)).toEqual([
            "number",
            "start",
            "mid",
            "end",
            "planets",
            "aspects",
            "kendrasthana",
        ]);
    });

    it("Charts tab Planets keeps the birth-chart column order", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.charts.planets)).toEqual([
            "planet",
            "sign",
            "strength",
            "house",
            "ownership",
            "conjunctions",
            "aspects",
            "nakshatra",
            "bhavaSuchika",
            "other",
        ]);
    });

    it("Calculations tab Planets shows every column", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.calculations.planets)).toEqual(PLANET_IDS);
    });

    it("value options differ per view as before", () => {
        const chartsPlanet = DEFAULT_TABLE_PREFERENCES.charts.planets.find((s) => s.id === "planet");
        const calcPlanet = DEFAULT_TABLE_PREFERENCES.calculations.planets.find((s) => s.id === "planet");
        expect(optionOn(chartsPlanet, "symbol")).toBe(true);
        expect(optionOn(chartsPlanet, "retrograde")).toBe(false);
        expect(optionOn(calcPlanet, "symbol")).toBe(false);
        expect(optionOn(calcPlanet, "retrograde")).toBe(true);
        const chartsSign = DEFAULT_TABLE_PREFERENCES.charts.planets.find((s) => s.id === "sign");
        expect(optionOn(chartsSign, "degree")).toBe(false);
    });

    it("every default layout lists every column exactly once", () => {
        for (const view of ["charts", "calculations"] as const) {
            for (const kind of ["houses", "planets"] as const) {
                const layout = DEFAULT_TABLE_PREFERENCES[view][kind];
                expect([...ids(layout, false)].sort()).toEqual(COLUMN_DEFS[kind].map((d) => d.id).sort());
            }
        }
    });
});

const PLANET_IDS = COLUMN_DEFS.planets.map((d) => d.id);

describe("normalizeTableLayout", () => {
    const fallback = DEFAULT_TABLE_PREFERENCES.charts.houses;

    it("falls back to the defaults for garbage", () => {
        expect(normalizeTableLayout("houses", "nope", fallback)).toEqual(fallback);
        expect(normalizeTableLayout("houses", null, fallback)).toEqual(fallback);
    });

    it("drops unknown columns, duplicates and unknown options; forces locked columns visible", () => {
        const result = normalizeTableLayout(
            "houses",
            [
                { id: "number", visible: false },
                { id: "bogus", visible: true },
                { id: "aspects", visible: true, options: { symbol: true, nope: true } },
                { id: "aspects", visible: false },
            ],
            fallback,
        );
        expect(result[0]).toEqual({ id: "number", visible: true });
        expect(result.find((s) => s.id === "aspects")).toEqual({ id: "aspects", visible: true, options: { symbol: true } });
        expect(result.filter((s) => s.id === "aspects")).toHaveLength(1);
    });

    it("inserts missing columns at their default position", () => {
        const result = normalizeTableLayout(
            "houses",
            [
                { id: "aspects", visible: true },
                { id: "number", visible: true },
            ],
            fallback,
        );
        expect(ids(result, false)).toEqual(["aspects", "kendrasthana", "number", "sign", "start", "mid", "end", "planets"]);
    });
});

describe("parseTablePreferences (strict API validation)", () => {
    it("accepts the defaults and a partial payload", () => {
        expect(parseTablePreferences(DEFAULT_TABLE_PREFERENCES)).toEqual(DEFAULT_TABLE_PREFERENCES);
        const partial = parseTablePreferences({ charts: { houses: [{ id: "number", visible: true }] } });
        expect(partial?.calculations).toEqual(DEFAULT_TABLE_PREFERENCES.calculations);
        expect(partial?.charts.houses[0]).toEqual({ id: "number", visible: true });
    });

    it.each([
        ["not an object", "x"],
        ["unknown view", { other: {} }],
        ["unknown table", { charts: { yogas: [] } }],
        ["unknown column", { charts: { houses: [{ id: "bogus", visible: true }] } }],
        ["duplicate column", { charts: { houses: [{ id: "sign", visible: true }, { id: "sign", visible: false }] } }],
        ["non-boolean visible", { charts: { houses: [{ id: "sign", visible: "yes" }] } }],
        ["unknown option", { charts: { houses: [{ id: "sign", visible: true, options: { degree: true } }] } }],
        ["non-boolean option", { charts: { houses: [{ id: "planets", visible: true, options: { degree: 1 } }] } }],
        ["extra key", { charts: { houses: [{ id: "sign", visible: true, color: "red" }] } }],
    ])("rejects %s", (_label, payload) => {
        expect(parseTablePreferences(payload)).toBeNull();
    });

    it("accepts Other-column tag options", () => {
        const parsed = parseTablePreferences({
            charts: { planets: [{ id: "other", visible: true, options: { maraka: false } }] },
        });
        expect(optionOn(parsed?.charts.planets.find((s) => s.id === "other"), "maraka")).toBe(false);
    });
});

describe("layout editing helpers", () => {
    const base = DEFAULT_TABLE_PREFERENCES.charts.houses;

    it("moveColumn reorders without mutating", () => {
        const moved = moveColumn(base, 1, 0);
        expect(ids(moved, false).slice(0, 2)).toEqual(["sign", "number"]);
        expect(ids(base, false).slice(0, 2)).toEqual(["number", "sign"]);
        expect(moveColumn(base, 0, 99)).toBe(base);
    });

    it("setColumnVisible ignores locked columns", () => {
        expect(setColumnVisible("houses", base, "number", false)).toBe(base);
        expect(setColumnVisible("houses", base, "start", true).find((s) => s.id === "start")?.visible).toBe(true);
    });

    it("setColumnOptions merges options", () => {
        const next = setColumnOptions(base, "planets", { degree: true });
        expect(optionOn(next.find((s) => s.id === "planets"), "degree")).toBe(true);
    });

    it("layoutsEqual treats an absent option as on", () => {
        const explicit = setColumnOptions(base, "sign", {});
        expect(layoutsEqual("houses", base, explicit)).toBe(true);
        const planetsOn = setColumnOptions(base, "planets", { degree: true });
        const withoutOption = base.map((s) => (s.id === "planets" ? { id: s.id, visible: s.visible } : s));
        expect(layoutsEqual("houses", planetsOn, withoutOption)).toBe(true);
        expect(layoutsEqual("houses", base, planetsOn)).toBe(false);
    });

    it("visibleColumns keeps order and skips columns the chart cannot fill", () => {
        const layout = DEFAULT_TABLE_PREFERENCES.calculations.houses;
        expect(visibleColumns(layout, new Set(["number", "planets", "aspects", "sign"])).map((s) => s.id)).toEqual([
            "number",
            "planets",
            "aspects",
        ]);
    });

    it("normalizeTablePreferences fills both views", () => {
        expect(normalizeTablePreferences(undefined)).toEqual(DEFAULT_TABLE_PREFERENCES);
    });
});
