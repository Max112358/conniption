// models/thread.test.js
const threadModel = require("./thread");
const { pool } = require("../config/database");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock("../utils/transformImageUrl", () => (url) => url);
jest.mock("../utils/fileUtils");
jest.mock("../utils/threadIdGenerator", () => ({
  generateThreadSalt: () => "test-salt",
  generateThreadUserId: () => "test-user-id",
}));
jest.mock("../utils/countryLookup", () => ({
  getCountryCode: () => "US",
}));

describe("Thread Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe("getThreadsByBoardId", () => {
    it("should return threads for a board", async () => {
      const mockThreads = [
        {
          id: 1,
          topic: "Test Thread",
          created_at: new Date(),
          updated_at: new Date(),
          thread_salt: "salt1",
          content: "First post",
          image_url: "https://test.r2.dev/image1.jpg",
          file_type: "image",
          color: "black",
          post_count: "5",
        },
        {
          id: 2,
          topic: "Another Thread",
          created_at: new Date(),
          updated_at: new Date(),
          thread_salt: "salt2",
          content: "Another first post",
          image_url: "https://test.r2.dev/image2.jpg",
          file_type: "image",
          color: "black",
          post_count: "3",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockThreads });

      const threads = await threadModel.getThreadsByBoardId("tech");

      expect(threads).toEqual(mockThreads);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["tech"]);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(threadModel.getThreadsByBoardId("tech")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getThreadById", () => {
    it("should return a thread when found", async () => {
      const mockThread = {
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
        created_at: new Date(),
        updated_at: new Date(),
        thread_salt: "test-salt",
      };

      pool.query.mockResolvedValue({ rows: [mockThread] });

      const thread = await threadModel.getThreadById(123, "tech");

      expect(thread).toEqual(mockThread);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        123,
        "tech",
      ]);
    });

    it("should return null when thread not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const thread = await threadModel.getThreadById(999, "tech");

      expect(thread).toBeNull();
    });
  });

  describe("createThread", () => {
    it("should create a new thread with initial post", async () => {
      // Set up mock sequence for transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: "50" }] }) // Thread count check
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // INSERT thread - FIXED: Added rows array
        .mockResolvedValueOnce({ rows: [{ id: 456 }] }) // INSERT post - FIXED: Added rows array
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await threadModel.createThread(
        "tech",
        "New Thread",
        "First post content",
        "https://test.r2.dev/image.jpg",
        "127.0.0.1",
        { thread_ids_enabled: true, country_flags_enabled: true }
      );

      expect(result).toEqual({ threadId: 123, boardId: "tech", postId: 456 });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should delete oldest thread when board has 100 threads", async () => {
      // Set up mock sequence for transaction with thread deletion
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // Thread count = 100
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
            },
          ],
        }) // Mark oldest thread as dead - FIXED: Return affected row
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // INSERT new thread - FIXED: Added rows array
        .mockResolvedValueOnce({ rows: [{ id: 456 }] }) // INSERT post - FIXED: Added rows array
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await threadModel.createThread(
        "tech",
        "New Thread",
        "First post content",
        "https://test.r2.dev/image.jpg",
        "127.0.0.1",
        { thread_ids_enabled: false, country_flags_enabled: false }
      );

      expect(result).toEqual({ threadId: 123, boardId: "tech", postId: 456 });
      // Check that oldest thread was marked as dead instead of deleted
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE threads"),
        ["tech"]
      );
    });

    it("should handle transaction rollback on error", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: "50" }] }) // Thread count
        .mockRejectedValueOnce(new Error("Database error")); // Error on INSERT

      await expect(
        threadModel.createThread(
          "tech",
          "New Thread",
          "First post content",
          "https://test.r2.dev/image.jpg",
          "127.0.0.1",
          { thread_ids_enabled: false, country_flags_enabled: false }
        )
      ).rejects.toThrow("Database error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("deleteThread", () => {
    it("should delete a thread and its images", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            { image_url: "https://test.r2.dev/image1.jpg" },
            { image_url: "https://test.r2.dev/image2.jpg" },
          ],
        }) // SELECT images
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // DELETE thread (returns deleted row)
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await threadModel.deleteThread(123, "tech");

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM threads"),
        expect.arrayContaining([123, "tech"])
      );
    });

    it("should return false when thread not found", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT images (no images)
        .mockResolvedValueOnce({ rows: [] }) // DELETE thread (no rows deleted)
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await threadModel.deleteThread(999, "tech");

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});
