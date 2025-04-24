// backend/routes/threads.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId
const path = require("path");
const fs = require("fs");
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const upload = require("../middleware/upload");
const postRoutes = require("./posts");
const io = require("../utils/socketHandler").getIo;

// Use post routes
router.use("/:threadId/posts", postRoutes);

/**
 * @route   GET /api/boards/:boardId/threads
 * @desc    Get threads for a specific board
 */
router.get("/", async (req, res, next) => {
  const { boardId } = req.params;
  console.log(`Route: GET /api/boards/${boardId}/threads`);

  try {
    // First check if board exists
    const board = await boardModel.getBoardById(boardId);
    if (!board) {
      console.log(`Route: Board not found - ${boardId}`);
      return res.status(404).json({ error: "Board not found" });
    }

    // Get threads
    const threads = await threadModel.getThreadsByBoardId(boardId);

    // Transform the result to provide image_url instead of image_path
    const threadsWithImageUrls = threads.map((thread) => ({
      ...thread,
      image_url: thread.image_path
        ? `${req.protocol}://${req.get("host")}/uploads/${path.basename(
            thread.image_path
          )}`
        : null,
    }));

    res.json({ threads: threadsWithImageUrls });
  } catch (error) {
    console.error(`Route Error - GET /api/boards/${boardId}/threads:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/boards/:boardId/threads
 * @desc    Create a new thread with initial post
 */
router.post("/", upload.single("image"), async (req, res, next) => {
  const { boardId } = req.params;
  const { topic, content } = req.body;
  console.log(`Route: POST /api/boards/${boardId}/threads`);
  console.log(`Thread topic: "${topic}"`);

  try {
    // Validate request
    if (!topic || !content) {
      console.log(`Route: Invalid request - missing topic or content`);
      return res.status(400).json({ error: "Topic and content are required" });
    }

    if (!req.file) {
      console.log(`Route: Invalid request - missing image`);
      return res.status(400).json({ error: "Image is required" });
    }

    // Check if board exists
    const board = await boardModel.getBoardById(boardId);
    if (!board) {
      console.log(`Route: Board not found - ${boardId}`);

      // Delete uploaded file since we're rejecting the request
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      return res.status(404).json({ error: "Board not found" });
    }

    // Create thread
    const result = await threadModel.createThread(
      boardId,
      topic,
      content,
      req.file.path
    );

    // Notify connected clients about the new thread
    const socketIo = io();
    if (socketIo) {
      console.log(`Emitting thread_created event to board ${boardId}`);
      socketIo.to(boardId).emit("thread_created", {
        threadId: result.threadId,
        boardId,
        topic,
      });
    } else {
      console.log(
        `Warning: Socket.io not available for emitting thread_created event`
      );
    }

    res.status(201).json({
      message: "Thread created successfully",
      threadId: result.threadId,
      boardId,
    });
  } catch (error) {
    console.error(`Route Error - POST /api/boards/${boardId}/threads:`, error);

    // Delete uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/threads/:threadId
 * @desc    Get a specific thread
 */
router.get("/:threadId", async (req, res, next) => {
  const { boardId, threadId } = req.params;
  console.log(`Route: GET /api/boards/${boardId}/threads/${threadId}`);

  try {
    const thread = await threadModel.getThreadById(threadId, boardId);

    if (!thread) {
      console.log(`Route: Thread not found - ${threadId}`);
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ thread });
  } catch (error) {
    console.error(
      `Route Error - GET /api/boards/${boardId}/threads/${threadId}:`,
      error
    );
    next(error);
  }
});

module.exports = router;
