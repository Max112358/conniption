// backend/routes/threads.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const { uploadWithUrlTransform } = require("../middleware/upload"); // Changed to use the URL transform
const postRoutes = require("./posts");
const io = require("../utils/socketHandler").getIo;
const getClientIp = require("../utils/getClientIp"); // Import the new utility

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

    // In the updated version, image_path from the database is actually the full R2 URL
    // We don't need to modify it here as the model will now return the full URL

    res.json({ threads: threads });
  } catch (error) {
    console.error(`Route Error - GET /api/boards/${boardId}/threads:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/boards/:boardId/threads
 * @desc    Create a new thread with initial post
 */
// Changed from upload.single to uploadWithUrlTransform to use our URL transformation
router.post("/", uploadWithUrlTransform("image"), async (req, res, next) => {
  const { boardId } = req.params;
  const { topic, content } = req.body;
  const ipAddress = getClientIp(req); // Use the new utility

  console.log(`Route: POST /api/boards/${boardId}/threads`);
  console.log(`Thread topic: "${topic}"`);
  console.log(`IP Address: ${ipAddress}`);
  console.log(`Request headers:`, {
    "cf-connecting-ip": req.headers["cf-connecting-ip"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-real-ip": req.headers["x-real-ip"],
    "true-client-ip": req.headers["true-client-ip"],
  });

  try {
    // Validate request
    if (!topic || !content) {
      console.log(`Route: Invalid request - missing topic or content`);
      return res.status(400).json({ error: "Topic and content are required" });
    }

    if (!req.file) {
      console.log(`Route: Invalid request - missing media file`);
      return res.status(400).json({ error: "Image or video is required" });
    }

    // Check if board exists and get board settings
    const board = await boardModel.getBoardById(boardId);
    if (!board) {
      console.log(`Route: Board not found - ${boardId}`);
      return res.status(404).json({ error: "Board not found" });
    }

    // Extract board settings
    const boardSettings = {
      thread_ids_enabled: board.thread_ids_enabled,
      country_flags_enabled: board.country_flags_enabled,
    };

    // Log file info
    console.log(
      `Route: File type: ${req.file.fileType}, Size: ${req.file.size} bytes`
    );

    // Create thread
    // req.file.location now contains the transformed URL with custom domain
    const result = await threadModel.createThread(
      boardId,
      topic,
      content,
      req.file.location,
      ipAddress,
      boardSettings
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
