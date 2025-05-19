// backend/test/setup.js
// Setup environment variables for testing
process.env.NODE_ENV = "test";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://test.r2.dev";
process.env.DATABASE_URL = "postgres://fake:fake@localhost:5432/test_db";
process.env.SESSION_SECRET = "test-session-secret";

// Mock Socket.io
jest.mock("socket.io", () => {
  const mockOn = jest.fn();
  const mockEmit = jest.fn();
  const mockJoin = jest.fn();
  const mockLeave = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

  return jest.fn().mockImplementation(() => ({
    on: mockOn,
    emit: mockEmit,
    to: mockTo,
  }));
});

// Global teardown after each test
afterEach(() => {
  jest.clearAllMocks();
});
