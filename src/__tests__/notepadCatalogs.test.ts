/**
 * Student Notepad — house-purpose catalog unit tests.
 * QA plan: specs/qa/20260816-1823-student-notes-test-plan.md (UT-SN-001..010).
 */
import * as fs from "fs";
import * as path from "path";

import {
    DEFAULT_TAG_COLOR,
    HOUSE_PURPOSE_CATALOG,
    OBSERVATION_COLOR_CATALOG,
    PLANET_SIGNIFICATION_CATALOG,
    TAG_COLOR_CATALOG,
    housePurposeEntryFor,
    isObservationColor,
    isValidParentTag,
    isValidSubTag,
    isValidTagColor,
    planetsForSubTag,
} from "@/lib/notepadCatalogs";

const messagesDir = path.resolve(__dirname, "..", "..", "src", "messages");

describe("House-purpose catalog (UT-SN-001..008)", () => {
    test("UT-SN-001: exactly 13 parents, 1-12 in house order then 0/Other last", () => {
        expect(HOUSE_PURPOSE_CATALOG).toHaveLength(13);
        expect(HOUSE_PURPOSE_CATALOG.map((entry) => entry.parentTag)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0,
        ]);
        expect(HOUSE_PURPOSE_CATALOG[12].parentTag).toBe(0);
        expect(HOUSE_PURPOSE_CATALOG[12].sanskritName).toBe("other");
    });

    test("UT-SN-002: sanskrit names match the docs table", () => {
        const byTag = Object.fromEntries(HOUSE_PURPOSE_CATALOG.map((e) => [e.parentTag, e.sanskritName]));
        expect(byTag).toEqual({
            0: "other",
            1: "tanuLagna",
            2: "dhana",
            3: "sahaja",
            4: "sukha",
            5: "putra",
            6: "ari",
            7: "kalatra",
            8: "randhra",
            9: "dharma",
            10: "karma",
            11: "labha",
            12: "vyaya",
        });
    });

    test("UT-SN-003: parent 1 sub-tags (data-model list, 7 keys)", () => {
        const entry = housePurposeEntryFor(1);
        expect(entry?.subTags).toEqual([
            "self",
            "body",
            "personality",
            "identity",
            "vitality",
            "appearance",
            "overallLifeDirection",
        ]);
    });

    test("UT-SN-004: sub-tag keys are stable, non-empty, and globally unique", () => {
        const keys = HOUSE_PURPOSE_CATALOG.flatMap((entry) => entry.subTags);
        expect(keys.every((key) => typeof key === "string" && key.length > 0)).toBe(true);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test("UT-SN-005: Other (0) has no sub-tags; null is the only valid sub-tag for it", () => {
        const other = housePurposeEntryFor(0);
        expect(other?.subTags).toEqual([]);
        expect(isValidSubTag(0, null)).toBe(true);
        expect(isValidSubTag(0, "self")).toBe(false);
    });

    test("UT-SN-005b: null/undefined sub-tag valid for any parent (parent-level tags + reset)", () => {
        for (const parentTag of [1, 7, 12, 0]) {
            expect(isValidSubTag(parentTag, null)).toBe(true);
            expect(isValidSubTag(parentTag, undefined)).toBe(true);
        }
    });

    test("UT-SN-006: every house parent 1-12 exposes at least one sub-tag", () => {
        for (const entry of HOUSE_PURPOSE_CATALOG) {
            if (entry.parentTag === 0) continue;
            expect(entry.subTags.length).toBeGreaterThanOrEqual(1);
        }
    });

    test("UT-SN-007: reverse signification map — mapped keys resolve, unmapped keys return [] (no crash)", () => {
        const allKeys = HOUSE_PURPOSE_CATALOG.flatMap((entry) => entry.subTags);
        for (const key of allKeys) {
            const planets = planetsForSubTag(key);
            expect(Array.isArray(planets)).toBe(true);
            expect(planets.every((p) => Number.isInteger(p) && p >= 1 && p <= 9)).toBe(true);
        }
        // Known mappings from the data model.
        expect(planetsForSubTag("marriage")).toEqual([6]);
        expect(planetsForSubTag("mother")).toEqual([2]);
        expect(planetsForSubTag("wealth")).toEqual([5]);
        // Explicitly unmapped keys never crash and yield [].
        expect(planetsForSubTag("actionsInTheWorld")).toEqual([]);
    });

    test("UT-SN-008: every planet 1-9 has at least one signification", () => {
        expect(PLANET_SIGNIFICATION_CATALOG.map((entry) => entry.planet)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const entry of PLANET_SIGNIFICATION_CATALOG) {
            expect(entry.significations.length).toBeGreaterThanOrEqual(1);
        }
    });
});

describe("Tag colors + validators (UT-SN-009)", () => {
    test("UT-SN-009: palette is 1-6 in enum order; default White (1)", () => {
        expect([...TAG_COLOR_CATALOG]).toEqual([1, 2, 3, 4, 5, 6]);
        expect(DEFAULT_TAG_COLOR).toBe(1);
    });

    test("observation color palette — the unified 6 colors, in picker order", () => {
        expect([...OBSERVATION_COLOR_CATALOG]).toEqual([
            "white",
            "lightRed",
            "darkRed",
            "lightGreen",
            "darkGreen",
            "yellow",
        ]);
        expect(Object.isFrozen(OBSERVATION_COLOR_CATALOG)).toBe(true);
    });

    test("isObservationColor accepts the palette and rejects everything else", () => {
        for (const color of OBSERVATION_COLOR_CATALOG) expect(isObservationColor(color)).toBe(true);
        for (const bad of ["green", "red", "blue", "", 1, null, undefined, {}]) {
            expect(isObservationColor(bad)).toBe(false);
        }
    });

    test("UT-SN-009b: validators reject out-of-range / non-integer values", () => {
        expect(isValidTagColor(1)).toBe(true);
        expect(isValidTagColor(6)).toBe(true);
        expect(isValidTagColor(0)).toBe(false);
        expect(isValidTagColor(7)).toBe(false);
        expect(isValidTagColor("1")).toBe(false);
        expect(isValidTagColor(1.5)).toBe(false);
        expect(isValidTagColor(null)).toBe(false);

        expect(isValidParentTag(0)).toBe(true);
        expect(isValidParentTag(12)).toBe(true);
        expect(isValidParentTag(13)).toBe(false);
        expect(isValidParentTag(-1)).toBe(false);
        expect(isValidParentTag("7")).toBe(false);
        expect(isValidParentTag(7.5)).toBe(false);
        expect(isValidParentTag(null)).toBe(false);
    });

    test("UT-SN-009c: sub-tag must belong to its parent", () => {
        expect(isValidSubTag(7, "marriage")).toBe(true);
        expect(isValidSubTag(7, "mother")).toBe(false); // parent 4's key
        expect(isValidSubTag(1, "self")).toBe(true);
        expect(isValidSubTag(1, "spouse")).toBe(false);
    });
});

describe("Catalog immutability (UT-SN-010)", () => {
    test("UT-SN-010: catalog structures are deep-frozen — mutation is inert", () => {
        expect(Object.isFrozen(HOUSE_PURPOSE_CATALOG)).toBe(true);
        expect(Object.isFrozen(housePurposeEntryFor(7))).toBe(true);
        expect(Object.isFrozen(housePurposeEntryFor(7)?.subTags)).toBe(true);
        expect(Object.isFrozen(PLANET_SIGNIFICATION_CATALOG)).toBe(true);
        expect(Object.isFrozen(TAG_COLOR_CATALOG)).toBe(true);
        expect(Object.isFrozen(planetsForSubTag("marriage"))).toBe(true);

        expect(() => {
            (housePurposeEntryFor(7) as { subTags: string[] }).subTags.push("hacked");
        }).toThrow();
    });
});

describe("i18n key parity (BI-SN-801/802 companion)", () => {
    const en = JSON.parse(fs.readFileSync(path.join(messagesDir, "en.json"), "utf8")) as {
        notepad: Record<string, unknown>;
    };
    const si = JSON.parse(fs.readFileSync(path.join(messagesDir, "si.json"), "utf8")) as {
        notepad: Record<string, unknown>;
    };

    test("every parent has label + sanskrit keys in both locales", () => {
        for (const locale of [en, si]) {
            const housePurpose = locale.notepad.housePurpose as Record<string, unknown>;
            for (const parentTag of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
                const entry = housePurpose[String(parentTag)] as { label?: string; sanskrit?: string };
                expect(typeof entry?.label).toBe("string");
                expect(typeof entry?.sanskrit).toBe("string");
            }
        }
    });

    test("every catalog sub-tag key ships under housePurpose.subTags in both locales", () => {
        const allKeys = HOUSE_PURPOSE_CATALOG.flatMap((entry) => entry.subTags);
        for (const locale of [en, si]) {
            const subTags = (locale.notepad.housePurpose as { subTags: Record<string, string> }).subTags;
            for (const key of allKeys) {
                expect(typeof subTags[key]).toBe("string");
            }
        }
    });

    test("every observation color resolves a classification label in both locales (guards MISSING_MESSAGE)", () => {
        const colors = new Set<string>([
            "green",
            "darkGreen",
            "lightGreen",
            "red",
            "white",
            ...OBSERVATION_COLOR_CATALOG,
        ]);
        for (const locale of [en, si]) {
            const classification = (locale.notepad.observation as { classification: Record<string, string> })
                .classification;
            for (const color of colors) {
                expect(typeof classification[color]).toBe("string");
                expect(classification[color].length).toBeGreaterThan(0);
            }
        }
    });

    test("every SI notepad value is Sinhala or a pure placeholder template (guards untranslated English)", () => {
        const collect = (obj: unknown, out: string[] = []): string[] => {
            if (obj === null || typeof obj !== "object") return out;
            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith("notepad.")) continue;
                if (typeof value === "string") {
                    out.push(value);
                } else if (value && typeof value === "object") {
                    collect(value, out);
                }
            }
            return out;
        };
        const values = collect(si.notepad);
        expect(values.length).toBeGreaterThan(100);
        for (const value of values) {
            const hasSinhala = /[\u0D80-\u0DFF]/.test(value);
            const isPlaceholderTemplate = value.includes("{");
            expect(hasSinhala || isPlaceholderTemplate).toBe(true);
        }
    });
});
