// backend/test/integration/api.test.js
const request = require("supertest");
const { app, server } = require("../../server");
const { pool } = require("../../config/database");

// Mock all external dependencies
jest.mock("../../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    end: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../utils/dbInit", () => ({
  initDatabase: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../utils/scheduledJobs", () => ({
  start: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ initialized: true, jobs: {} }),
}));

jest.mock("socket.io", () => {
  const mockEmit = jest.fn();
  const mockOn = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

  return jest.fn().mockImplementation(() => ({
    on: mockOn,
    emit: mockEmit,
    to: mockTo,
    engine: { clientsCount: 0 },
    close: jest.fn(),
    use: jest.fn(),
  }));
});

// Mock session for admin tests
jest.mock("express-session", () => {
  const sessions = {};
  return () => (req, res, next) => {
    req.session = sessions[req.headers.cookie] || {};
    req.session.destroy = (cb) => {
      delete sessions[req.headers.cookie];
      cb();
    };
    next();
  };
});

jest.mock("connect-pg-simple", () => {
  return () => class PgStore {};
});

describe("API Integration Tests", () => {
  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("socketio");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("housekeeping");
    });
  });

  describe("Socket.io Health Check", () => {
    it("should return socket.io status", async () => {
      const response = await request(app).get("/socket.io/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("transports");
      expect(response.body).toHaveProperty("clients");
      expect(response.body).toHaveProperty("cors");
    });
  });

  describe("Board to Thread to Post Flow", () => {
    it("should handle complete user flow", async () => {
      // Mock getting boards
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: "tech", name: "Technology", description: "Tech", nsfw: false },
          { id: "gaming", name: "Gaming", description: "Games", nsfw: false },
        ],
      });

      // 1. Get all boards
      const boardsResponse = await request(app).get("/api/boards");
      expect(boardsResponse.status).toBe(200);
      expect(boardsResponse.body.boards).toHaveLength(2);

      // Mock getting specific board
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: "tech", name: "Technology", description: "Tech", nsfw: false },
        ],
      });

      // 2. Get specific board
      const boardResponse = await request(app).get("/api/boards/tech");
      expect(boardResponse.status).toBe(200);
      expect(boardResponse.body.board).toHaveProperty("id", "tech");

      // Mock getting threads
      pool.query.mockResolvedValueOnce({
        rows: [{ id: "tech", name: "Technology" }], // Board exists
      });
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            topic: "Test Thread",
            created_at: new Date(),
            updated_at: new Date(),
            content: "First post",
            image_url: "https://test.r2.dev/image.jpg",
            post_count: "5",
          },
        ],
      });

      // 3. Get threads for board
      const threadsResponse = await request(app).get(
        "/api/boards/tech/threads"
      );
      expect(threadsResponse.status).toBe(200);
      expect(threadsResponse.body.threads).toHaveLength(1);

      // Mock getting thread details
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, board_id: "tech", topic: "Test Thread" }],
      });

      // 4. Get specific thread
      const threadResponse = await request(app).get(
        "/api/boards/tech/threads/1"
      );
      expect(threadResponse.status).toBe(200);
      expect(threadResponse.body.thread).toHaveProperty("id", 1);

      // Mock getting posts
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, board_id: "tech", topic: "Test Thread" }], // Thread exists
      });
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            content: "First post",
            image_url: "https://test.r2.dev/image.jpg",
            created_at: new Date(),
          },
          {
            id: 2,
            content: "Reply post",
            image_url: null,
            created_at: new Date(),
          },
        ],
      });

      // 5. Get posts for thread
      const postsResponse = await request(app).get(
        "/api/boards/tech/threads/1/posts"
      );
      expect(postsResponse.status).toBe(200);
      expect(postsResponse.body.posts).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for non-existent board", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/boards/nonexistent");
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });

    it("should handle 404 for non-existent thread", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/boards/tech/threads/999");
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Thread not found");
    });

    it("should handle database errors gracefully", async () => {
      pool.query.mockRejectedValueOnce(new Error("Database connection error"));

      const response = await request(app).get("/api/boards");
      expect(response.status).toBe(500);
    });

    it("should handle invalid JSON", async () => {
      const response = await request(app)
        .post("/api/boards/tech/threads")
        .set("Content-Type", "application/json")
        .send("{ invalid json");

      expect(response.status).toBe(400);
    });
  });

  describe("CORS", () => {
    it("should allow requests from allowed origins", async () => {
      const response = await request(app)
        .get("/api/boards")
        .set("Origin", "https://conniption.pages.dev");

      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://conniption.pages.dev"
      );
    });

    it("should handle OPTIONS requests", async () => {
      const response = await request(app)
        .options("/api/boards")
        .set("Origin", "https://conniption.pages.dev");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-methods"]).toContain("GET");
      expect(response.headers["access-control-allow-methods"]).toContain(
        "POST"
      );
    });
  });
});
