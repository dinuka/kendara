import { buildNameSearchPattern, validateCoordinate } from "@/lib/location";

jest.mock("@/lib/db", () => ({
    connectDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/logger", () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock("mongoose", () => {
    const mongooseModels: Record<string, { schema: MockSchema; name: string }> = {};

    class MockSchema {
        private _paths: Record<string, unknown> = {};
        private _options: Record<string, unknown>;

        constructor(def: Record<string, unknown>, opts?: Record<string, unknown>) {
            this._options = opts || {};
            for (const [key, val] of Object.entries(def)) {
                if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                    for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
                        this._paths[`${key}.${subKey}`] =
                            typeof subVal === "object" && subVal !== null ? subVal : { type: subVal };
                    }
                } else {
                    this._paths[key] = typeof val === "object" && val !== null ? val : { type: val };
                }
            }
        }

        path(name: string) {
            return this._paths[name] || null;
        }

        index() {}
    }

    const mMongoose = {
        connect: jest.fn().mockResolvedValue(undefined),
        connection: { db: null, readyState: 1 },
        Schema: MockSchema,
        model: jest.fn((name: string, schema?: MockSchema) => {
            if (!mongooseModels[name]) {
                mongooseModels[name] = { schema: schema || new MockSchema({}), name };
            }
            return mongooseModels[name];
        }),
        get models() {
            return mongooseModels;
        },
        Document: class MockDocument {
            _doc: Record<string, unknown>;
            constructor(doc: Record<string, unknown>) {
                this._doc = doc;
            }
            save() {
                return Promise.resolve(this);
            }
            toObject() {
                return this._doc;
            }
        },
    };
    return mMongoose;
});

describe("validateCoordinate", () => {
    test("valid coordinates", () => {
        expect(validateCoordinate(6.9271, 79.8612)).toEqual({ valid: true });
    });

    test("boundary values: lat 90, lon 180", () => {
        expect(validateCoordinate(90, 180)).toEqual({ valid: true });
    });

    test("boundary values: lat -90, lon -180", () => {
        expect(validateCoordinate(-90, -180)).toEqual({ valid: true });
    });

    test("boundary values: lat 0, lon 0", () => {
        expect(validateCoordinate(0, 0)).toEqual({ valid: true });
    });

    test("lat too high", () => {
        const result = validateCoordinate(91, 0);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Latitude");
    });

    test("lat too low", () => {
        const result = validateCoordinate(-91, 0);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Latitude");
    });

    test("lon too high", () => {
        const result = validateCoordinate(0, 181);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Longitude");
    });

    test("lon too low", () => {
        const result = validateCoordinate(0, -181);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Longitude");
    });

    test("both out of range", () => {
        const result = validateCoordinate(100, 200);
        expect(result.valid).toBe(false);
    });
});

describe("buildNameSearchPattern", () => {
    const matches = (search: string, name: string) => new RegExp(buildNameSearchPattern(search), "i").test(name);

    test.each([
        ["Mathara", "Matara"],
        ["matara", "Matara"],
        ["Rathnapura", "Ratnapura"],
        ["Kaluthara", "Kalutara"],
        ["Hikaduwa", "Hikkaduwa"],
        ["Kote", "Sri Jayewardenepura Kotte"],
        ["ja ela", "Ja-ela"],
        ["Hambantota", "Hambantota"],
        ["nuwara", "Nuwara Eliya"],
    ])("%s matches %s", (search, name) => {
        expect(matches(search, name)).toBe(true);
    });

    test("does not match unrelated names", () => {
        expect(matches("Matara", "Matale")).toBe(false);
        expect(matches("Galle", "Kegalle Town")).toBe(true);
        expect(matches("Galle", "Gampaha")).toBe(false);
    });

    test("escapes regex metacharacters", () => {
        expect(() => new RegExp(buildNameSearchPattern("a(b[c"))).not.toThrow();
        expect(matches("(", "Kandy")).toBe(false);
    });
});
