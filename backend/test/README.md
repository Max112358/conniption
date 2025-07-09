// backend/test/README.md

# Backend Test Suite

This directory contains comprehensive tests for the Conniption imageboard backend.

## Test Structure

```
test/
├── setup.js                    # Global test setup
├── integration/               # Integration tests
│   ├── api.test.js           # API flow tests
│   └── ban-flow.test.js      # Ban system tests
├── utils/                     # Test utilities
│   ├── db-test-utils.js      # Database test helpers
│   └── socket-test-utils.js  # Socket.io test helpers
└── README.md                  # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Update snapshots
npm run test:updateSnapshot
```

## Test Categories

### Unit Tests

- **Routes**: Test route handlers in isolation
- **Models**: Test database models with mocked pool
- **Middleware**: Test middleware functions
- **Utils**: Test utility functions
- **Services**: Test service layer

### Integration Tests

- **API Flow**: Test complete user flows
- **Ban System**: Test ban and appeal workflows
- **Socket.io**: Test real-time features

## Writing Tests

### Basic Test Structure

```javascript
describe("Component Name", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it("should do something", async () => {
    // Arrange
    const input = "test";

    // Act
    const result = await functionToTest(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Using Test Utilities

```javascript
const { createMockRequest, createMockResponse } = global.testUtils;

it("should handle request", async () => {
  const req = createMockRequest({
    params: { boardId: "tech" },
    body: { content: "test" },
  });
  const res = createMockResponse();
  const next = jest.fn();

  await middleware(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
});
```

## Mocking Guidelines

### Database

Always mock the pool for unit tests:

```javascript
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
```

### External Services

Mock all external services:

```javascript
jest.mock("../config/r2", () => ({
  s3Client: { send: jest.fn() },
  R2_BUCKET_NAME: "test-bucket",
  R2_PUBLIC_URL: "https://test.r2.dev",
}));
```

### Socket.io

Mock Socket.io for non-socket tests:

```javascript
jest.mock("../utils/socketHandler", () => ({
  getIo: () => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));
```

## Coverage Goals

We aim for:

- 80% statement coverage
- 70% branch coverage
- 80% function coverage
- 80% line coverage

## Best Practices

1. **Test behavior, not implementation**
2. **Use descriptive test names**
3. **Keep tests focused and isolated**
4. **Mock external dependencies**
5. **Test both success and error paths**
6. **Use async/await for async tests**
7. **Clean up after tests**

## Debugging

To debug a specific test:

```bash
# Run specific test file
npm test -- routes/boards.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create"

# Run with node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD Integration

Tests are automatically run on:

- Pull requests
- Commits to main branch
- Pre-deployment

Failed tests will block deployment.
