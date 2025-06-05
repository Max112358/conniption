// backend/routes/posts.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId and threadId
const postModel = require("../models/post");
const threadModel = require("../models/thread");
const { uploadWithUrlTransform } = require("../middleware/upload");
const io = require("../utils/socketHandler").getIo;

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
  console.log(`Route: POST /api/boards/${boardId}/threads/${threadId}/posts`);

  try {
    // Validate request
    if (!content) {
      console.log(`Route: Invalid request - missing content`);
      return res.status(400).json({ error: "Content is required" });
    }

    // Check if thread exists
    const thread = await threadModel.getThreadById(threadId, boardId);
    if (!thread) {
      console.log(`Route: Thread not found - ${threadId}`);
      return res.status(404).json({ error: "Thread not found" });
    }

    // Create post
    // req.file.location now contains the R2.dev public URL
    const imageUrl = req.file ? req.file.location : null;

    // Log file info if present
    if (req.file) {
      console.log(
        `Route: File type: ${req.file.fileType}, Size: ${req.file.size} bytes`
      );
    }

    const result = await postModel.createPost(
      threadId,
      boardId,
      content,
      imageUrl
    );

    // Notify connected clients about the new post
    const socketIo = io();
    if (socketIo) {
      const roomId = `${boardId}-${threadId}`;
      console.log(`Emitting post_created event to room ${roomId}`);
      socketIo.to(roomId).emit("post_created", {
        postId: result.postId,
        threadId,
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
