/**
 * Configurable columns for the Houses and Planets tables.
 *
 * The same two tables render in two places — every Warga Kendara figure on the Charts tab and the
 * Calculations tab — and each place keeps its own column layout (which columns are shown, in what
 * order, and per-column value options). Layouts are a per-user preference that applies to every
 * horoscope, persisted on `User.tablePreferences`.
 *
 * The defaults reproduce the historical tables exactly: the Charts tab shows the compact columns,
 * the Calculations tab shows the full ones.
 */

export type TableView = "charts" | "calculations";
export type TableKind = "houses" | "planets";

export const TABLE_VIEWS: readonly TableView[] = ["charts", "calculations"];
export const TABLE_KINDS: readonly TableKind[] = ["houses", "planets"];

export type HouseColumnId =
    | "number"
    | "sign"
    | "start"
    | "mid"
    | "end"
    | "planets"
    | "upagraha"
    | "aspects"
    | "kendrasthana";

export type PlanetColumnId =
    | "planet"
    | "subaAsuba"
    | "sign"
    | "strength"
    | "house"
    | "ownership"
    | "navamsa"
    | "navamsaStrength"
    | "nakshatra"
    | "bhavaSuchika"
    | "conjunctions"
    | "aspects"
    | "kendrasthana"
    | MaitriColumnId
    | "other";

/** Graha Maitri columns — one per compound relationship grade, strongest friendship first. */
export type MaitriColumnId = "adhiMitra" | "mitra" | "sama" | "shatru" | "adhiShatru";

export const MAITRI_COLUMN_IDS: readonly MaitriColumnId[] = ["adhiMitra", "mitra", "sama", "shatru", "adhiShatru"];

export type ColumnId = HouseColumnId | PlanetColumnId;

export interface ColumnOptionDef {
    id: string;
    /** i18n key of the option label. */
    labelKey: string;
}

export interface ColumnDef {
    id: ColumnId;
    /** i18n key of the column label (menu + default header). */
    labelKey: string;
    /** Locked columns identify the row; they are always visible. */
    locked?: boolean;
    /** Value options shown under the column in the configuration menu. */
    options?: readonly ColumnOptionDef[];
}

/** One column of a saved layout. Array order is display order. */
export interface ColumnSetting {
    id: ColumnId;
    visible: boolean;
    options?: Record<string, boolean>;
}

export type TableLayout = ColumnSetting[];

export type TablePreferences = Record<TableView, Record<TableKind, TableLayout>>;

const SYMBOL_OPTION: ColumnOptionDef = { id: "symbol", labelKey: "tableColumns.options.symbol" };
const DEGREE_OPTION: ColumnOptionDef = { id: "degree", labelKey: "tableColumns.options.degree" };

/** Keys of the Planets table "Other" tags, in display order, with their label keys. Each tag is a
 *  value option of the Other column (all shown by default). */
export const PLANET_TAG_OPTIONS: readonly ColumnOptionDef[] = [
    { id: "combustion", labelKey: "astrology.combustLabel" },
    { id: "drekkana10", labelKey: "astrology.drekkanaLord10Label" },
    { id: "drekkana16", labelKey: "astrology.drekkanaLord16Label" },
    { id: "drekkana", labelKey: "astrology.drekkanaLordLabel" },
    { id: "drekkana34", labelKey: "astrology.drekkanaLord34Label" },
    { id: "drekkanaMoon", labelKey: "astrology.drekkanaLordMoonLabel" },
    { id: "drekkanaSun", labelKey: "astrology.drekkanaLordSunLabel" },
    { id: "navamsa", labelKey: "astrology.navamsaLordLabel" },
    { id: "atmakaraka", labelKey: "astrology.atmakarakaLabel" },
    { id: "maranakaraka", labelKey: "astrology.maranakarakaLabel" },
    { id: "yogakaraka", labelKey: "astrology.yogakarakaLabel" },
    { id: "maraka", labelKey: "astrology.marakaLabel" },
    { id: "badhaka", labelKey: "astrology.badhakaLabel" },
    { id: "nidhanamsha", labelKey: "astrology.nidhanamshaLabel" },
    { id: "ashtamansha", labelKey: "astrology.ashtamanshaLabel" },
    { id: "wargoththama", labelKey: "astrology.wargoththamaLabel" },
    { id: "gandanta", labelKey: "astrology.gandantaLabel" },
    { id: "gandamula", labelKey: "astrology.gandamulaLabel" },
    { id: "pushkara", labelKey: "astrology.pushkaraLabel" },
    { id: "cheshtaBala", labelKey: "astrology.cheshtaBalaLabel" },
    { id: "kalaBala", labelKey: "astrology.kalaBalaLabel" },
    { id: "digBala", labelKey: "astrology.digBalaLabel" },
];

export const HOUSE_COLUMNS: readonly ColumnDef[] = [
    { id: "number", labelKey: "tableColumns.columns.houseNumber", locked: true },
    { id: "sign", labelKey: "astrology.sign" },
    { id: "start", labelKey: "astrology.start" },
    { id: "mid", labelKey: "astrology.mid" },
    { id: "end", labelKey: "astrology.end" },
    { id: "planets", labelKey: "astrology.planets", options: [DEGREE_OPTION] },
    { id: "upagraha", labelKey: "astrology.upagraha.column", options: [DEGREE_OPTION] },
    { id: "aspects", labelKey: "astrology.aspects", options: [SYMBOL_OPTION] },
    { id: "kendrasthana", labelKey: "astrology.kendrasthana", options: [SYMBOL_OPTION] },
];

export const PLANET_COLUMNS: readonly ColumnDef[] = [
    {
        id: "planet",
        labelKey: "astrology.planet",
        locked: true,
        options: [SYMBOL_OPTION, { id: "retrograde", labelKey: "tableColumns.options.retrograde" }],
    },
    { id: "subaAsuba", labelKey: "astrology.papiGrahayan.column" },
    { id: "sign", labelKey: "astrology.sign", options: [DEGREE_OPTION] },
    { id: "strength", labelKey: "astrology.strength" },
    { id: "house", labelKey: "astrology.house" },
    { id: "ownership", labelKey: "astrology.ownership" },
    { id: "navamsa", labelKey: "astrology.navamsa" },
    { id: "navamsaStrength", labelKey: "tableColumns.columns.navamsaStrength" },
    { id: "nakshatra", labelKey: "tableColumns.columns.nakshatraPada" },
    {
        id: "bhavaSuchika",
        labelKey: "astrology.bhavaSuchika.label",
        options: [{ id: "name", labelKey: "tableColumns.options.bhavaSuchikaName" }],
    },
    { id: "conjunctions", labelKey: "astrology.conjunctions", options: [SYMBOL_OPTION] },
    { id: "aspects", labelKey: "astrology.aspects", options: [SYMBOL_OPTION] },
    { id: "kendrasthana", labelKey: "astrology.kendrasthana", options: [SYMBOL_OPTION] },
    ...MAITRI_COLUMN_IDS.map((id) => ({ id, labelKey: `astrology.grahaMaitri.${id}` })),
    { id: "other", labelKey: "astrology.other", options: PLANET_TAG_OPTIONS },
];

export const COLUMN_DEFS: Record<TableKind, readonly ColumnDef[]> = {
    houses: HOUSE_COLUMNS,
    planets: PLANET_COLUMNS,
};

export function columnDef(kind: TableKind, id: ColumnId): ColumnDef | undefined {
    return COLUMN_DEFS[kind].find((def) => def.id === id);
}

/** Every option of a column defaults to `true` unless listed here as off. */
function col(id: ColumnId, visible: boolean, offOptions: string[] = []): ColumnSetting {
    return offOptions.length > 0
        ? { id, visible, options: Object.fromEntries(offOptions.map((key) => [key, false])) }
        : { id, visible };
}

/** Historical layouts. Hidden columns sit at their natural position so turning one on places it
 *  where a reader would expect it. */
export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
    charts: {
        houses: [
            col("number", true),
            col("sign", true),
            col("start", false),
            col("mid", false),
            col("end", false),
            col("planets", true, ["degree"]),
            col("upagraha", true),
            col("aspects", true, ["symbol"]),
            col("kendrasthana", false, ["symbol"]),
        ],
        planets: [
            col("planet", true, ["retrograde"]),
            col("subaAsuba", false),
            col("sign", true, ["degree"]),
            col("strength", true),
            col("house", true),
            col("ownership", true),
            col("navamsa", false),
            col("navamsaStrength", false),
            col("conjunctions", true, ["symbol"]),
            col("aspects", true, ["symbol"]),
            col("kendrasthana", false, ["symbol"]),
            col("nakshatra", true),
            col("bhavaSuchika", true, ["name"]),
            ...MAITRI_COLUMN_IDS.map((id) => col(id, false)),
            col("other", true),
        ],
    },
    calculations: {
        houses: [
            col("number", true),
            col("sign", false),
            col("start", true),
            col("mid", true),
            col("end", true),
            col("planets", true),
            col("upagraha", true),
            col("aspects", true),
            col("kendrasthana", true),
        ],
        planets: [
            col("planet", true, ["symbol"]),
            col("subaAsuba", true),
            col("sign", true),
            col("strength", true),
            col("house", true),
            col("ownership", true),
            col("navamsa", true),
            col("navamsaStrength", true),
            col("nakshatra", true),
            col("bhavaSuchika", true),
            col("conjunctions", true),
            col("aspects", true),
            col("kendrasthana", true),
            ...MAITRI_COLUMN_IDS.map((id) => col(id, true)),
            col("other", true),
        ],
    },
};

/** Whether a value option is on (options default to on). */
export function optionOn(setting: ColumnSetting | undefined, optionId: string): boolean {
    return setting?.options?.[optionId] ?? true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Lenient normalizer for stored/cached data: drops unknown columns, duplicates and unknown
 *  options, forces locked columns visible, and inserts columns missing from the saved layout
 *  (e.g. added in a later release) at their default position. Never throws. */
export function normalizeTableLayout(kind: TableKind, raw: unknown, fallback: TableLayout): TableLayout {
    if (!Array.isArray(raw)) return cloneLayout(fallback);
    const seen = new Set<ColumnId>();
    const result: TableLayout = [];
    for (const item of raw) {
        if (!isPlainObject(item)) continue;
        const def = typeof item.id === "string" ? columnDef(kind, item.id as ColumnId) : undefined;
        if (!def || seen.has(def.id)) continue;
        seen.add(def.id);
        const setting: ColumnSetting = { id: def.id, visible: def.locked ? true : item.visible !== false };
        if (def.options && isPlainObject(item.options)) {
            const options: Record<string, boolean> = {};
            for (const option of def.options) {
                const value = item.options[option.id];
                if (typeof value === "boolean") options[option.id] = value;
            }
            if (Object.keys(options).length > 0) setting.options = options;
        }
        result.push(setting);
    }
    // Missing columns: insert after the column that precedes them in the fallback layout.
    fallback.forEach((setting, index) => {
        if (seen.has(setting.id)) return;
        seen.add(setting.id);
        const previous = fallback
            .slice(0, index)
            .reverse()
            .find((s) => result.some((r) => r.id === s.id));
        const at = previous ? result.findIndex((r) => r.id === previous.id) + 1 : 0;
        result.splice(at, 0, cloneSetting(setting));
    });
    return result;
}

export function normalizeTablePreferences(raw: unknown): TablePreferences {
    const source = isPlainObject(raw) ? raw : {};
    const result = {} as TablePreferences;
    for (const view of TABLE_VIEWS) {
        const viewRaw = isPlainObject(source[view]) ? source[view] : {};
        result[view] = {} as Record<TableKind, TableLayout>;
        for (const kind of TABLE_KINDS) {
            result[view][kind] = normalizeTableLayout(kind, viewRaw[kind], DEFAULT_TABLE_PREFERENCES[view][kind]);
        }
    }
    return result;
}

/** Strict validator for API input: any unknown key, wrong type, unknown column/option or duplicate
 *  rejects the whole payload (null). A valid payload is returned normalized. */
export function parseTablePreferences(raw: unknown): TablePreferences | null {
    if (!isPlainObject(raw)) return null;
    for (const key of Object.keys(raw)) if (!TABLE_VIEWS.includes(key as TableView)) return null;
    for (const view of TABLE_VIEWS) {
        const viewRaw = raw[view];
        if (viewRaw === undefined) continue;
        if (!isPlainObject(viewRaw)) return null;
        for (const key of Object.keys(viewRaw)) if (!TABLE_KINDS.includes(key as TableKind)) return null;
        for (const kind of TABLE_KINDS) {
            const layout = viewRaw[kind];
            if (layout !== undefined && !isValidLayout(kind, layout)) return null;
        }
    }
    return normalizeTablePreferences(raw);
}

function isValidLayout(kind: TableKind, layout: unknown): boolean {
    if (!Array.isArray(layout) || layout.length > COLUMN_DEFS[kind].length) return false;
    const seen = new Set<string>();
    return layout.every((item) => {
        if (!isPlainObject(item)) return false;
        for (const key of Object.keys(item)) if (!["id", "visible", "options"].includes(key)) return false;
        if (typeof item.id !== "string" || seen.has(item.id)) return false;
        seen.add(item.id);
        const def = columnDef(kind, item.id as ColumnId);
        if (!def || typeof item.visible !== "boolean") return false;
        if (item.options === undefined) return true;
        if (!isPlainObject(item.options)) return false;
        return Object.entries(item.options).every(
            ([optionId, value]) =>
                typeof value === "boolean" && (def.options ?? []).some((option) => option.id === optionId),
        );
    });
}

function cloneSetting(setting: ColumnSetting): ColumnSetting {
    return setting.options ? { ...setting, options: { ...setting.options } } : { ...setting };
}

export function cloneLayout(layout: TableLayout): TableLayout {
    return layout.map(cloneSetting);
}

/** Move a column from one index to another (drag-and-drop / up-down buttons). */
export function moveColumn(layout: TableLayout, from: number, to: number): TableLayout {
    if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return layout;
    const next = cloneLayout(layout);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

export function setColumnVisible(kind: TableKind, layout: TableLayout, id: ColumnId, visible: boolean): TableLayout {
    if (columnDef(kind, id)?.locked) return layout;
    return layout.map((setting) => (setting.id === id ? { ...cloneSetting(setting), visible } : setting));
}

export function setColumnOptions(layout: TableLayout, id: ColumnId, options: Record<string, boolean>): TableLayout {
    return layout.map((setting) =>
        setting.id === id ? { ...setting, options: { ...setting.options, ...options } } : setting,
    );
}

/** The visible columns, in order, that the current chart can actually fill. */
export function visibleColumns<T extends ColumnId>(layout: TableLayout, available: ReadonlySet<T>): ColumnSetting[] {
    return layout.filter((setting) => setting.visible && available.has(setting.id as T));
}

/** Semantic equality: same order and visibility, and every option resolves the same (an absent
 *  option equals `true`). */
export function layoutsEqual(kind: TableKind, a: TableLayout, b: TableLayout): boolean {
    if (a.length !== b.length) return false;
    return a.every((setting, index) => {
        const other = b[index];
        if (setting.id !== other.id || setting.visible !== other.visible) return false;
        const options = columnDef(kind, setting.id)?.options ?? [];
        return options.every((option) => optionOn(setting, option.id) === optionOn(other, option.id));
    });
}
