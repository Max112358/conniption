// backend/utils/countryLookup.test.js
const { getCountryCode, getCountryName } = require("./countryLookup");
const geoip = require("geoip-lite");

// Mock geoip-lite
jest.mock("geoip-lite", () => ({
  lookup: jest.fn(),
}));

describe("Country Lookup Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log to reduce test output
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe("getCountryCode", () => {
    it("should return country code for valid IP", () => {
      geoip.lookup.mockReturnValue({ country: "US" });

      const result = getCountryCode("8.8.8.8");

      expect(result).toBe("US");
      expect(geoip.lookup).toHaveBeenCalledWith("8.8.8.8");
    });

    it("should return null for invalid IP", () => {
      geoip.lookup.mockReturnValue(null);

      const result = getCountryCode("invalid-ip");

      expect(result).toBeNull();
      expect(geoip.lookup).toHaveBeenCalledWith("invalid-ip");
    });

    it("should return null for no IP provided", () => {
      const result = getCountryCode("");

      expect(result).toBeNull();
      expect(geoip.lookup).not.toHaveBeenCalled();
    });

    it("should return null for unknown IP", () => {
      const result = getCountryCode("unknown");

      expect(result).toBeNull();
      expect(geoip.lookup).not.toHaveBeenCalled();
    });

    it("should return LO for localhost IPv4", () => {
      const result = getCountryCode("127.0.0.1");

      expect(result).toBe("LO");
      expect(geoip.lookup).not.toHaveBeenCalled();
    });

    it("should return LO for localhost IPv6", () => {
      const result = getCountryCode("::1");

      expect(result).toBe("LO");
      expect(geoip.lookup).not.toHaveBeenCalled();
    });

    it("should return LO for private IP ranges", () => {
      expect(getCountryCode("192.168.1.1")).toBe("LO");
      expect(getCountryCode("10.0.0.1")).toBe("LO");
      expect(getCountryCode("172.16.0.1")).toBe("LO");
    });

    it("should return LO for IPv6 private ranges", () => {
      expect(getCountryCode("fc00::1")).toBe("LO");
      expect(getCountryCode("fd00::1")).toBe("LO");
      expect(getCountryCode("fe80::1")).toBe("LO");
    });

    it("should return CF for Cloudflare IPs", () => {
      expect(getCountryCode("173.245.48.1")).toBe("CF");
      expect(getCountryCode("103.21.244.1")).toBe("CF");
    });

    it("should handle geoip lookup errors", () => {
      geoip.lookup.mockImplementation(() => {
        throw new Error("GeoIP error");
      });

      const result = getCountryCode("8.8.8.8");

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Country lookup error:",
        expect.any(Error)
      );
    });
  });

  describe("getCountryName", () => {
    it("should return country name for valid country code", () => {
      expect(getCountryName("US")).toBe("United States");
      expect(getCountryName("GB")).toBe("United Kingdom");
      expect(getCountryName("CA")).toBe("Canada");
      expect(getCountryName("DE")).toBe("Germany");
      expect(getCountryName("FR")).toBe("France");
    });

    it("should return special names for special codes", () => {
      expect(getCountryName("LO")).toBe("Local Network");
      expect(getCountryName("CF")).toBe("Cloudflare (Proxy)");
    });

    it("should return Unknown for invalid country code", () => {
      expect(getCountryName("XX")).toBe("Unknown");
      expect(getCountryName("ZZ")).toBe("Unknown");
      expect(getCountryName("")).toBe("Unknown");
    });

    it("should handle null/undefined country codes", () => {
      expect(getCountryName(null)).toBe("Unknown");
      expect(getCountryName(undefined)).toBe("Unknown");
    });

    it("should be case sensitive", () => {
      expect(getCountryName("us")).toBe("Unknown"); // lowercase
      expect(getCountryName("US")).toBe("United States"); // uppercase
    });
  });
});
