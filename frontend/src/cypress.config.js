// frontend/cypress.config.js
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },

  viewportWidth: 1280,
  viewportHeight: 720,

  // Configuration for video recording
  video: true,

  // Increase timeout for slow operations
  defaultCommandTimeout: 10000,

  // Configure retries for flaky tests
  retries: {
    runMode: 2,
    openMode: 0,
  },
});
