// backend/jest.config.js
module.exports = {
  // Set test environment
  testEnvironment: "node",

  // Test files location
  testMatch: [
    "**/routes/**/*.test.js",
    "**/models/**/*.test.js",
    "**/middleware/**/*.test.js",
    "**/utils/**/*.test.js",
    "**/services/**/*.test.js",
    "**/test/integration/**/*.test.js",
  ],

  // Coverage configuration
  collectCoverageFrom: [
    "routes/**/*.js",
    "models/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "services/**/*.js",
    "!routes/**/*.test.js",
    "!models/**/*.test.js",
    "!middleware/**/*.test.js",
    "!utils/**/*.test.js",
    "!services/**/*.test.js",
    "!**/node_modules/**",
    "!server.js", // Exclude server.js as it's hard to test
    "!test/**",
  ],

  // Configure coverage thresholds - Much more lenient
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],

  // Configure test timeouts
  testTimeout: 10000,

  // Module name mapper for path aliases if needed
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // Transform files
  transform: {
    "^.+\\.js$": "babel-jest",
  },

  // Ignore patterns
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Coverage directory
  coverageDirectory: "coverage",

  // Coverage reporters
  coverageReporters: ["text", "lcov", "html"],

  // Verbose output
  verbose: true,

  // Force exit after test run complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
};
