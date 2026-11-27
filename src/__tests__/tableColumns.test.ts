import {
    COLUMN_DEFS,
    deviceLayouts,
    DEFAULT_TABLE_PREFERENCES,
    type TableLayout,
    layoutsEqual,
    MAITRI_COLUMN_IDS,
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
    it("Charts tab Houses: #, Sign, Planets, Upagraha, Aspects, Other", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.charts.houses)).toEqual([
            "number",
            "sign",
            "planets",
            "upagraha",
            "aspects",
            "other",
        ]);
    });

    it("Calculations tab Houses: #, Sign, Planets, Upagraha, Aspects, Kendrasthana, Other", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.calculations.houses)).toEqual([
            "number",
            "sign",
            "planets",
            "upagraha",
            "aspects",
            "kendrasthana",
            "other",
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

    it("Calculations tab Planets shows every column except Graha Maitri", () => {
        expect(ids(DEFAULT_TABLE_PREFERENCES.calculations.planets)).toEqual(
            PLANET_IDS.filter((id) => !(MAITRI_COLUMN_IDS as readonly string[]).includes(id)),
        );
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
        expect(ids(result, false)).toEqual([
            "aspects",
            "kendrasthana",
            "other",
            "number",
            "sign",
            "start",
            "mid",
            "end",
            "planets",
            "upagraha",
        ]);
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
        expect(visibleColumns(layout, new Set(["number", "planets", "aspects", "start"])).map((s) => s.id)).toEqual([
            "number",
            "planets",
            "aspects",
        ]);
    });

    it("normalizeTablePreferences fills both views", () => {
        expect(normalizeTablePreferences(undefined)).toEqual(DEFAULT_TABLE_PREFERENCES);
    });
});

describe("phone (mobile) layouts", () => {
    it("default to a compact column set per view", () => {
        const mobile = DEFAULT_TABLE_PREFERENCES.mobile;
        expect(ids(mobile.charts.houses)).toEqual(["number", "sign", "planets", "aspects", "other"]);
        expect(ids(mobile.charts.planets)).toEqual(["planet", "sign", "strength", "house", "conjunctions", "aspects"]);
        // Planet symbols on, retrograde brackets off (desktop default options).
        const planet = mobile.charts.planets.find((s) => s.id === "planet");
        expect(optionOn(planet, "symbol")).toBe(true);
        expect(optionOn(planet, "retrograde")).toBe(false);
        expect(ids(mobile.calculations.houses)).toEqual(["number", "start", "end", "planets"]);
        expect(ids(mobile.calculations.planets)).toEqual(["planet", "sign", "strength", "house", "nakshatra"]);
    });

    it("keep every column (hidden) in the desktop order and options", () => {
        const desktop = DEFAULT_TABLE_PREFERENCES.charts.planets;
        const mobile = DEFAULT_TABLE_PREFERENCES.mobile.charts.planets;
        expect(ids(mobile, false)).toEqual(ids(desktop, false));
        expect(mobile.find((s) => s.id === "sign")?.options).toEqual(desktop.find((s) => s.id === "sign")?.options);
    });

    it("deviceLayouts picks the phone or desktop set", () => {
        expect(deviceLayouts(DEFAULT_TABLE_PREFERENCES, "mobile")).toBe(DEFAULT_TABLE_PREFERENCES.mobile);
        expect(deviceLayouts(DEFAULT_TABLE_PREFERENCES, "desktop").charts).toBe(DEFAULT_TABLE_PREFERENCES.charts);
    });

    it("stored preferences without a mobile branch get the phone defaults", () => {
        const normalized = normalizeTablePreferences({ charts: { houses: [{ id: "number", visible: true }] } });
        expect(normalized.mobile).toEqual(DEFAULT_TABLE_PREFERENCES.mobile);
    });

    it("parse accepts a mobile branch and keeps it separate from desktop", () => {
        const parsed = parseTablePreferences({
            mobile: { charts: { houses: [{ id: "aspects", visible: true }] } },
        });
        expect(parsed?.mobile.charts.houses.find((s) => s.id === "aspects")?.visible).toBe(true);
        expect(parsed?.charts).toEqual(DEFAULT_TABLE_PREFERENCES.charts);
    });

    it.each([
        ["non-object mobile", { mobile: [] }],
        ["unknown view under mobile", { mobile: { other: {} } }],
        ["unknown column under mobile", { mobile: { charts: { houses: [{ id: "bogus", visible: true }] } } }],
    ])("parse rejects %s", (_label, payload) => {
        expect(parseTablePreferences(payload)).toBeNull();
    });
});
