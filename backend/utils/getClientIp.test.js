// backend/utils/getClientIp.test.js
const getClientIp = require("./getClientIp");

describe("getClientIp", () => {
  let req;

  beforeEach(() => {
    req = {
      headers: {},
      connection: {},
    };
    // Mock console.log to avoid test output
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it("should prioritize cf-connecting-ip header", () => {
    req.headers["cf-connecting-ip"] = "1.1.1.1";
    req.headers["x-forwarded-for"] = "2.2.2.2";
    req.ip = "3.3.3.3";

    const ip = getClientIp(req);
    expect(ip).toBe("1.1.1.1");
  });

  it("should use true-client-ip when cf-connecting-ip not available", () => {
    req.headers["true-client-ip"] = "2.2.2.2";
    req.headers["x-forwarded-for"] = "3.3.3.3";
    req.ip = "4.4.4.4";

    const ip = getClientIp(req);
    expect(ip).toBe("2.2.2.2");
  });

  it("should use x-real-ip when higher priority headers not available", () => {
    req.headers["x-real-ip"] = "3.3.3.3";
    req.headers["x-forwarded-for"] = "4.4.4.4";
    req.ip = "5.5.5.5";

    const ip = getClientIp(req);
    expect(ip).toBe("3.3.3.3");
  });

  it("should parse first IP from x-forwarded-for", () => {
    req.headers["x-forwarded-for"] = "1.1.1.1, 2.2.2.2, 3.3.3.3";
    req.ip = "4.4.4.4";

    const ip = getClientIp(req);
    expect(ip).toBe("1.1.1.1");
  });

  it("should handle x-forwarded-for with spaces", () => {
    req.headers["x-forwarded-for"] = "  1.1.1.1  ,  2.2.2.2  ";

    const ip = getClientIp(req);
    expect(ip).toBe("1.1.1.1");
  });

  it("should use req.ip when no headers available", () => {
    req.ip = "::ffff:192.168.1.1";

    const ip = getClientIp(req);
    expect(ip).toBe("192.168.1.1");
  });

  it("should remove IPv6 prefix from req.ip", () => {
    req.ip = "::ffff:10.0.0.1";

    const ip = getClientIp(req);
    expect(ip).toBe("10.0.0.1");
  });

  it("should use connection.remoteAddress as fallback", () => {
    req.connection.remoteAddress = "::ffff:172.16.0.1";

    const ip = getClientIp(req);
    expect(ip).toBe("172.16.0.1");
  });

  it("should return unknown when no IP found", () => {
    const ip = getClientIp(req);
    expect(ip).toBe("unknown");
  });
});
