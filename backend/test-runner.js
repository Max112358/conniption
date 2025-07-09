// backend/test-runner.js
/**
 * Test runner utility for the Conniption backend
 * This script helps run specific test suites or individual test files
 */

const { spawn } = require("child_process");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  red: "\x1b[31m",
};

// Test configurations
const testConfigs = {
  unit: {
    name: "Unit Tests",
    pattern: "--testPathIgnorePatterns=test/integration",
  },
  integration: {
    name: "Integration Tests",
    pattern: "test/integration",
  },
  models: {
    name: "Model Tests",
    pattern: "models/*.test.js",
  },
  routes: {
    name: "Route Tests",
    pattern: "routes/**/*.test.js",
  },
  middleware: {
    name: "Middleware Tests",
    pattern: "middleware/*.test.js",
  },
  utils: {
    name: "Utility Tests",
    pattern: "utils/*.test.js",
  },
  failed: {
    name: "Failed Tests Only",
    pattern: "--onlyFailures",
  },
};

// Help message
const showHelp = () => {
  console.log(`
${colors.bright}Conniption Backend Test Runner${colors.reset}

${colors.blue}Usage:${colors.reset}
  node test-runner.js [command] [options]

${colors.blue}Commands:${colors.reset}
  all         Run all tests
  unit        Run unit tests only
  integration Run integration tests only
  models      Run model tests
  routes      Run route tests
  middleware  Run middleware tests
  utils       Run utility tests
  failed      Run only previously failed tests
  watch       Run tests in watch mode
  coverage    Run tests with coverage report
  file <path> Run a specific test file
  help        Show this help message

${colors.blue}Examples:${colors.reset}
  node test-runner.js unit
  node test-runner.js file models/thread.test.js
  node test-runner.js watch
  node test-runner.js coverage

${colors.blue}NPM Scripts (alternative):${colors.reset}
  npm test              Run all tests
  npm run test:unit     Run unit tests
  npm run test:watch    Run in watch mode
  npm run test:coverage Run with coverage
`);
};

// Run tests with specified configuration
const runTests = (args) => {
  const jestPath = path.join(__dirname, "node_modules", ".bin", "jest");
  const jest = spawn("node", [jestPath, ...args], {
    stdio: "inherit",
    shell: true,
  });

  jest.on("close", (code) => {
    process.exit(code);
  });
};

// Main execution
switch (command) {
  case "help":
  case undefined:
    showHelp();
    break;

  case "all":
    console.log(`${colors.green}Running all tests...${colors.reset}`);
    runTests([]);
    break;

  case "unit":
  case "integration":
  case "models":
  case "routes":
  case "middleware":
  case "utils":
  case "failed":
    const config = testConfigs[command];
    console.log(`${colors.green}Running ${config.name}...${colors.reset}`);
    runTests([config.pattern]);
    break;

  case "watch":
    console.log(
      `${colors.yellow}Running tests in watch mode...${colors.reset}`
    );
    runTests(["--watch"]);
    break;

  case "coverage":
    console.log(`${colors.blue}Running tests with coverage...${colors.reset}`);
    runTests(["--coverage"]);
    break;

  case "file":
    if (!args[1]) {
      console.error(
        `${colors.red}Error: Please specify a test file path${colors.reset}`
      );
      console.log("Example: node test-runner.js file models/thread.test.js");
      process.exit(1);
    }
    console.log(`${colors.green}Running test file: ${args[1]}${colors.reset}`);
    runTests([args[1]]);
    break;

  default:
    console.error(`${colors.red}Unknown command: ${command}${colors.reset}`);
    showHelp();
    process.exit(1);
}
