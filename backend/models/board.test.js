// backend/models/board.test.js
const { newDb } = require("pg-mem");
const boardModel = require("./board");

// Mock the pool module
jest.mock("../config/database", () => {
  // Create an in-memory instance of postgres
  const pgMem = newDb();

  // Create the boards table
  pgMem.public.query(`
    CREATE TABLE boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      nsfw BOOLEAN DEFAULT FALSE
    )
  `);

  // Insert test data
  pgMem.public.query(`
    INSERT INTO boards (id, name, description, nsfw)
    VALUES
      ('tech', 'Technology', 'Tech discussion', false),
      ('random', 'Random', 'Random discussion', true)
  `);

  // Return the mock pool
  return {
    pool: pgMem.adapters.createPool(),
  };
});

describe("Board Model", () => {
  describe("getAllBoards", () => {
    it("should return all boards", async () => {
      const boards = await boardModel.getAllBoards();

      expect(boards).toHaveLength(2);
      expect(boards[0]).toHaveProperty("id", "tech");
      expect(boards[1]).toHaveProperty("id", "random");

      // Verify NSFW property
      expect(boards[0].nsfw).toBe(false);
      expect(boards[1].nsfw).toBe(true);
    });
  });

  describe("getBoardById", () => {
    it("should return a board when found", async () => {
      const board = await boardModel.getBoardById("tech");

      expect(board).not.toBeNull();
      expect(board).toHaveProperty("id", "tech");
      expect(board).toHaveProperty("name", "Technology");
      expect(board).toHaveProperty("description", "Tech discussion");
    });

    it("should return null when board not found", async () => {
      const board = await boardModel.getBoardById("nonexistent");

      expect(board).toBeNull();
    });
  });

  describe("createBoard", () => {
    it("should create and return a new board", async () => {
      const newBoard = {
        id: "test",
        name: "Test Board",
        description: "Board for testing",
        nsfw: false,
      };

      const board = await boardModel.createBoard(newBoard);

      expect(board).not.toBeNull();
      expect(board).toHaveProperty("id", "test");
      expect(board).toHaveProperty("name", "Test Board");

      // Verify board was added to database
      const allBoards = await boardModel.getAllBoards();
      expect(allBoards).toHaveLength(3);
    });
  });
});
