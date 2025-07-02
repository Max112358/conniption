// backend/test/api.test.js
const request = require("supertest");
const { app, server } = require("../server");

// Mock all required modules
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
    end: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock("../utils/dbInit", () => ({
  initDatabase: jest.fn().mockResolvedValue(true),
}));

jest.mock("../models/board");
jest.mock("../models/thread");
jest.mock("../models/post");
jest.mock("../utils/scheduledJobs", () => ({
  start: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ initialized: true, jobs: {} }),
}));

// Mock Socket.io
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
  }));
});

const boardModel = require("../models/board");
const threadModel = require("../models/thread");
const postModel = require("../models/post");

describe("API Routes", () => {
  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/boards", () => {
    it("should return all boards", async () => {
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
  });

  describe("GET /api/boards/:boardId", () => {
    it("should return a specific board", async () => {
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

    it("should return 404 for non-existent board", async () => {
      boardModel.getBoardById.mockResolvedValue(null);

      const response = await request(app).get("/api/boards/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Board not found");
    });
  });
});
