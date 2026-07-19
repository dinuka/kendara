import { parseCsvCoordinate } from "@/lib/csvParser";
import { validateCoordinate } from "@/lib/location";

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
    const mongooseModels: Record<string, any> = {};

    class MockSchema {
        private _paths: Record<string, any> = {};
        private _options: Record<string, any>;

        constructor(def: Record<string, any>, opts?: Record<string, any>) {
            this._options = opts || {};
            for (const [key, val] of Object.entries(def)) {
                if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                    for (const [subKey, subVal] of Object.entries(val as Record<string, any>)) {
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
        model: jest.fn((name: string, schema?: any) => {
            if (!mongooseModels[name]) {
                mongooseModels[name] = { schema: schema || new MockSchema({}), name };
            }
            return mongooseModels[name];
        }),
        get models() {
            return mongooseModels;
        },
        Document: class MockDocument {
            _doc: any;
            constructor(doc: any) {
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

describe("parseCsvCoordinate", () => {
    test("valid input: standard coordinates", () => {
        const result = parseCsvCoordinate("6.9271,79.8612");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(6.9271, 4);
            expect(result.longitude).toBeCloseTo(79.8612, 4);
        }
    });

    test("valid input: negative coordinates", () => {
        const result = parseCsvCoordinate("-33.8688,151.2093");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(-33.8688, 4);
            expect(result.longitude).toBeCloseTo(151.2093, 4);
        }
    });

    test("valid input: both negative", () => {
        const result = parseCsvCoordinate("-90.0,-180.0");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(-90, 1);
            expect(result.longitude).toBeCloseTo(-180, 1);
        }
    });

    test("valid input: boundary values", () => {
        const result = parseCsvCoordinate("90.0,180.0");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(90, 1);
            expect(result.longitude).toBeCloseTo(180, 1);
        }
    });

    test("valid input: with whitespace", () => {
        const result = parseCsvCoordinate("  6.9271,79.8612  ");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(6.9271, 4);
            expect(result.longitude).toBeCloseTo(79.8612, 4);
        }
    });

    test("invalid input: missing longitude", () => {
        const result = parseCsvCoordinate("6.9271");
        expect(result).toBeInstanceOf(Error);
    });

    test("invalid input: non-numeric", () => {
        const result = parseCsvCoordinate("abc,def");
        expect(result).toBeInstanceOf(Error);
    });

    test("invalid input: lat out of range", () => {
        const result = parseCsvCoordinate("91.0,79.0");
        expect(result).toBeInstanceOf(Error);
        if (result instanceof Error) {
            expect(result.message).toContain("Latitude must be between -90 and 90");
        }
    });

    test("invalid input: lon out of range", () => {
        const result = parseCsvCoordinate("6.9271,181.0");
        expect(result).toBeInstanceOf(Error);
        if (result instanceof Error) {
            expect(result.message).toContain("Longitude must be between -180 and 180");
        }
    });

    test("invalid input: whitespace only", () => {
        const result = parseCsvCoordinate("   ");
        expect(result).toBeInstanceOf(Error);
    });

    test("invalid input: empty string", () => {
        const result = parseCsvCoordinate("");
        expect(result).toBeInstanceOf(Error);
    });

    test("invalid input: extra commas", () => {
        const result = parseCsvCoordinate("6.9271,79.8612,90.0");
        expect(result).toBeInstanceOf(Error);
    });

    test("valid input: integer values", () => {
        const result = parseCsvCoordinate("0,0");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBe(0);
            expect(result.longitude).toBe(0);
        }
    });

    test("valid input: negative lat, positive lon", () => {
        const result = parseCsvCoordinate("-90.0,180.0");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(-90, 1);
            expect(result.longitude).toBeCloseTo(180, 1);
        }
    });

    test("valid input: positive lat, negative lon", () => {
        const result = parseCsvCoordinate("90.0,-180.0");
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) {
            expect(result.latitude).toBeCloseTo(90, 1);
            expect(result.longitude).toBeCloseTo(-180, 1);
        }
    });
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
