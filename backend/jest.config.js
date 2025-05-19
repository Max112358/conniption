// backend/jest.config.js
module.exports = {
  // Set test environment
  testEnvironment: "node",

  // Collect coverage from these directories
  collectCoverageFrom: [
    "models/**/*.js",
    "routes/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],

  // Configure coverage thresholds
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },

  // Set up test files pattern
  testMatch: ["**/__tests__/**/*.js", "**/*.test.js"],

  // Setup files to run before tests
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],

  // Configure test timeouts
  testTimeout: 10000,
};
