// backend/middleware/adminAuth.test.js
const {
  requireAuth,
  requireAdmin,
  requireModerator,
  canModerateBoard,
  checkBanned,
  enforceBan,
} = require("./adminAuth");
const getClientIp = require("../utils/getClientIp");
const banModel = require("../models/ban");

// Mock dependencies
jest.mock("../utils/getClientIp");
jest.mock("../models/ban");

describe("Admin Auth Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      session: {},
      params: {},
      body: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    getClientIp.mockReturnValue("127.0.0.1");
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("should call next() when user is authenticated", () => {
      req.session.adminUser = {
        id: 1,
        username: "admin",
        role: "admin",
      };

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", () => {
      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized - Login required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when session exists but no adminUser", () => {
      req.session = {};

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("should call next() when user is admin", () => {
      req.session.adminUser = {
        id: 1,
        username: "admin",
        role: "admin",
      };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", () => {
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized - Login required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user is not admin", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
      };

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden - Admin privileges required",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireModerator", () => {
    it("should call next() when user is admin", () => {
      req.session.adminUser = {
        id: 1,
        username: "admin",
        role: "admin",
      };

      requireModerator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should call next() when user is moderator", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
      };

      requireModerator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 when user is janitor", () => {
      req.session.adminUser = {
        id: 3,
        username: "janitor",
        role: "janitor",
      };

      requireModerator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden - Moderator privileges required",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("canModerateBoard", () => {
    it("should call next() when user is admin", () => {
      req.session.adminUser = {
        id: 1,
        username: "admin",
        role: "admin",
      };
      req.params.boardId = "tech";

      canModerateBoard(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should call next() when user has permission for specific board", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
        boards: ["tech", "gaming"],
      };
      req.params.boardId = "tech";

      canModerateBoard(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should call next() when user has empty boards array (all boards)", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
        boards: [],
      };
      req.params.boardId = "tech";

      canModerateBoard(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 when user lacks permission for board", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
        boards: ["gaming", "anime"],
      };
      req.params.boardId = "tech";

      canModerateBoard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Not authorized to moderate this board",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when boardId is missing", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
        boards: ["tech"],
      };
      // No boardId in params, body, or query

      canModerateBoard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Board ID required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should check body and query for boardId", () => {
      req.session.adminUser = {
        id: 2,
        username: "moderator",
        role: "moderator",
        boards: ["tech"],
      };

      // Test with boardId in body
      req.body = { boardId: "tech" };
      canModerateBoard(req, res, next);
      expect(next).toHaveBeenCalled();

      // Reset
      jest.clearAllMocks();
      delete req.body.boardId;

      // Test with boardId in query
      req.query = { boardId: "tech" };
      canModerateBoard(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("checkBanned", () => {
    it("should add ban info to request when user is banned", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockResolvedValue({
        id: 1,
        reason: "Spam",
        expires_at: null,
      });

      await checkBanned(req, res, next);

      expect(req.banned).toBe(true);
      expect(req.banInfo).toEqual({
        id: 1,
        reason: "Spam",
        expires_at: null,
      });
      expect(next).toHaveBeenCalled();
    });

    it("should set banned to false when user is not banned", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockResolvedValue(null);

      await checkBanned(req, res, next);

      expect(req.banned).toBe(false);
      expect(req.banInfo).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("should call next() when no boardId", async () => {
      // No boardId
      await checkBanned(req, res, next);

      expect(banModel.checkIpBanned).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should continue on error", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockRejectedValue(new Error("Database error"));

      await checkBanned(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("enforceBan", () => {
    it("should call next() when user is not banned", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockResolvedValue(null);

      await enforceBan(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 with permanent ban message", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockResolvedValue({
        id: 1,
        reason: "Repeated violations",
        expires_at: null,
      });

      await enforceBan(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "You are banned from this board",
          reason: "Repeated violations",
          message: expect.stringContaining("permanently"),
          canAppeal: true,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 with temporary ban message", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      req.params.boardId = "tech";
      banModel.checkIpBanned.mockResolvedValue({
        id: 2,
        reason: "Temporary ban",
        expires_at: futureDate.toISOString(),
      });

      await enforceBan(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "You are banned from this board",
          message: expect.stringContaining("until"),
          expires: futureDate.toISOString(),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should skip ban enforcement when no boardId", async () => {
      // No boardId
      await enforceBan(req, res, next);

      expect(banModel.checkIpBanned).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should continue on error", async () => {
      req.params.boardId = "tech";
      banModel.checkIpBanned.mockRejectedValue(new Error("Database error"));

      await enforceBan(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
