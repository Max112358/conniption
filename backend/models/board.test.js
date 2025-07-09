// backend/models/board.test.js
const boardModel = require("./board");
const { pool } = require("../config/database");

// Mock the database connection
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe("Board Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllBoards", () => {
    it("should return all boards", async () => {
      const mockBoards = [
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
      ];

      pool.query.mockResolvedValue({ rows: mockBoards });

      const boards = await boardModel.getAllBoards();

      expect(boards).toEqual(mockBoards);
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT id, name, description, nsfw, thread_ids_enabled, country_flags_enabled FROM boards"
      );
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(boardModel.getAllBoards()).rejects.toThrow("Database error");
    });
  });

  describe("getBoardById", () => {
    it("should return a board when found", async () => {
      const mockBoard = {
        id: "tech",
        name: "Technology",
        description: "Tech discussion",
        nsfw: false,
        thread_ids_enabled: false,
        country_flags_enabled: false,
      };

      pool.query.mockResolvedValue({ rows: [mockBoard] });

      const board = await boardModel.getBoardById("tech");

      expect(board).toEqual(mockBoard);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["tech"]);
    });

    it("should return null when board not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const board = await boardModel.getBoardById("nonexistent");

      expect(board).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(boardModel.getBoardById("tech")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("createBoard", () => {
    it("should create and return a new board", async () => {
      const newBoard = {
        id: "test",
        name: "Test Board",
        description: "Board for testing",
        nsfw: false,
        thread_ids_enabled: false,
        country_flags_enabled: false,
      };

      pool.query.mockResolvedValue({ rows: [newBoard] });

      const board = await boardModel.createBoard(newBoard);

      expect(board).toEqual(newBoard);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        "test",
        "Test Board",
        "Board for testing",
        false,
        false,
        false,
      ]);
    });

    it("should use default values for optional fields", async () => {
      const boardData = {
        id: "test",
        name: "Test Board",
        description: "Board for testing",
      };

      const returnedBoard = {
        ...boardData,
        nsfw: false,
        thread_ids_enabled: false,
        country_flags_enabled: false,
      };

      pool.query.mockResolvedValue({ rows: [returnedBoard] });

      const board = await boardModel.createBoard(boardData);

      expect(board).toEqual(returnedBoard);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        "test",
        "Test Board",
        "Board for testing",
        false,
        false,
        false,
      ]);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Duplicate key"));

      await expect(
        boardModel.createBoard({
          id: "test",
          name: "Test",
          description: "Test",
        })
      ).rejects.toThrow("Duplicate key");
    });
  });
});
