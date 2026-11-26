/**
 * SSO sign-in resolution (Google + Facebook) — src/lib/authUser.ts.
 */
import { User } from "@/models/User";

import { resolveSsoUser } from "@/lib/authUser";

jest.mock("@/models/User", () => ({
    User: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));
jest.mock("@/lib/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFindOne = User.findOne as jest.Mock;
const mockUpdateOne = User.updateOne as jest.Mock;
const mockCreate = User.create as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockFindOne.mockResolvedValue(null);
});

describe("resolveSsoUser", () => {
    test("creates a new student user keyed on googleId for a first Google sign-in", async () => {
        const ok = await resolveSsoUser({
            provider: "google",
            providerAccountId: "g-1",
            email: "a@example.com",
            name: "A",
        });
        expect(ok).toBe(true);
        expect(mockFindOne).toHaveBeenCalledWith({ googleId: "g-1" });
        expect(mockCreate).toHaveBeenCalledWith({
            googleId: "g-1",
            email: "a@example.com",
            name: "A",
            role: "student",
            preferredLanguage: "si",
        });
    });

    test("creates a new student user keyed on facebookId for a first Facebook sign-in", async () => {
        const ok = await resolveSsoUser({
            provider: "facebook",
            providerAccountId: "fb-1",
            email: "b@example.com",
            name: "B",
        });
        expect(ok).toBe(true);
        expect(mockFindOne).toHaveBeenCalledWith({ facebookId: "fb-1" });
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ facebookId: "fb-1", role: "student" }));
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("googleId");
    });

    test("returning user does not create or update", async () => {
        mockFindOne.mockResolvedValueOnce({ _id: "u1" });
        const ok = await resolveSsoUser({ provider: "facebook", providerAccountId: "fb-1", email: "b@example.com" });
        expect(ok).toBe(true);
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    test("links Facebook onto an existing Google user with the same email", async () => {
        mockFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "u1", googleId: "g-1" });
        const ok = await resolveSsoUser({ provider: "facebook", providerAccountId: "fb-1", email: "a@example.com" });
        expect(ok).toBe(true);
        expect(mockFindOne).toHaveBeenNthCalledWith(2, { email: "a@example.com" });
        expect(mockUpdateOne).toHaveBeenCalledWith({ _id: "u1" }, { $set: { facebookId: "fb-1" } });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    test("rejects a sign-in without an email (e.g. phone-only Facebook account)", async () => {
        const ok = await resolveSsoUser({ provider: "facebook", providerAccountId: "fb-2", email: null });
        expect(ok).toBe(false);
        expect(mockFindOne).not.toHaveBeenCalled();
    });

    test("rejects unknown providers", async () => {
        const ok = await resolveSsoUser({ provider: "github", providerAccountId: "x", email: "a@example.com" });
        expect(ok).toBe(false);
    });

    test("falls back to the email as name when the provider gives none", async () => {
        await resolveSsoUser({ provider: "facebook", providerAccountId: "fb-3", email: "c@example.com", name: null });
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "c@example.com" }));
    });
});
