// backend/models/ban.test.js
const banModel = require("./ban");
const { pool } = require("../config/database");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock("./ipActionHistory", () => ({
  recordAction: jest.fn().mockResolvedValue({}),
}));

describe("Ban Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe("createBan", () => {
    it("should create a new ban", async () => {
      const banData = {
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Spam",
        expires_at: null,
        admin_user_id: 1,
        post_content: "Banned content",
        post_image_url: null,
        thread_id: 123,
        post_id: 456,
      };

      const mockBan = {
        id: 1,
        ...banData,
        created_at: new Date(),
        is_active: true,
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBan] }) // INSERT ban
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce({ rows: [{ username: "admin" }] }) // SELECT admin username
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await banModel.createBan(banData);

      expect(result).toEqual(mockBan);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should handle transaction rollback on error", async () => {
      const banData = {
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Spam",
        admin_user_id: 1,
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // INSERT fails

      await expect(banModel.createBan(banData)).rejects.toThrow(
        "Database error"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("getActiveBans", () => {
    it("should return active bans for all boards", async () => {
      const mockBans = [
        {
          id: 1,
          ip_address: "192.168.1.1",
          board_id: "tech",
          reason: "Spam",
          expires_at: null,
          created_at: new Date(),
          admin_user_id: 1,
          is_active: true,
          admin_username: "admin",
        },
        {
          id: 2,
          ip_address: "192.168.1.2",
          board_id: null,
          reason: "Global ban",
          expires_at: null,
          created_at: new Date(),
          admin_user_id: 1,
          is_active: true,
          admin_username: "admin",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockBans });

      const bans = await banModel.getActiveBans();

      expect(bans).toEqual(mockBans);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), []);
    });

    it("should return active bans for specific board", async () => {
      const mockBans = [
        {
          id: 1,
          ip_address: "192.168.1.1",
          board_id: "tech",
          reason: "Spam",
          admin_username: "admin",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockBans });

      const bans = await banModel.getActiveBans("tech");

      expect(bans).toEqual(mockBans);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["tech"]);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(banModel.getActiveBans()).rejects.toThrow("Database error");
    });
  });

  describe("getBanById", () => {
    it("should return a ban when found", async () => {
      const mockBan = {
        id: 1,
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Spam",
        expires_at: null,
        created_at: new Date(),
        admin_user_id: 1,
        is_active: true,
        appeal_text: null,
        appeal_status: "none",
        admin_username: "admin",
      };

      pool.query.mockResolvedValue({ rows: [mockBan] });

      const ban = await banModel.getBanById(1);

      expect(ban).toEqual(mockBan);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it("should return null when ban not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const ban = await banModel.getBanById(999);

      expect(ban).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(banModel.getBanById(1)).rejects.toThrow("Database error");
    });
  });

  describe("checkIpBanned", () => {
    it("should return ban when IP is banned", async () => {
      const mockBan = {
        id: 1,
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Spam",
        expires_at: null,
        created_at: new Date(),
        is_active: true,
      };

      pool.query.mockResolvedValue({ rows: [mockBan] });

      const ban = await banModel.checkIpBanned("192.168.1.1", "tech");

      expect(ban).toEqual(mockBan);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        "192.168.1.1",
        expect.any(String),
        "tech",
      ]);
    });

    it("should return null when IP is not banned", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const ban = await banModel.checkIpBanned("192.168.1.1", "tech");

      expect(ban).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(
        banModel.checkIpBanned("192.168.1.1", "tech")
      ).rejects.toThrow("Database error");
    });
  });

  describe("getBansByPostId", () => {
    it("should return bans for a post", async () => {
      const mockBans = [
        {
          id: 1,
          ip_address: "192.168.1.1",
          board_id: "tech",
          reason: "Spam",
          expires_at: null,
          created_at: new Date(),
          is_active: true,
        },
      ];

      pool.query.mockResolvedValue({ rows: mockBans });

      const bans = await banModel.getBansByPostId(456, "tech");

      expect(bans).toEqual(mockBans);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        456,
        "tech",
      ]);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(banModel.getBansByPostId(456, "tech")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("updateBan", () => {
    it("should update ban successfully", async () => {
      const updates = {
        reason: "Updated reason",
        expires_at: new Date(),
        is_active: true,
        admin_user_id: 1,
      };

      const mockBan = {
        id: 1,
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Updated reason",
        expires_at: updates.expires_at,
        created_at: new Date(),
        admin_user_id: 1,
        is_active: true,
        appeal_text: null,
        appeal_status: "none",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBan] }) // SELECT current ban
        .mockResolvedValueOnce({ rows: [mockBan] }) // UPDATE ban
        .mockResolvedValueOnce({ rows: [{ username: "admin" }] }) // SELECT admin username
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await banModel.updateBan(1, updates);

      expect(result).toEqual(mockBan);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should log moderation action for unban", async () => {
      const updates = {
        is_active: false,
        admin_user_id: 1,
        reason: "Ban removed",
      };

      const mockBan = {
        id: 1,
        ip_address: "192.168.1.1",
        board_id: "tech",
        is_active: false,
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBan] }) // SELECT current ban
        .mockResolvedValueOnce({ rows: [mockBan] }) // UPDATE ban
        .mockResolvedValueOnce({ rows: [{ username: "admin" }] }) // SELECT admin username
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await banModel.updateBan(1, updates);

      expect(result).toEqual(mockBan);
      // Check that the moderation action insert was called - match the exact parameter order
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO moderation_actions"),
        [1, "tech", "Ban removed", "192.168.1.1", 1] // Exact order: admin_user_id, board_id, reason, ip_address, ban_id
      );
    });

    it("should return null when ban not found", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT current ban returns no rows
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await banModel.updateBan(999, { reason: "Test" });

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle transaction rollback on error", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // SELECT fails

      await expect(banModel.updateBan(1, { reason: "Test" })).rejects.toThrow(
        "Database error"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("submitAppeal", () => {
    it("should submit appeal successfully", async () => {
      const mockBan = {
        id: 1,
        ip_address: "192.168.1.1",
        board_id: "tech",
        reason: "Spam",
        expires_at: null,
        created_at: new Date(),
        admin_user_id: 1,
        is_active: true,
        appeal_text: "I promise to follow rules",
        appeal_status: "pending",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBan] }) // UPDATE ban with appeal
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await banModel.submitAppeal(
        1,
        "I promise to follow rules"
      );

      expect(result).toEqual(mockBan);
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [
        "I promise to follow rules",
        1,
      ]);
    });

    it("should return null when ban not found or not active", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await banModel.submitAppeal(999, "Appeal text");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // UPDATE fails

      await expect(banModel.submitAppeal(1, "Appeal text")).rejects.toThrow(
        "Database error"
      );
    });
  });
});
