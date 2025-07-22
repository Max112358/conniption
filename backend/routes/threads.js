// backend/routes/threads.js - Updated with stats tracking
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const { uploadWithUrlTransform } = require("../middleware/upload"); // Changed to use the URL transform
const postRoutes = require("./posts");
const io = require("../utils/socketHandler").getIo;
const getClientIp = require("../utils/getClientIp"); // Import the new utility
const checkBannedIP = require("../middleware/banCheck"); // Import ban check middleware
const { pool } = require("../config/database");
const adminAuth = require("../middleware/adminAuth");
const threadConfig = require("../config/threads");
const postsConfig = require("../config/posts"); // Import posts config
const {
  postCreationLimiter,
  uploadLimiter,
  validateContent,
} = require("../middleware/security");
const { trackPostCreation } = require("../middleware/statsTracking"); // Import stats tracking

// Import validators
const validators = require("../middleware/validators");

// Use post routes
router.use("/:threadId/posts", postRoutes);

/**
 * @route   GET /api/boards/:boardId/threads
 * @desc    Get threads for a specific board
 */
router.get("/", validators.validateBoard, async (req, res, next) => {
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

    res.json({
      threads: threads,
      config: {
        bumpLimit: threadConfig.bumpLimit,
        maxThreadsPerBoard: threadConfig.maxThreadsPerBoard,
      },
    });
  } catch (error) {
    console.error(`Route Error - GET /api/boards/${boardId}/threads:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/boards/:boardId/threads
 * @desc    Create a new thread with initial post
 */
// Apply checkBannedIP middleware BEFORE upload to block banned users early
router.post(
  "/",
  // First validate the board ID
  validators.validateBoard,
  // Then check if user is banned
  checkBannedIP,
  // Apply rate limiting
  postCreationLimiter,
  uploadLimiter,
  // Add stats tracking
  trackPostCreation,
  // Handle file upload and URL transformation
  uploadWithUrlTransform("image"),
  // Custom validation for thread creation
  async (req, res, next) => {
    console.log("=== THREAD CREATION VALIDATION DEBUG ===");
    console.log("Request body:", req.body);
    console.log(
      "Request file:",
      req.file
        ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            location: req.file.location,
          }
        : "No file"
    );
    console.log("Request params:", req.params);

    const { topic, content } = req.body;
    const errors = [];

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      errors.push({ field: "topic", message: "Topic is required" });
    } else if (topic.trim().length > 100) {
      errors.push({
        field: "topic",
        message: "Topic must be 100 characters or less",
      });
    }

    // Validate content
    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      errors.push({ field: "content", message: "Content is required" });
    } else if (
      postsConfig.characterLimit &&
      content.trim().length > postsConfig.characterLimit
    ) {
      errors.push({
        field: "content",
        message: `Content must be ${postsConfig.characterLimit} characters or less`,
      });
    }

    // Validate file
    if (!req.file) {
      errors.push({
        field: "image",
        message: "Image or video file is required for new threads",
      });
    }

    if (errors.length > 0) {
      console.log("Validation errors:", errors);
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    console.log("Validation passed, proceeding to create thread");
    next();
  },
  async (req, res, next) => {
    const { boardId } = req.params;
    const { topic, content } = req.body;
    const ipAddress = getClientIp(req); // Use the new utility

    console.log(`Route: POST /api/boards/${boardId}/threads`);
    console.log(`Thread topic: "${topic}"`);
    console.log(`Thread content: "${content}"`);
    console.log(`IP Address: ${ipAddress}`);
    console.log(
      `File info:`,
      req.file
        ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            location: req.file.location,
            fileType: req.file.fileType,
          }
        : "No file"
    );

    try {
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
        topic.trim(),
        content.trim(),
        req.file.location,
        ipAddress,
        boardSettings
      );

      console.log(`Route: Thread created successfully:`, result);

      // Track post creation in statistics (the initial post of the thread)
      if (res.locals.trackPost) {
        await res.locals.trackPost(boardId);
      }

      // Notify connected clients about the new thread
      const socketIo = io();
      if (socketIo) {
        console.log(`Emitting thread_created event to board ${boardId}`);
        socketIo.to(boardId).emit("thread_created", {
          threadId: result.threadId,
          boardId,
          topic: topic.trim(),
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
        postId: result.postId,
      });
    } catch (error) {
      console.error(
        `Route Error - POST /api/boards/${boardId}/threads:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   GET /api/boards/:boardId/threads/:threadId
 * @desc    Get a specific thread
 */
router.get("/:threadId", validators.validateThread, async (req, res, next) => {
  const { boardId, threadId } = req.params;
  console.log(`Route: GET /api/boards/${boardId}/threads/${threadId}`);

  try {
    const thread = await threadModel.getThreadById(threadId, boardId);

    if (!thread) {
      console.log(`Route: Thread not found - ${threadId}`);
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({
      thread,
      config: {
        bumpLimit: threadConfig.bumpLimit,
      },
    });
  } catch (error) {
    console.error(
      `Route Error - GET /api/boards/${boardId}/threads/${threadId}:`,
      error
    );
    next(error);
  }
});

/**
 * @route   DELETE /api/boards/:boardId/threads/:threadId
 * @desc    Delete a thread (by original poster or admin)
 * @access  Public (but requires IP match or admin auth)
 */
router.delete(
  "/:threadId",
  validators.validateThread,
  async (req, res, next) => {
    const { boardId, threadId } = req.params;
    const ipAddress = getClientIp(req);

    console.log(`Route: DELETE /api/boards/${boardId}/threads/${threadId}`);
    console.log(`Request IP: ${ipAddress}`);
    console.log(`Admin user: ${req.session?.adminUser?.username || "none"}`);

    try {
      // First, get the thread creator's IP from the first post
      const firstPostResult = await pool.query(
        `SELECT p.ip_address, p.content, p.image_url 
       FROM posts p
       WHERE p.thread_id = $1 AND p.board_id = $2
       ORDER BY p.created_at ASC
       LIMIT 1`,
        [threadId, boardId]
      );

      if (firstPostResult.rows.length === 0) {
        console.log(`Route: Thread not found - ${threadId}`);
        return res.status(404).json({ error: "Thread not found" });
      }

      const firstPost = firstPostResult.rows[0];
      const isOwner = firstPost.ip_address === ipAddress;
      const isAdmin =
        req.session?.adminUser &&
        ["admin", "moderator", "janitor"].includes(req.session.adminUser.role);

      console.log(
        `Route: Thread creator IP: ${firstPost.ip_address}, Request IP: ${ipAddress}, Is Owner: ${isOwner}, Is Admin: ${isAdmin}`
      );

      // Check authorization
      if (!isOwner && !isAdmin) {
        console.log(
          `Route: Unauthorized deletion attempt for thread ${threadId}`
        );
        return res
          .status(403)
          .json({ error: "Not authorized to delete this thread" });
      }

      // If admin and not owner, check board permissions
      if (isAdmin && !isOwner && req.session.adminUser.role !== "admin") {
        const adminModel = require("../models/admin");
        const canModerate = adminModel.canModerateBoard(
          req.session.adminUser,
          boardId
        );
        if (!canModerate) {
          return res
            .status(403)
            .json({ error: "Not authorized to moderate this board" });
        }
      }

      // Check if this is a moderation action (has reason in body) or user self-deletion
      const isModerationAction =
        isAdmin && req.body && req.body.reason !== undefined;

      // Use different deletion logic based on who's deleting and how
      if (!isModerationAction) {
        // User deleting their own thread OR admin using regular delete button - direct deletion
        console.log(
          `Route: Direct deletion of thread ${threadId} by ${
            isOwner ? "owner" : "admin without moderation"
          }`
        );

        // Use threadModel.deleteThread which handles image cleanup
        const deleted = await threadModel.deleteThread(threadId, boardId);

        if (!deleted) {
          return res.status(500).json({ error: "Failed to delete thread" });
        }
      } else {
        // Admin deletion with moderation - use moderation system
        console.log(
          `Route: Admin ${req.session.adminUser.username} deleting thread ${threadId} with moderation`
        );

        const moderationModel = require("../models/moderation");
        const deleted = await moderationModel.deleteThread({
          thread_id: threadId,
          board_id: boardId,
          reason:
            req.body && req.body.reason
              ? req.body.reason
              : "Deleted by moderator",
          ip_address: firstPost.ip_address || "Unknown",
          admin_user_id: req.session.adminUser.id,
        });

        if (!deleted) {
          return res.status(500).json({ error: "Failed to delete thread" });
        }
      }

      // Notify connected clients about the deleted thread
      const socketIo = io();
      if (socketIo) {
        console.log(`Emitting thread_deleted event to board ${boardId}`);

        socketIo.to(boardId).emit("thread_deleted", {
          threadId: parseInt(threadId),
          boardId,
        });
      }

      res.json({
        message: "Thread deleted successfully",
        deletedBy: !isModerationAction
          ? isOwner
            ? "owner"
            : "admin-direct"
          : "admin-moderation",
      });
    } catch (error) {
      console.error(
        `Route Error - DELETE /api/boards/${boardId}/threads/${threadId}:`,
        error
      );
      next(error);
    }
  }
);

module.exports = router;
