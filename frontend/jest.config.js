// frontend/jest.config.js
module.exports = {
  // Use React Testing Library's jest-dom extensions
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],

  // Collect coverage from these directories
  collectCoverageFrom: [
    "src/**/*.{js,jsx}",
    "!src/**/*.{spec,test}.{js,jsx}",
    "!src/index.js",
    "!src/reportWebVitals.js",
    "!src/setupTests.js",
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

  // Transform files with babel-jest
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest",
  },

  // Mock static assets
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/src/__mocks__/fileMock.js",
  },

  // Set test environment
  testEnvironment: "jsdom",
};
