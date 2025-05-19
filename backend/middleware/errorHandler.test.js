// backend/middleware/errorHandler.test.js
const errorHandler = require("./errorHandler");

describe("Error Handler Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Mock request, response, and next function
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("should handle errors with status code", () => {
    // Create error with status code
    const error = new Error("Test error");
    error.statusCode = 400;

    // Call the middleware
    errorHandler(error, req, res, next);

    // Verify response
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Test error",
      })
    );
  });

  it("should default to 500 status code", () => {
    // Create error without status code
    const error = new Error("Server error");

    // Call the middleware
    errorHandler(error, req, res, next);

    // Verify response
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Server error",
      })
    );
  });

  it("should include error details in development", () => {
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;

    // Set environment to development
    process.env.NODE_ENV = "development";

    // Create error with stack and details
    const error = new Error("Detailed error");
    error.stack = "Error stack trace";
    error.details = { field: "Invalid field" };

    // Call the middleware
    errorHandler(error, req, res, next);

    // Verify response includes details
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Detailed error",
        stack: "Error stack trace",
        details: { field: "Invalid field" },
      })
    );

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  it("should not include error details in production", () => {
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;

    // Set environment to production
    process.env.NODE_ENV = "production";

    // Create error with stack and details
    const error = new Error("Production error");
    error.stack = "Error stack trace";
    error.details = { sensitive: "Should not be included" };

    // Call the middleware
    errorHandler(error, req, res, next);

    // Verify response excludes details
    expect(res.json).toHaveBeenCalledWith({
      error: "Production error",
    });

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });
});
