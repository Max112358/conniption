// backend/routes/appeals.test.js
const request = require("supertest");
const express = require("express");
const appealsRouter = require("./appeals");
const banModel = require("../models/ban");

// Mock dependencies
jest.mock("../models/ban");

describe("Appeal Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/boards/:boardId/appeal", appealsRouter);
    jest.clearAllMocks();
  });

  describe("POST /api/boards/:boardId/appeal/:banId", () => {
    it("should submit an appeal successfully", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        expires_at: null,
        is_active: true,
        appeal_status: "none",
      });

      banModel.submitAppeal.mockResolvedValue({
        id: 1,
        appeal_status: "pending",
        appeal_text: "I promise to follow the rules",
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "I promise to follow the rules",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Appeal submitted successfully"
      );
      expect(response.body).toHaveProperty("status", "pending");
      // Fix: Convert string "1" to number 1
      expect(banModel.submitAppeal).toHaveBeenCalledWith(
        "1", // The route param comes in as string
        "I promise to follow the rules"
      );
    });

    it("should return 400 when appeal text is missing", async () => {
      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Appeal text is required");
      expect(banModel.getBanById).not.toHaveBeenCalled();
    });

    it("should return 400 when appeal text is empty", async () => {
      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "   ",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Appeal text is required");
    });

    it("should return 404 when ban not found", async () => {
      banModel.getBanById.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/boards/tech/appeal/999")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Ban not found");
    });

    it("should return 403 when ban is for different board", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "gaming", // Different board
        reason: "Spam",
        is_active: true,
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Ban is not for this board"
      );
    });

    it("should allow appeal for global ban (null board_id)", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: null, // Global ban
        reason: "Spam",
        is_active: true,
        appeal_status: "none",
      });

      banModel.submitAppeal.mockResolvedValue({
        id: 1,
        appeal_status: "pending",
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Appeal submitted successfully"
      );
    });

    it("should return 400 when ban is not active", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: false, // Inactive ban
        appeal_status: "none",
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Ban is not active");
    });

    it("should return 400 when appeal already exists", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: true,
        appeal_status: "pending", // Already has appeal
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Appeal already pending");
    });

    it("should return 400 when appeal was already denied", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: true,
        appeal_status: "denied",
      });

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please reconsider",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Appeal already denied");
    });

    it("should return 500 when appeal submission fails", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: true,
        appeal_status: "none",
      });

      banModel.submitAppeal.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/boards/tech/appeal/1")
        .send({
          appealText: "Please unban me",
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Failed to submit appeal");
    });
  });

  describe("GET /api/boards/:boardId/appeal/:banId", () => {
    it("should return appeal status for a ban", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: true,
        appeal_status: "pending",
        appeal_text: "I promise to follow the rules",
      });

      const response = await request(app).get("/api/boards/tech/appeal/1");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("appeal_status", "pending");
      expect(response.body).toHaveProperty(
        "appeal_text",
        "I promise to follow the rules"
      );
      expect(response.body).toHaveProperty("is_active", true);
    });

    it("should return default values when no appeal exists", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "tech",
        reason: "Spam",
        is_active: true,
        appeal_status: null,
        appeal_text: null,
      });

      const response = await request(app).get("/api/boards/tech/appeal/1");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("appeal_status", "none");
      expect(response.body).toHaveProperty("appeal_text", "");
      expect(response.body).toHaveProperty("is_active", true);
    });

    it("should return 404 when ban not found", async () => {
      banModel.getBanById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/tech/appeal/999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Ban not found");
    });

    it("should return 403 when ban is for different board", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: "gaming", // Different board
        reason: "Spam",
        is_active: true,
      });

      const response = await request(app).get("/api/boards/tech/appeal/1");

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Ban is not for this board"
      );
    });

    it("should allow checking appeal for global ban", async () => {
      banModel.getBanById.mockResolvedValue({
        id: 1,
        board_id: null, // Global ban
        reason: "Spam",
        is_active: true,
        appeal_status: "approved",
        appeal_text: "I was unfairly banned",
      });

      const response = await request(app).get("/api/boards/tech/appeal/1");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("appeal_status", "approved");
      expect(response.body).toHaveProperty(
        "appeal_text",
        "I was unfairly banned"
      );
    });
  });
});
