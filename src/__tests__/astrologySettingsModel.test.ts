import { AstrologySettings } from "@/models/AstrologySettings";

describe("AstrologySettings model", () => {
    test("uses a string _id singleton key so 'system' does not cast to ObjectId", () => {
        const idPath = AstrologySettings.schema.path("_id");
        expect(idPath.instance).toBe("String");
        expect(AstrologySettings.schema.get("versionKey")).toBe(false);
    });

    test("string ids round-trip through casting", () => {
        const cast = AstrologySettings.schema.path("_id").cast("system");
        expect(cast).toBe("system");
    });
});
