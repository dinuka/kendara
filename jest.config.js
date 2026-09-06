module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^uuid$": "<rootDir>/src/__tests__/__mocks__/uuid.ts",
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
};
