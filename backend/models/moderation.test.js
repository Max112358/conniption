// backend/models/moderation.test.js
const moderationModel = require("./moderation");
const { pool } = require("../config/database");
const fileUtils = require("../utils/fileUtils");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock("../utils/fileUtils", () => ({
  deleteFile: jest.fn(),
}));
jest.mock("./ipActionHistory", () => ({
  recordAction: jest.fn().mockResolvedValue({}),
}));

describe("Moderation Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    pool.query.mockClear();
    jest.clearAllMocks();
  });

  describe("getModerationActions", () => {
    it("should return moderation actions without filters", async () => {
      const mockActions = [
        {
          id: 1,
          admin_user_id: 1,
          action_type: "ban",
          board_id: "tech",
          thread_id: null,
          post_id: null,
          ban_id: 1,
          reason: "Spam",
          created_at: new Date(),
          ip_address: "192.168.1.1",
          admin_username: "admin",
        },
        {
          id: 2,
          admin_user_id: 1,
          action_type: "delete_post",
          board_id: "tech",
          thread_id: 123,
          post_id: 456,
          ban_id: null,
          reason: "Inappropriate content",
          created_at: new Date(),
          ip_address: "192.168.1.2",
          admin_username: "admin",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockActions });

      const actions = await moderationModel.getModerationActions();

      expect(actions).toEqual(mockActions);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM moderation_actions"),
        []
      );
    });

    it("should apply filters correctly", async () => {
      const filters = {
        admin_user_id: 1,
        action_type: "ban",
        board_id: "tech",
        limit: 10,
        offset: 0,
      };

      pool.query.mockResolvedValue({ rows: [] });

      await moderationModel.getModerationActions(filters);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE"),
        [1, "ban", "tech", 10] // offset is only added if it exists
      );
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(moderationModel.getModerationActions()).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("deleteThread", () => {
    it("should delete thread and log action", async () => {
      const threadData = {
        thread_id: 123,
        board_id: "tech",
        reason: "Inappropriate content",
        ip_address: "192.168.1.1",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ topic: "Test Thread" }] }) // SELECT thread
        .mockResolvedValueOnce({
          rows: [
            { image_url: "https://test.r2.dev/image1.jpg" },
            { image_url: "https://test.r2.dev/image2.jpg" },
          ],
        }) // SELECT images
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // DELETE thread
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await moderationModel.deleteThread(threadData);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(fileUtils.deleteFile).toHaveBeenCalledTimes(2);
    });

    it("should return false when thread not found", async () => {
      const threadData = {
        thread_id: 999,
        board_id: "tech",
        reason: "Test",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT thread (not found)
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await moderationModel.deleteThread(threadData);

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle file deletion errors gracefully", async () => {
      const threadData = {
        thread_id: 123,
        board_id: "tech",
        reason: "Test",
        ip_address: "192.168.1.1",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ topic: "Test Thread" }] }) // SELECT thread
        .mockResolvedValueOnce({
          rows: [{ image_url: "https://test.r2.dev/image1.jpg" }],
        }) // SELECT images
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // DELETE thread
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      fileUtils.deleteFile.mockRejectedValue(new Error("File delete error"));

      const result = await moderationModel.deleteThread(threadData);

      expect(result).toBe(true); // Should still succeed despite file error
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });

  describe("deletePost", () => {
    it("should delete post and return IP address", async () => {
      const postData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        reason: "Spam",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              image_url: "https://test.r2.dev/image.jpg",
              ip_address: "192.168.1.1",
              content: "Post content",
            },
          ],
        }) // SELECT post
        .mockResolvedValueOnce({ rows: [{ id: 456 }] }) // DELETE post
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await moderationModel.deletePost(postData);

      expect(result).toEqual({
        success: true,
        ipAddress: "192.168.1.1",
        postContent: "Post content",
        imageUrl: "https://test.r2.dev/image.jpg",
      });
      expect(fileUtils.deleteFile).toHaveBeenCalledWith(
        "https://test.r2.dev/image.jpg"
      );
    });

    it("should return false when post not found", async () => {
      const postData = {
        post_id: 999,
        thread_id: 123,
        board_id: "tech",
        reason: "Test",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT post (not found)
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await moderationModel.deletePost(postData);

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("editPost", () => {
    it("should edit post content successfully", async () => {
      const editData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        content: "Edited content",
        reason: "Fix typo",
        ip_address: "192.168.1.1",
        admin_user_id: 1,
        admin_username: "admin",
      };

      const mockPost = {
        id: 456,
        content: "Edited content",
        image_url: null,
        created_at: new Date(),
        color: "black",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ content: "Original content", ip_address: "192.168.1.1" }],
        }) // SELECT original post
        .mockResolvedValueOnce({ rows: [mockPost] }) // UPDATE post
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await moderationModel.editPost(editData);

      expect(result).toEqual(mockPost);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should return null when post not found", async () => {
      const editData = {
        post_id: 999,
        thread_id: 123,
        board_id: "tech",
        content: "New content",
        reason: "Test",
        admin_user_id: 1,
        admin_username: "admin",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT original post (not found)
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await moderationModel.editPost(editData);

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("changePostColor", () => {
    it("should change post color successfully", async () => {
      const colorData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        color: "red",
        reason: "Highlight",
        admin_user_id: 1,
        admin_username: "admin",
      };

      const mockPost = {
        id: 456,
        content: "Post content",
        image_url: null,
        created_at: new Date(),
        color: "red",
        thread_user_id: "abc123",
        country_code: "US",
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ ip_address: "192.168.1.1", old_color: "black" }],
        }) // SELECT post for IP
        .mockResolvedValueOnce({ rows: [mockPost] }) // UPDATE post
        .mockResolvedValueOnce(undefined) // INSERT moderation_action
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await moderationModel.changePostColor(colorData);

      expect(result).toEqual(mockPost);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("moderation_actions"),
        expect.arrayContaining([
          1,
          "tech",
          123,
          456,
          "Changed color from black to red: Highlight",
          "192.168.1.1",
        ])
      );
    });
  });

  describe("getModerationStats", () => {
    it("should return moderation statistics", async () => {
      const actionStats = [
        { action_type: "ban", count: "5" },
        { action_type: "delete_post", count: "3" },
      ];

      const adminStats = [{ admin_user_id: 1, username: "admin", count: "8" }];

      const boardStats = [
        { board_id: "tech", count: "5" },
        { board_id: "gaming", count: "3" },
      ];

      const totalStats = [{ total: "8" }];

      pool.query
        .mockResolvedValueOnce({ rows: actionStats })
        .mockResolvedValueOnce({ rows: adminStats })
        .mockResolvedValueOnce({ rows: boardStats })
        .mockResolvedValueOnce({ rows: totalStats });

      const stats = await moderationModel.getModerationStats();

      expect(stats).toEqual({
        total: 8,
        byActionType: actionStats,
        byAdmin: adminStats,
        byBoard: boardStats,
      });
    });

    it("should apply filters to statistics", async () => {
      const filters = {
        admin_user_id: 1,
        board_id: "tech",
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      };

      pool.query
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [{ total: "0" }] });

      await moderationModel.getModerationStats(filters);

      // Verify that WHERE clauses are added
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE"),
        expect.arrayContaining([1, "tech", "2024-01-01", "2024-01-31"])
      );
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(moderationModel.getModerationStats()).rejects.toThrow(
        "Database error"
      );
    });
  });
});
