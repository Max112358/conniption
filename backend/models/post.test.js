// models/post.test.js
const postModel = require("./post");
const { pool } = require("../config/database");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock("../utils/transformImageUrl", () => (url) => url || null);
jest.mock("../utils/threadIdGenerator", () => ({
  generateThreadUserId: () => "test-user-id",
}));
jest.mock("../utils/countryLookup", () => ({
  getCountryCode: () => "US",
}));

describe("Post Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe("getPostsByThreadId", () => {
    it("should return posts for a thread", async () => {
      const mockPosts = [
        {
          id: 1,
          content: "First post",
          image_url: "https://test.r2.dev/image1.jpg",
          file_type: "image",
          created_at: new Date(),
          thread_user_id: "abc123",
          country_code: "US",
          color: "black",
        },
        {
          id: 2,
          content: "Second post",
          image_url: null,
          file_type: null,
          created_at: new Date(),
          thread_user_id: "def456",
          country_code: "GB",
          color: "red",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockPosts });

      const posts = await postModel.getPostsByThreadId(123, "tech");

      expect(posts).toEqual(mockPosts);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        123,
        "tech",
      ]);
      // Should only be called once (no survey query)
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should handle empty results", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const posts = await postModel.getPostsByThreadId(123, "tech");

      expect(posts).toEqual([]);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(postModel.getPostsByThreadId(123, "tech")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("createPost", () => {
    it("should create a post with image", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ is_dead: false, post_count: 5 }] }) // Thread check
        .mockResolvedValueOnce({ rows: [{ id: 456 }] }) // INSERT post - FIXED: Added rows array
        .mockResolvedValueOnce(undefined) // UPDATE thread post count
        .mockResolvedValueOnce(undefined) // UPDATE thread updated_at (bump)
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await postModel.createPost(
        123,
        "tech",
        "Test content",
        "https://test.r2.dev/image.jpg",
        "127.0.0.1",
        { thread_ids_enabled: true, country_flags_enabled: true },
        "test-salt"
      );

      expect(result).toEqual({ postId: 456, threadId: 123, boardId: "tech" });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should create a post without image", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ is_dead: false, post_count: 5 }] }) // Thread check
        .mockResolvedValueOnce({ rows: [{ id: 457 }] }) // INSERT post - FIXED: Added rows array
        .mockResolvedValueOnce(undefined) // UPDATE thread post count
        .mockResolvedValueOnce(undefined) // UPDATE thread updated_at (bump)
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await postModel.createPost(
        123,
        "tech",
        "Text only post",
        null,
        "127.0.0.1",
        { thread_ids_enabled: false, country_flags_enabled: false },
        "test-salt"
      );

      expect(result).toEqual({ postId: 457, threadId: 123, boardId: "tech" });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should handle dead thread", async () => {
      // The actual model checks for dead thread BEFORE starting transaction
      await expect(
        postModel.createPost(
          123,
          "tech",
          "Test content",
          null,
          "127.0.0.1",
          { thread_ids_enabled: false, country_flags_enabled: false },
          "test-salt",
          true // isDead parameter - this causes immediate rejection
        )
      ).rejects.toThrow("Cannot post to a dead thread");

      // No database calls should be made if thread is dead
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("should handle dont_bump flag", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ is_dead: false, post_count: 5 }] }) // Thread check
        .mockResolvedValueOnce({ rows: [{ id: 458 }] }) // INSERT post
        .mockResolvedValueOnce(undefined) // UPDATE thread post count
        .mockResolvedValueOnce(undefined); // COMMIT (no bump query)

      const result = await postModel.createPost(
        123,
        "tech",
        "Test content",
        null,
        "127.0.0.1",
        { thread_ids_enabled: false, country_flags_enabled: false },
        "test-salt",
        false, // isDead
        true // dontBump
      );

      expect(result).toEqual({ postId: 458, threadId: 123, boardId: "tech" });
      // Should not bump thread when dontBump is true
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining("UPDATE threads SET updated_at"),
        expect.anything()
      );
    });

    it("should handle transaction rollback on error", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ is_dead: false, post_count: 5 }] }) // Thread check
        .mockRejectedValueOnce(new Error("Database error")); // Error on INSERT

      await expect(
        postModel.createPost(
          123,
          "tech",
          "Test content",
          null,
          "127.0.0.1",
          { thread_ids_enabled: false, country_flags_enabled: false },
          "test-salt"
        )
      ).rejects.toThrow("Database error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("getPostById", () => {
    it("should return a post when found", async () => {
      const mockPost = {
        id: 123,
        thread_id: 456,
        board_id: "tech",
        content: "Test post",
        image_url: "https://test.r2.dev/image.jpg",
        file_type: "image",
        created_at: new Date(),
        ip_address: "127.0.0.1",
        thread_user_id: "abc123",
        country_code: "US",
        color: "black",
      };

      pool.query.mockResolvedValue({ rows: [mockPost] });

      const post = await postModel.getPostById(123, "tech");

      expect(post).toEqual(mockPost);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        123,
        "tech",
      ]);
    });

    it("should return null when post not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const post = await postModel.getPostById(999, "tech");

      expect(post).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(postModel.getPostById(123, "tech")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("updatePostColor", () => {
    it("should update post color successfully", async () => {
      const mockPost = {
        id: 123,
        thread_id: 456,
        board_id: "tech",
        content: "Test post",
        image_url: null,
        file_type: null,
        created_at: new Date(),
        ip_address: "127.0.0.1",
        thread_user_id: "abc123",
        country_code: "US",
        color: "red",
      };

      pool.query.mockResolvedValue({ rows: [mockPost] });

      const updatedPost = await postModel.updatePostColor(123, "tech", "red");

      expect(updatedPost).toEqual(mockPost);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        "red",
        123,
        "tech",
      ]);
    });

    it("should return null when post not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await postModel.updatePostColor(999, "tech", "blue");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(
        postModel.updatePostColor(123, "tech", "green")
      ).rejects.toThrow("Database error");
    });
  });
});
