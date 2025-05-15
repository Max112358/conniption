// backend/routes/boards.js
const express = require("express");
const router = express.Router();
const boardModel = require("../models/board");
const threadRoutes = require("./threads");
const appealRoutes = require("./appeals");
const checkBannedIP = require("../middleware/banCheck");

// Use thread routes
router.use("/:boardId/threads", threadRoutes);

// Use appeal routes
router.use("/:boardId/appeal", appealRoutes);

// Apply ban check middleware to write operations
router.use("/:boardId/threads", checkBannedIP);

// Use thread routes
router.use("/:boardId/threads", threadRoutes);

/**
 * @route   GET /api/boards
 * @desc    Get all boards
 */
router.get("/", async (req, res, next) => {
  console.log("Route: GET /api/boards");
  try {
    const boards = await boardModel.getAllBoards();
    res.json({ boards });
  } catch (error) {
    console.error("Route Error - GET /api/boards:", error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId
 * @desc    Get a specific board
 */
router.get("/:boardId", async (req, res, next) => {
  const { boardId } = req.params;
  console.log(`Route: GET /api/boards/${boardId}`);

  try {
    const board = await boardModel.getBoardById(boardId);

    if (!board) {
      console.log(`Route: Board not found - ${boardId}`);
      return res.status(404).json({ error: "Board not found" });
    }

    res.json({ board });
  } catch (error) {
    console.error(`Route Error - GET /api/boards/${boardId}:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/boards
 * @desc    Create a new board (admin only)
 * @note    This is not used in the frontend but could be used for future admin functionality
 */
router.post("/", async (req, res, next) => {
  const { id, name, description } = req.body;
  console.log(`Route: POST /api/boards - Creating board ${id}`);

  // Validation
  if (!id || !name || !description) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["id", "name", "description"],
    });
  }

  try {
    const board = await boardModel.createBoard({ id, name, description });
    res.status(201).json({ board });
  } catch (error) {
    console.error("Route Error - POST /api/boards:", error);

    // Check for duplicate key error
    if (error.code === "23505") {
      // PostgreSQL unique violation
      return res.status(409).json({ error: "Board already exists" });
    }

    next(error);
  }
});

module.exports = router;
