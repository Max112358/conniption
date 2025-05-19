// backend/middleware/banCheck.test.js
const checkBannedIP = require("./banCheck");
const banModel = require("../models/ban");

// Mock the ban model
jest.mock("../models/ban");

describe("Ban Check Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Mock request, response, and next function
    req = {
      ip: "192.168.1.1",
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
    expect(next).toHaveBeenCalled();
  });

  it("should call next() when IP is not banned", async () => {
    // Mock not banned
    banModel.checkIpBanned.mockResolvedValue(null);

    // Call middleware
    await checkBannedIP(req, res, next);

    // Verify banModel was called with correct params
    expect(banModel.checkIpBanned).toHaveBeenCalledWith("192.168.1.1", "tech");
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
});
