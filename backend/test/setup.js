// backend/test/setup.js
// Setup environment variables for testing
process.env.NODE_ENV = "test";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://test.r2.dev";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db";
process.env.SESSION_SECRET = "test-session-secret";
process.env.THREAD_ID_SECRET = "test-thread-secret";
process.env.FRONTEND_DOMAINS =
  "https://conniption.pages.dev,https://conniption.xyz";

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock request object
  createMockRequest: (overrides = {}) => ({
    params: {},
    query: {},
    body: {},
    headers: {},
    session: {},
    ip: "127.0.0.1",
    ...overrides,
  }),

  // Helper to create mock response object
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  },

  // Helper to create mock next function
  createMockNext: () => jest.fn(),

  // Helper to wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
