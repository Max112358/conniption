// backend/routes/boards.test.js
const request = require("supertest");
const express = require("express");
const boardModel = require("../models/board");
const boardsRouter = require("./boards");

// Mock models and middleware
jest.mock("../models/board");
jest.mock("./threads", () => {
  const router = require("express").Router();
  router.get("/", (req, res) => res.json({ threads: [] }));
  router.post("/", (req, res) => res.json({ threadId: 1 }));
  return router;
});
jest.mock("./appeals", () => require("express").Router());
jest.mock("../middleware/banCheck", () => (req, res, next) => next());
jest.mock("../middleware/adminAuth", () => ({
  checkBanned: (req, res, next) => next(),
  enforceBan: (req, res, next) => next(),
}));

describe("Boards Routes", () => {
  let app;

  beforeEach(() => {
    // Create a new express app for each test
    app = express();
    app.use(express.json());
    app.use("/api/boards", boardsRouter);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("GET /api/boards", () => {
    it("should return all boards", async () => {
      // Mock boardModel.getAllBoards
      boardModel.getAllBoards.mockResolvedValue([
        {
          id: "tech",
          name: "Technology",
          description: "Tech discussion",
          nsfw: false,
          thread_ids_enabled: false,
          country_flags_enabled: false,
        },
        {
          id: "random",
          name: "Random",
          description: "Random discussion",
          nsfw: true,
          thread_ids_enabled: true,
          country_flags_enabled: true,
        },
      ]);

      const response = await request(app).get("/api/boards");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("boards");
      expect(response.body.boards).toHaveLength(2);
      expect(boardModel.getAllBoards).toHaveBeenCalledTimes(1);
    });

    it("should handle errors properly", async () => {
      // Mock error
      boardModel.getAllBoards.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/boards");

      expect(response.status).toBe(500);
      expect(boardModel.getAllBoards).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/boards/:boardId", () => {
    it("should return a specific board when found", async () => {
      // Mock boardModel.getBoardById
      boardModel.getBoardById.mockResolvedValue({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
        nsfw: false,
        thread_ids_enabled: false,
        country_flags_enabled: false,
      });

      const response = await request(app).get("/api/boards/tech");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("board");
      expect(response.body.board).toHaveProperty("id", "tech");
      expect(boardModel.getBoardById).toHaveBeenCalledWith("tech");
    });

    it("should return 404 when board not found", async () => {
      // Mock boardModel.getBoardById to return null
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
      expect(boardModel.getBoardById).toHaveBeenCalledWith("nonexistent");
    });
  });

  describe("POST /api/boards", () => {
    it("should create a new board with valid data", async () => {
      // Mock boardModel.createBoard
      boardModel.createBoard.mockResolvedValue({
        id: "test",
        name: "Test Board",
        description: "Board for testing",
        nsfw: false,
      });

      const response = await request(app).post("/api/boards").send({
        id: "test",
        name: "Test Board",
        description: "Board for testing",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("board");
      expect(response.body.board).toHaveProperty("id", "test");
      expect(boardModel.createBoard).toHaveBeenCalledTimes(1);
    });

    it("should return 400 for invalid data", async () => {
      const response = await request(app).post("/api/boards").send({
        // Missing required fields
        id: "test",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(boardModel.createBoard).not.toHaveBeenCalled();
    });

    it("should handle duplicate board error", async () => {
      // Mock error for duplicate
      const error = new Error("Duplicate key");
      error.code = "23505"; // PostgreSQL code for unique violation
      boardModel.createBoard.mockRejectedValue(error);

      const response = await request(app).post("/api/boards").send({
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error", "Board already exists");
    });
  });
});
