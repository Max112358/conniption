// backend/routes/threads.test.js
const request = require("supertest");
const express = require("express");
const threadsRouter = require("./threads");
const threadModel = require("../models/thread");
const boardModel = require("../models/board");

// Mock dependencies
jest.mock("../models/thread");
jest.mock("../models/board");
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
      // Check if test wants to simulate no file
      if (req.headers["x-test-no-file"] === "true") {
        next();
      } else {
        // Mock file upload
        req.file = {
          location: "https://test.r2.dev/test-image.jpg",
          fileType: "image",
          size: 1024,
        };
        next();
      }
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
jest.mock("./posts", () => require("express").Router());

describe("Thread Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/boards/:boardId/threads", threadsRouter);
    jest.clearAllMocks();
  });

  describe("GET /api/boards/:boardId/threads", () => {
    it("should return threads for a valid board", async () => {
      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
      });

      threadModel.getThreadsByBoardId.mockResolvedValue([
        {
          id: 1,
          topic: "Test Thread",
          created_at: new Date(),
          updated_at: new Date(),
          content: "First post content",
          image_url: "https://test.r2.dev/image1.jpg",
          file_type: "image",
          post_count: 5,
        },
        {
          id: 2,
          topic: "Another Thread",
          created_at: new Date(),
          updated_at: new Date(),
          content: "Another first post",
          image_url: "https://test.r2.dev/image2.jpg",
          file_type: "image",
          post_count: 3,
        },
      ]);

      const response = await request(app).get("/api/boards/tech/threads");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("threads");
      expect(response.body.threads).toHaveLength(2);
      expect(boardModel.getBoardById).toHaveBeenCalledWith("tech");
      expect(threadModel.getThreadsByBoardId).toHaveBeenCalledWith("tech");
    });

    it("should return 404 when board not found", async () => {
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/boards/nonexistent/threads"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });
  });

  describe("POST /api/boards/:boardId/threads", () => {
    it("should create a new thread with valid data", async () => {
      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
        thread_ids_enabled: false,
        country_flags_enabled: false,
      });

      threadModel.createThread.mockResolvedValue({
        threadId: 123,
        boardId: "tech",
      });

      const response = await request(app)
        .post("/api/boards/tech/threads")
        .send({
          topic: "New Thread Topic",
          content: "This is the first post content",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        "message",
        "Thread created successfully"
      );
      expect(response.body).toHaveProperty("threadId", 123);
      expect(threadModel.createThread).toHaveBeenCalledWith(
        "tech",
        "New Thread Topic",
        "This is the first post content",
        "https://test.r2.dev/test-image.jpg",
        "127.0.0.1",
        expect.any(Object)
      );
    });

    it("should return 400 when missing required fields", async () => {
      const response = await request(app)
        .post("/api/boards/tech/threads")
        .send({
          topic: "New Thread Topic",
          // Missing content
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Topic and content are required"
      );
    });

    it("should return 400 when missing media file", async () => {
      const response = await request(app)
        .post("/api/boards/tech/threads")
        .set("x-test-no-file", "true") // Tell mock to not include file
        .send({
          topic: "New Thread Topic",
          content: "Content without image",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Image or video is required"
      );
    });

    it("should return 404 when board not found", async () => {
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/boards/nonexistent/threads")
        .send({
          topic: "New Thread Topic",
          content: "This is the first post content",
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });
  });

  describe("GET /api/boards/:boardId/threads/:threadId", () => {
    it("should return a specific thread when found", async () => {
      threadModel.getThreadById.mockResolvedValue({
        id: 123,
        board_id: "tech",
        topic: "Test Thread",
        created_at: new Date(),
        updated_at: new Date(),
        thread_salt: "random-salt",
      });

      const response = await request(app).get("/api/boards/tech/threads/123");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("thread");
      expect(response.body.thread).toHaveProperty("id", 123);
      expect(threadModel.getThreadById).toHaveBeenCalledWith("123", "tech");
    });

    it("should return 404 when thread not found", async () => {
      threadModel.getThreadById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/tech/threads/999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });
  });

  describe("DELETE /api/boards/:boardId/threads/:threadId", () => {
    it("should allow thread owner to delete their thread", async () => {
      const { pool } = require("../config/database");
      pool.query.mockResolvedValue({
        rows: [
          { ip_address: "127.0.0.1", content: "First post", image_url: null },
        ],
      });

      threadModel.deleteThread.mockResolvedValue(true);

      const response = await request(app).delete(
        "/api/boards/tech/threads/123"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Thread deleted successfully"
      );
      expect(response.body).toHaveProperty("deletedBy", "owner");
      expect(threadModel.deleteThread).toHaveBeenCalledWith("123", "tech");
    });

    it("should return 403 when non-owner tries to delete", async () => {
      const { pool } = require("../config/database");
      pool.query.mockResolvedValue({
        rows: [
          { ip_address: "192.168.1.1", content: "First post", image_url: null },
        ],
      });

      const response = await request(app).delete(
        "/api/boards/tech/threads/123"
      );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Not authorized to delete this thread"
      );
    });

    it("should return 404 when thread not found", async () => {
      const { pool } = require("../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete(
        "/api/boards/tech/threads/999"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });
  });
});
