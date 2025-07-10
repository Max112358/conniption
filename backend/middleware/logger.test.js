// backend/middleware/logger.test.js
const logger = require("./logger");

describe("Logger Middleware", () => {
  let req, res, next;
  let originalConsoleLog;

  beforeEach(() => {
    req = {
      method: "GET",
      url: "/api/boards",
      headers: {
        "user-agent": "test-agent",
        "content-type": "application/json",
      },
      is: jest.fn(),
    };
    res = {
      statusCode: 200,
      end: jest.fn(),
    };
    next = jest.fn();

    // Mock console.log
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it("should log GET request details", () => {
    logger(req, res, next);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("["));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("GET /api/boards")
    );
    expect(console.log).toHaveBeenCalledWith(
      "Request Headers:",
      expect.any(String)
    );
    expect(next).toHaveBeenCalled();
  });

  it("should sanitize authorization headers", () => {
    req.headers.authorization = "Bearer secret-token";

    logger(req, res, next);

    const headerCallArgs = console.log.mock.calls.find(
      (call) => call[0] === "Request Headers:"
    );
    expect(headerCallArgs[1]).toContain("[REDACTED]");
    expect(headerCallArgs[1]).not.toContain("secret-token");
  });

  it("should log POST request body", () => {
    req.method = "POST";
    req.body = { test: "data" };
    req.is.mockReturnValue(false); // Not multipart

    logger(req, res, next);

    expect(console.log).toHaveBeenCalledWith(
      "Request Body:",
      expect.stringContaining('"test": "data"') // Note the spaces in JSON.stringify output
    );
  });

  it("should not log multipart form data body", () => {
    req.method = "POST";
    req.body = { test: "data" };
    req.is.mockReturnValue(true); // Is multipart

    logger(req, res, next);

    expect(console.log).toHaveBeenCalledWith(
      "Request contains file upload (body not logged)"
    );
    expect(console.log).not.toHaveBeenCalledWith(
      "Request Body:",
      expect.any(String)
    );
  });

  it("should log response when res.end is called", () => {
    const originalEnd = res.end;

    logger(req, res, next);

    // Simulate response end
    res.end();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Response: 200")
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ms)"));
  });

  it("should preserve original res.end functionality", () => {
    const chunk = "response data";
    const encoding = "utf8";
    const originalEnd = res.end;

    logger(req, res, next);

    res.end(chunk, encoding);

    // The original end should have been called
    expect(originalEnd).toHaveBeenCalledWith(chunk, encoding);
  });

  it("should handle requests without authorization header", () => {
    delete req.headers.authorization;

    logger(req, res, next);

    const headerCallArgs = console.log.mock.calls.find(
      (call) => call[0] === "Request Headers:"
    );
    expect(headerCallArgs[1]).not.toContain("[REDACTED]");
    expect(next).toHaveBeenCalled();
  });

  it("should handle non-POST requests", () => {
    req.method = "PUT";
    req.body = { test: "data" };

    logger(req, res, next);

    expect(console.log).not.toHaveBeenCalledWith(
      "Request Body:",
      expect.any(String)
    );
    expect(next).toHaveBeenCalled();
  });
});
