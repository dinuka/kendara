import {
    aliasError,
    chartImageCacheControl,
    chartImageVersion,
    isObjectId,
    normalizeAlias,
    parseSeoInput,
} from "@/lib/seo";

describe("normalizeAlias", () => {
    it("lowercases, trims and hyphenates", () => {
        expect(normalizeAlias("  Mahinda Rajapaksha ")).toBe("mahinda-rajapaksha");
        expect(normalizeAlias("MR__Kendara--")).toBe("mr-kendara");
    });
});

describe("aliasError", () => {
    it("accepts short slugs", () => {
        expect(aliasError("mr")).toBeNull();
        expect(aliasError("mahinda-rajapaksha")).toBeNull();
    });

    it("rejects bad format, length, reserved words and ObjectId-shaped values", () => {
        expect(aliasError("m")).toBe("length");
        expect(aliasError("mahinda_r")).toBe("format");
        expect(aliasError("මහින්ද")).toBe("format");
        expect(aliasError("new")).toBe("reserved");
        expect(aliasError("6b02fe695a6cb6eef9fc90a5")).toBe("objectId");
    });
});

describe("isObjectId", () => {
    it("detects 24-char hex ids", () => {
        expect(isObjectId("6b02fe695a6cb6eef9fc90a5")).toBe(true);
        expect(isObjectId("mahinda")).toBe(false);
    });
});

describe("parseSeoInput", () => {
    it("cleans and dedupes aliases, defaults indexed to true", () => {
        const result = parseSeoInput({ title: " Title ", aliases: ["Mahinda", "mahinda", "MR"] });
        expect(result).toEqual({ ok: true, seo: { title: "Title", aliases: ["mahinda", "mr"], indexed: true } });
    });

    it("keeps indexed false and drops empty text", () => {
        expect(parseSeoInput({ title: "", description: "  ", indexed: false })).toEqual({
            ok: true,
            seo: { aliases: [], indexed: false },
        });
    });

    it("reports invalid aliases and over-long text", () => {
        const result = parseSeoInput({ title: "x".repeat(71), aliases: ["new"] });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.title).toBe("length");
            expect(result.errors["alias:new"]).toBe("reserved");
        }
    });
});

describe("chart image versioning", () => {
    const key = "charts/6b02fe695a6cb6eef9fc90a5/birth-1764000000000.png";

    it("reads the render timestamp from the image key", () => {
        expect(chartImageVersion(key)).toBe("1764000000000");
        expect(chartImageVersion("charts/x/birth")).toBeNull();
        expect(chartImageVersion(undefined)).toBeNull();
    });

    it("caches a matching versioned URL immutably, everything else briefly", () => {
        expect(chartImageCacheControl("1764000000000", key, true)).toBe("public, max-age=31536000, immutable");
        expect(chartImageCacheControl("1764000000000", key, false)).toBe("private, max-age=31536000, immutable");
        expect(chartImageCacheControl("1", key, true)).toBe("public, max-age=300");
        expect(chartImageCacheControl(null, key, true)).toBe("public, max-age=300");
    });
});
