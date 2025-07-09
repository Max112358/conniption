// backend/models/thread.test.js
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
      // Mock thread count check
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: "50" }] }) // Thread count
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // New thread ID
        .mockResolvedValueOnce({ rows: [] }); // Create post

      const result = await threadModel.createThread(
        "tech",
        "New Thread",
        "First post content",
        "https://test.r2.dev/image.jpg",
        "127.0.0.1",
        { thread_ids_enabled: true, country_flags_enabled: true }
      );

      expect(result).toEqual({ threadId: 123, boardId: "tech" });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should delete oldest thread when board has 100 threads", async () => {
      // Mock reaching thread limit
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: "100" }] }) // Thread count
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              image_urls: [
                "https://test.r2.dev/old1.jpg",
                "https://test.r2.dev/old2.jpg",
              ],
            },
          ],
        }) // Oldest thread
        .mockResolvedValueOnce({ rows: [] }) // Delete thread
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // New thread ID
        .mockResolvedValueOnce({ rows: [] }); // Create post

      const result = await threadModel.createThread(
        "tech",
        "New Thread",
        "First post content",
        "https://test.r2.dev/image.jpg",
        "127.0.0.1",
        { thread_ids_enabled: false, country_flags_enabled: false }
      );

      expect(result).toEqual({ threadId: 123, boardId: "tech" });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM threads"),
        [1, "tech"]
      );
    });

    it("should handle transaction rollback on error", async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: "50" }] })
        .mockRejectedValueOnce(new Error("Database error"));

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
        .mockResolvedValueOnce({
          rows: [
            { image_url: "https://test.r2.dev/image1.jpg" },
            { image_url: "https://test.r2.dev/image2.jpg" },
          ],
        }) // Get images
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }); // Delete thread

      const result = await threadModel.deleteThread(123, "tech");

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM threads"),
        [123, "tech"]
      );
    });

    it("should return false when thread not found", async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No images
        .mockResolvedValueOnce({ rows: [] }); // Thread not found

      const result = await threadModel.deleteThread(999, "tech");

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});
