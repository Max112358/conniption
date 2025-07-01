// backend/routes/posts.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId and threadId
const postModel = require("../models/post");
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const { uploadWithUrlTransform } = require("../middleware/upload");
const io = require("../utils/socketHandler").getIo;
const getClientIp = require("../utils/getClientIp"); // Import the new utility

/**
 * @route   GET /api/boards/:boardId/threads/:threadId/posts
 * @desc    Get posts for a specific thread
 */
router.get("/", async (req, res, next) => {
  const { boardId, threadId } = req.params;
  console.log(`Route: GET /api/boards/${boardId}/threads/${threadId}/posts`);

  try {
    // Check if thread exists
    const thread = await threadModel.getThreadById(threadId, boardId);
    if (!thread) {
      console.log(`Route: Thread not found - ${threadId}`);
      return res.status(404).json({ error: "Thread not found" });
    }

    // Get posts
    const posts = await postModel.getPostsByThreadId(threadId, boardId);

    // The posts model now returns the image_url directly from the database
    res.json({ posts: posts });
  } catch (error) {
    console.error(
      `Route Error - GET /api/boards/${boardId}/threads/${threadId}/posts:`,
      error
    );
    next(error);
  }
});

/**
 * @route   POST /api/boards/:boardId/threads/:threadId/posts
 * @desc    Create a new post in a thread
 */
router.post("/", uploadWithUrlTransform("image"), async (req, res, next) => {
  const { boardId, threadId } = req.params;
  const { content } = req.body;
  const ipAddress = getClientIp(req); // Use the new utility

  console.log(`Route: POST /api/boards/${boardId}/threads/${threadId}/posts`);
  console.log(`IP Address: ${ipAddress}`);
  console.log(`Request headers:`, {
    "cf-connecting-ip": req.headers["cf-connecting-ip"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-real-ip": req.headers["x-real-ip"],
    "true-client-ip": req.headers["true-client-ip"],
  });

  try {
    // Validate request - allow either content OR image
    if (!content && !req.file) {
      console.log(`Route: Invalid request - missing both content and image`);
      return res
        .status(400)
        .json({ error: "Either content or an image/video is required" });
    }

    // Check if thread exists and get thread salt
    const thread = await threadModel.getThreadById(threadId, boardId);
    if (!thread) {
      console.log(`Route: Thread not found - ${threadId}`);
      return res.status(404).json({ error: "Thread not found" });
    }

    // Get board settings
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

    // Create post
    // req.file.location now contains the R2.dev public URL
    const imageUrl = req.file ? req.file.location : null;

    // Log file info if present
    if (req.file) {
      console.log(
        `Route: File type: ${req.file.fileType}, Size: ${req.file.size} bytes`
      );
    }

    // If no content provided, use empty string
    const postContent = content || "";

    const result = await postModel.createPost(
      threadId,
      boardId,
      postContent,
      imageUrl,
      ipAddress,
      boardSettings,
      thread.thread_salt
    );

    // Notify connected clients about the new post
    const socketIo = io();
    if (socketIo) {
      const roomId = `${boardId}-${threadId}`;
      console.log(`Emitting post_created event to room ${roomId}`);
      // Emit to the thread room
      socketIo.to(roomId).emit("post_created", {
        postId: result.postId,
        threadId: parseInt(threadId), // Ensure threadId is a number
        boardId,
      });

      // Also emit to the board room for board page updates
      socketIo.to(boardId).emit("post_created", {
        postId: result.postId,
        threadId: parseInt(threadId),
        boardId,
      });
    } else {
      console.log(
        `Warning: Socket.io not available for emitting post_created event`
      );
    }

    res.status(201).json({
      message: "Post created successfully",
      postId: result.postId,
      threadId,
      boardId,
    });
  } catch (error) {
    console.error(
      `Route Error - POST /api/boards/${boardId}/threads/${threadId}/posts:`,
      error
    );
    next(error);
  }
});

module.exports = router;
