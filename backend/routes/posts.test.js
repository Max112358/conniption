// backend/routes/posts.test.js
const request = require("supertest");
const express = require("express");
const postsRouter = require("./posts");
const postModel = require("../models/post");
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const banModel = require("../models/ban");

// Mock dependencies
jest.mock("../models/post");
jest.mock("../models/thread");
jest.mock("../models/board");
jest.mock("../models/ban");
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockReturnValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));
jest.mock("../middleware/upload", () => ({
  uploadWithUrlTransform: () => [
    (req, res, next) => {
      // Mock file upload if specified in test
      if (req.headers["x-test-file"]) {
        req.file = {
          location: "https://test.r2.dev/test-image.jpg",
          fileType: "image",
          size: 1024,
        };
      }
      next();
    },
  ],
}));
jest.mock("../utils/socketHandler", () => ({
  getIo: () => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));
jest.mock("../utils/getClientIp", () => () => "127.0.0.1");
jest.mock("../middleware/banCheck", () => (req, res, next) => next());

describe("Post Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/boards/:boardId/threads/:threadId/posts", postsRouter);
    jest.clearAllMocks();
  });

  describe("GET /api/boards/:boardId/threads/:threadId/posts", () => {
    it("should return posts for a valid thread", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
      });

      postModel.getPostsByThreadId.mockResolvedValue([
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
      ]);

      banModel.getBansByPostId.mockResolvedValue([]);

      const response = await request(app).get(
        "/api/boards/tech/threads/123/posts"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("posts");
      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0]).toHaveProperty("isBanned", false);
      expect(threadModel.getThreadById).toHaveBeenCalledWith("123", "tech");
      expect(postModel.getPostsByThreadId).toHaveBeenCalledWith("123", "tech");
    });

    it("should include ban information when posts are banned", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
      });

      postModel.getPostsByThreadId.mockResolvedValue([
        {
          id: 1,
          content: "Banned post",
          image_url: null,
          created_at: new Date(),
        },
      ]);

      banModel.getBansByPostId.mockResolvedValue([
        {
          id: 1,
          reason: "Spam",
          expires_at: null,
        },
      ]);

      const response = await request(app).get(
        "/api/boards/tech/threads/123/posts"
      );

      expect(response.status).toBe(200);
      expect(response.body.posts[0]).toHaveProperty("isBanned", true);
      expect(response.body.posts[0]).toHaveProperty("banInfo");
      expect(response.body.posts[0].banInfo).toHaveProperty("reason", "Spam");
    });

    it("should return 404 when thread not found", async () => {
      threadModel.getThreadById.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/boards/tech/threads/999/posts"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });
  });

  describe("POST /api/boards/:boardId/threads/:threadId/posts", () => {
    it("should create a new post with content only", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
        thread_salt: "random-salt",
      });

      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        thread_ids_enabled: true,
        country_flags_enabled: true,
      });

      postModel.createPost.mockResolvedValue({
        postId: 456,
        threadId: 123,
        boardId: "tech",
      });

      const response = await request(app)
        .post("/api/boards/tech/threads/123/posts")
        .send({ content: "This is a new post" });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        "message",
        "Post created successfully"
      );
      expect(response.body).toHaveProperty("postId", 456);
      expect(postModel.createPost).toHaveBeenCalledWith(
        "123",
        "tech",
        "This is a new post",
        null,
        "127.0.0.1",
        expect.objectContaining({
          thread_ids_enabled: true,
          country_flags_enabled: true,
        }),
        "random-salt"
      );
    });

    it("should create a new post with image", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
        thread_salt: "random-salt",
      });

      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        thread_ids_enabled: false,
        country_flags_enabled: false,
      });

      postModel.createPost.mockResolvedValue({
        postId: 457,
        threadId: 123,
        boardId: "tech",
      });

      const response = await request(app)
        .post("/api/boards/tech/threads/123/posts")
        .set("x-test-file", "true")
        .send({ content: "Post with image" });

      expect(response.status).toBe(201);
      expect(postModel.createPost).toHaveBeenCalledWith(
        "123",
        "tech",
        "Post with image",
        "https://test.r2.dev/test-image.jpg",
        "127.0.0.1",
        expect.any(Object),
        "random-salt"
      );
    });

    it("should create a post with image only (no content)", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
        thread_salt: "random-salt",
      });

      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        thread_ids_enabled: false,
        country_flags_enabled: false,
      });

      postModel.createPost.mockResolvedValue({
        postId: 458,
        threadId: 123,
        boardId: "tech",
      });

      const response = await request(app)
        .post("/api/boards/tech/threads/123/posts")
        .set("x-test-file", "true")
        .send({}); // No content field

      expect(response.status).toBe(201);
      expect(postModel.createPost).toHaveBeenCalledWith(
        "123",
        "tech",
        "", // Empty string for content
        "https://test.r2.dev/test-image.jpg",
        "127.0.0.1",
        expect.any(Object),
        "random-salt"
      );
    });

    it("should return 400 when neither content nor image provided", async () => {
      const response = await request(app)
        .post("/api/boards/tech/threads/123/posts")
        .send({}); // No content and no file

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Either content or an image/video is required"
      );
    });

    it("should return 404 when thread not found", async () => {
      threadModel.getThreadById.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/boards/tech/threads/999/posts")
        .send({ content: "New post" });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });

    it("should return 404 when board not found", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
      });

      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/boards/tech/threads/123/posts")
        .send({ content: "New post" });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });
  });

  describe("DELETE /api/boards/:boardId/threads/:threadId/posts/:postId", () => {
    it("should allow post owner to delete their post", async () => {
      const { pool } = require("../config/database");
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);
      pool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            ip_address: "127.0.0.1",
            content: "My post",
            image_url: null,
          },
        ],
      });

      const response = await request(app).delete(
        "/api/boards/tech/threads/123/posts/1"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Post deleted successfully"
      );
      expect(response.body).toHaveProperty("deletedBy", "owner");
    });

    it("should return 403 when non-owner tries to delete", async () => {
      const { pool } = require("../config/database");
      pool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            ip_address: "192.168.1.1",
            content: "Someone else's post",
            image_url: null,
          },
        ],
      });

      const response = await request(app).delete(
        "/api/boards/tech/threads/123/posts/1"
      );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Not authorized to delete this post"
      );
    });

    it("should return 404 when post not found", async () => {
      const { pool } = require("../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete(
        "/api/boards/tech/threads/123/posts/999"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Post not found");
    });
  });
});
