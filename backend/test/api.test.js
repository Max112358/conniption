// backend/test/api.test.js
const request = require("supertest");
const { app, server } = require("../server");
const { pool } = require("../config/database");
const boardModel = require("../models/board");
const threadModel = require("../models/thread");
const postModel = require("../models/post");

// Mock modules
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock("../utils/dbInit", () => ({
  initDatabase: jest.fn().mockResolvedValue(true),
}));

// Create mocks for models
jest.mock("../models/board");
jest.mock("../models/thread");
jest.mock("../models/post");

describe("API Routes", () => {
  // Close server after tests
  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("GET /api/boards", () => {
    it("should return all boards", async () => {
      // Mock implementation
      boardModel.getAllBoards.mockResolvedValue([
        {
          id: "tech",
          name: "Technology",
          description: "Tech discussion",
          nsfw: false,
        },
        {
          id: "random",
          name: "Random",
          description: "Random discussion",
          nsfw: true,
        },
      ]);

      const response = await request(app).get("/api/boards");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("boards");
      expect(response.body.boards).toHaveLength(2);
      expect(boardModel.getAllBoards).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/boards/:boardId", () => {
    it("should return a specific board", async () => {
      // Mock implementation
      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
        nsfw: false,
      });

      const response = await request(app).get("/api/boards/tech");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("board");
      expect(response.body.board).toHaveProperty("id", "tech");
      expect(boardModel.getBoardById).toHaveBeenCalledWith("tech");
    });

    it("should return 404 for non-existent board", async () => {
      // Mock implementation
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });
  });

  describe("GET /api/boards/:boardId/threads", () => {
    it("should return threads for a board", async () => {
      // Mock implementations
      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
        nsfw: false,
      });

      threadModel.getThreadsByBoardId.mockResolvedValue([
        {
          id: 1,
          topic: "First Thread",
          created_at: "2025-01-01T00:00:00Z",
          post_count: 5,
        },
        {
          id: 2,
          topic: "Second Thread",
          created_at: "2025-01-02T00:00:00Z",
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

    it("should return 404 if board not found", async () => {
      // Mock implementation
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/boards/nonexistent/threads"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
      expect(threadModel.getThreadsByBoardId).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/boards/:boardId/threads/:threadId", () => {
    it("should return a specific thread", async () => {
      // Mock implementation
      threadModel.getThreadById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        topic: "Thread Topic",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T01:00:00Z",
      });

      const response = await request(app).get("/api/boards/tech/threads/1");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("thread");
      expect(response.body.thread).toHaveProperty("id", 1);
      expect(threadModel.getThreadById).toHaveBeenCalledWith("1", "tech");
    });

    it("should return 404 if thread not found", async () => {
      // Mock implementation
      threadModel.getThreadById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/tech/threads/999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });
  });

  describe("GET /api/boards/:boardId/threads/:threadId/posts", () => {
    it("should return posts for a thread", async () => {
      // Mock implementations
      threadModel.getThreadById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        topic: "Thread Topic",
      });

      postModel.getPostsByThreadId.mockResolvedValue([
        {
          id: 1,
          content: "First post",
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: 2,
          content: "Second post",
          created_at: "2025-01-01T01:00:00Z",
        },
      ]);

      const response = await request(app).get(
        "/api/boards/tech/threads/1/posts"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("posts");
      expect(response.body.posts).toHaveLength(2);
      expect(threadModel.getThreadById).toHaveBeenCalledWith("1", "tech");
      expect(postModel.getPostsByThreadId).toHaveBeenCalledWith("1", "tech");
    });

    it("should return 404 if thread not found", async () => {
      // Mock implementation
      threadModel.getThreadById.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/boards/tech/threads/999/posts"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
      expect(postModel.getPostsByThreadId).not.toHaveBeenCalled();
    });
  });
});
