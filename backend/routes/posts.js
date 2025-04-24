// backend/routes/posts.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId and threadId
const path = require("path");
const fs = require("fs");
const postModel = require("../models/post");
const threadModel = require("../models/thread");
const upload = require("../middleware/upload");
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

    // Transform the result to provide image_url instead of image_path
    const postsWithImageUrls = posts.map((post) => ({
      ...post,
      image_url: post.image_path
        ? `${req.protocol}://${req.get("host")}/uploads/${path.basename(
            post.image_path
          )}`
        : null,
    }));

    res.json({ posts: postsWithImageUrls });
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
router.post("/", upload.single("image"), async (req, res, next) => {
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

      // Delete uploaded file if there was one
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      return res.status(404).json({ error: "Thread not found" });
    }

    // Create post
    const imagePath = req.file ? req.file.path : null;
    const result = await postModel.createPost(
      threadId,
      boardId,
      content,
      imagePath
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

    // Delete uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    next(error);
  }
});

module.exports = router;
