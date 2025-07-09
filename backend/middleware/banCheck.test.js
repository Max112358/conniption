// backend/middleware/banCheck.test.js
const checkBannedIP = require("./banCheck");
const banModel = require("../models/ban");
const rangebanModel = require("../models/rangeban");
const getClientIp = require("../utils/getClientIp");
const { getCountryCode, getCountryName } = require("../utils/countryLookup");

// Mock the dependencies
jest.mock("../models/ban");
jest.mock("../models/rangeban");
jest.mock("../utils/getClientIp");
jest.mock("../utils/countryLookup");

describe("Ban Check Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Mock request, response, and next function
    req = {
      params: {
        boardId: "tech",
      },
      path: "/threads",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Default mock implementations
    getClientIp.mockReturnValue("192.168.1.1");
    getCountryCode.mockReturnValue("US");
    getCountryName.mockReturnValue("United States");

    // Reset mocks
    jest.clearAllMocks();
  });

  it("should call next() if path includes /appeal", async () => {
    // Set path to include /appeal
    req.path = "/appeal/123";

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify banModel was not called and next() was called
    expect(banModel.checkIpBanned).not.toHaveBeenCalled();
    expect(rangebanModel.checkCountryBanned).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should call next() when IP is not banned", async () => {
    // Mock not banned
    banModel.checkIpBanned.mockResolvedValue(null);
    rangebanModel.checkCountryBanned.mockResolvedValue(null);

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify banModel was called with correct params
    expect(banModel.checkIpBanned).toHaveBeenCalledWith("192.168.1.1", "tech");
    expect(rangebanModel.checkCountryBanned).toHaveBeenCalledWith("US", "tech");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 403 when IP is banned permanently", async () => {
    // Mock permanent ban
    banModel.checkIpBanned.mockResolvedValue({
      id: 1,
      reason: "Violation of rules",
      expires_at: null,
      appeal_status: "none",
      board_id: "tech",
      post_content: "Banned content",
      post_image_url: null,
      thread_id: 123,
      post_id: 456,
    });

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify response
    expect(banModel.checkIpBanned).toHaveBeenCalledWith("192.168.1.1", "tech");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Banned",
        message: expect.stringContaining("permanently"),
        ban: expect.objectContaining({
          id: 1,
          reason: "Violation of rules",
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 with expiration date when IP is banned temporarily", async () => {
    // Mock temporary ban
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days from now

    banModel.checkIpBanned.mockResolvedValue({
      id: 2,
      reason: "Temporary violation",
      expires_at: expirationDate.toISOString(),
      appeal_status: "none",
      board_id: "tech",
      post_content: null,
      post_image_url: null,
      thread_id: null,
      post_id: null,
    });

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify response
    expect(banModel.checkIpBanned).toHaveBeenCalledWith("192.168.1.1", "tech");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Banned",
        message: expect.stringContaining("until"),
        ban: expect.objectContaining({
          id: 2,
          reason: "Temporary violation",
          expires_at: expect.any(String),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 when country is rangebanned", async () => {
    // Mock no IP ban but country ban
    banModel.checkIpBanned.mockResolvedValue(null);
    rangebanModel.checkCountryBanned.mockResolvedValue({
      ban_type: "country",
      ban_value: "US",
      reason: "Country blocked due to spam",
      expires_at: null,
      board_id: "tech",
    });

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify response
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Country Rangebanned",
        message: expect.stringContaining("United States is range banned"),
        rangeban: expect.objectContaining({
          type: "country",
          value: "US",
          country_name: "United States",
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should skip country ban check for local IPs", async () => {
    // Mock local IP
    getCountryCode.mockReturnValue("LO");

    banModel.checkIpBanned.mockResolvedValue(null);

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify rangeban check was not called for local IP
    expect(rangebanModel.checkCountryBanned).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should return 403 with global ban message", async () => {
    // Mock global country ban (no board_id)
    banModel.checkIpBanned.mockResolvedValue(null);
    rangebanModel.checkCountryBanned.mockResolvedValue({
      ban_type: "country",
      ban_value: "CN",
      reason: "Global ban",
      expires_at: null,
      board_id: null, // Global ban
    });
    getCountryCode.mockReturnValue("CN");
    getCountryName.mockReturnValue("China");

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify response mentions "this site" for global ban
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("not allowed to post on this site"),
      })
    );
  });

  it("should return 403 with board-specific ban message", async () => {
    // Mock board-specific country ban
    banModel.checkIpBanned.mockResolvedValue(null);
    rangebanModel.checkCountryBanned.mockResolvedValue({
      ban_type: "country",
      ban_value: "RU",
      reason: "Board-specific ban",
      expires_at: null,
      board_id: "tech", // Board-specific ban
    });
    getCountryCode.mockReturnValue("RU");
    getCountryName.mockReturnValue("Russia");

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify response mentions "this board" for board-specific ban
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("not allowed to post on this board"),
      })
    );
  });

  it("should call next() when ban check throws an error", async () => {
    // Mock error
    banModel.checkIpBanned.mockRejectedValue(new Error("Database error"));

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify next was called despite error
    expect(banModel.checkIpBanned).toHaveBeenCalledWith("192.168.1.1", "tech");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should handle rangeban check error gracefully", async () => {
    // Mock successful IP check but rangeban error
    banModel.checkIpBanned.mockResolvedValue(null);
    rangebanModel.checkCountryBanned.mockRejectedValue(
      new Error("Rangeban check error")
    );

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify next was called despite error
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should handle missing country code", async () => {
    // Mock no country code
    getCountryCode.mockReturnValue(null);
    banModel.checkIpBanned.mockResolvedValue(null);

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify rangeban check was not called
    expect(rangebanModel.checkCountryBanned).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
