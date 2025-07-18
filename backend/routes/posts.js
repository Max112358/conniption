// backend/routes/posts.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId and threadId
const { pool } = require("../config/database");
const postModel = require("../models/post");
const surveyModel = require("../models/survey");
const threadModel = require("../models/thread");
const boardModel = require("../models/board");
const banModel = require("../models/ban");
const { uploadWithUrlTransform } = require("../middleware/upload");
const io = require("../utils/socketHandler").getIo;
const getClientIp = require("../utils/getClientIp"); // Import the new utility
const checkBannedIP = require("../middleware/banCheck"); // Import ban check middleware
const postsConfig = require("../config/posts"); // Import posts config

/**
 * @route   GET /api/boards/:boardId/threads/:threadId/posts
 * @desc    Get posts for a specific thread
 */
router.get("/", async (req, res, next) => {
  const { boardId, threadId } = req.params;
  const { includeSurveys = "true" } = req.query; // Default to including surveys

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

    // Check for bans associated with each post
    const postsWithBanInfo = await Promise.all(
      posts.map(async (post) => {
        const bans = await banModel.getBansByPostId(post.id, boardId);
        return {
          ...post,
          isBanned: bans.length > 0,
          banInfo: bans.length > 0 ? bans[0] : null, // Include first ban info if exists
        };
      })
    );

    // Optionally get survey info for posts
    let finalPosts = postsWithBanInfo;

    if (includeSurveys === "true" && posts.length > 0) {
      // Get all post IDs
      const postIds = posts.map((p) => p.id);

      // Get surveys for these posts
      const surveys = await surveyModel.getSurveysByPostIds(postIds, boardId);

      // Create a map of post_id to survey info for efficient lookup
      const surveyMap = {};
      surveys.forEach((survey) => {
        surveyMap[survey.post_id] = survey;
      });

      // Add survey info to posts
      finalPosts = postsWithBanInfo.map((post) => {
        if (surveyMap[post.id]) {
          return { ...post, survey: surveyMap[post.id] };
        }
        return post;
      });
    }

    // Include thread dead status in response
    res.json({
      posts: finalPosts,
      thread: {
        is_dead: thread.is_dead,
        died_at: thread.died_at,
        post_count: thread.post_count,
      },
    });
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
// Apply checkBannedIP middleware BEFORE upload to block banned users early
router.post(
  "/",
  checkBannedIP,
  uploadWithUrlTransform("image"),
  async (req, res, next) => {
    const { boardId, threadId } = req.params;
    const { content, dont_bump } = req.body;
    const ipAddress = getClientIp(req); // Use the new utility

    console.log(`Route: POST /api/boards/${boardId}/threads/${threadId}/posts`);
    console.log(`IP Address: ${ipAddress}`);
    console.log(`Don't bump: ${dont_bump}`);
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

      // Check character limit if content is provided
      if (
        content &&
        postsConfig.characterLimit &&
        postsConfig.characterLimit > 0
      ) {
        if (content.length > postsConfig.characterLimit) {
          console.log(
            `Route: Post content exceeds character limit - ${content.length} characters (limit: ${postsConfig.characterLimit})`
          );
          return res.status(400).json({
            error: `Post content exceeds the maximum character limit of ${postsConfig.characterLimit} characters`,
            currentLength: content.length,
            maxLength: postsConfig.characterLimit,
          });
        }
      }

      // Check if thread exists and get thread salt
      const thread = await threadModel.getThreadById(threadId, boardId);
      if (!thread) {
        console.log(`Route: Thread not found - ${threadId}`);
        return res.status(404).json({ error: "Thread not found" });
      }

      // Check if thread is dead
      if (thread.is_dead) {
        console.log(`Route: Thread ${threadId} is dead - rejecting post`);
        return res.status(403).json({
          error:
            "This thread has been archived and no longer accepts new posts",
        });
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

      // Convert dont_bump to boolean
      const dontBump = dont_bump === "true" || dont_bump === true;

      const result = await postModel.createPost(
        threadId,
        boardId,
        postContent,
        imageUrl,
        ipAddress,
        boardSettings,
        thread.thread_salt,
        thread.is_dead, // Pass dead status to model
        dontBump // Pass dont_bump flag to model
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

      // Handle specific error for dead threads
      if (error.message === "Cannot post to a dead thread") {
        return res.status(403).json({
          error:
            "This thread has been archived and no longer accepts new posts",
        });
      }

      next(error);
    }
  }
);

/**
 * @route   DELETE /api/boards/:boardId/threads/:threadId/posts/:postId
 * @desc    Delete a post (by original poster or admin)
 * @access  Public (but requires IP match or admin auth)
 */
router.delete("/:postId", async (req, res, next) => {
  const { boardId, threadId, postId } = req.params;
  const ipAddress = getClientIp(req);

  console.log(
    `Route: DELETE /api/boards/${boardId}/threads/${threadId}/posts/${postId}`
  );
  console.log(`Request IP: ${ipAddress}`);
  console.log(`Admin user: ${req.session?.adminUser?.username || "none"}`);

  try {
    // First, get the post to check ownership
    const postResult = await pool.query(
      `SELECT id, ip_address, content, image_url 
       FROM posts 
       WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
      [postId, threadId, boardId]
    );

    if (postResult.rows.length === 0) {
      console.log(`Route: Post not found - ${postId}`);
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];
    const isOwner = post.ip_address === ipAddress;
    const isAdmin =
      req.session?.adminUser &&
      ["admin", "moderator", "janitor"].includes(req.session.adminUser.role);

    console.log(
      `Route: Post IP: ${post.ip_address}, Request IP: ${ipAddress}, Is Owner: ${isOwner}, Is Admin: ${isAdmin}`
    );

    // Check authorization
    if (!isOwner && !isAdmin) {
      console.log(`Route: Unauthorized deletion attempt for post ${postId}`);
      return res
        .status(403)
        .json({ error: "Not authorized to delete this post" });
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
      // User deleting their own post OR admin using regular delete button - direct deletion
      console.log(
        `Route: Direct deletion of post ${postId} by ${
          isOwner ? "owner" : "admin without moderation"
        }`
      );

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Delete the post
        await client.query(
          `DELETE FROM posts WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
          [postId, threadId, boardId]
        );

        // Update post count
        await client.query(
          `UPDATE threads SET post_count = post_count - 1 WHERE id = $1 AND board_id = $2`,
          [threadId, boardId]
        );

        // Delete image from R2 if exists
        if (post.image_url) {
          try {
            const fileUtils = require("../utils/fileUtils");
            await fileUtils.deleteFile(post.image_url);
            console.log(`Route: Deleted image from R2: ${post.image_url}`);
          } catch (err) {
            console.error(
              `Route: Failed to delete image: ${post.image_url}`,
              err
            );
          }
        }

        await client.query("COMMIT");
        console.log(`Route: Successfully deleted post ${postId}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Admin deletion with moderation - use moderation system
      console.log(
        `Route: Admin ${req.session.adminUser.username} deleting post ${postId} with moderation`
      );

      const moderationModel = require("../models/moderation");
      const result = await moderationModel.deletePost({
        post_id: postId,
        thread_id: threadId,
        board_id: boardId,
        reason:
          req.body && req.body.reason
            ? req.body.reason
            : "Deleted by moderator",
        admin_user_id: req.session.adminUser.id,
      });

      if (!result.success) {
        return res.status(500).json({ error: "Failed to delete post" });
      }
    }

    // Notify connected clients about the deleted post
    const socketIo = io();
    if (socketIo) {
      const roomId = `${boardId}-${threadId}`;
      console.log(`Emitting post_deleted event to room ${roomId}`);

      socketIo.to(roomId).emit("post_deleted", {
        postId: parseInt(postId),
        threadId: parseInt(threadId),
        boardId,
      });

      // Also emit to board room
      socketIo.to(boardId).emit("post_deleted", {
        postId: parseInt(postId),
        threadId: parseInt(threadId),
        boardId,
      });
    }

    res.json({
      message: "Post deleted successfully",
      deletedBy: !isModerationAction
        ? isOwner
          ? "owner"
          : "admin-direct"
        : "admin-moderation",
    });
  } catch (error) {
    console.error(
      `Route Error - DELETE /api/boards/${boardId}/threads/${threadId}/posts/${postId}:`,
      error
    );
    next(error);
  }
});

/**
 * @route   POST /api/boards/:boardId/threads/:threadId/posts/:postId/survey
 * @desc    Create a survey attached to a post - NO EXPIRATION
 * @access  Public (must be post owner)
 */
router.post("/:postId/survey", checkBannedIP, async (req, res, next) => {
  const { boardId, threadId, postId } = req.params;
  const { survey_type, question, options } = req.body; // REMOVED expires_at
  const ipAddress = getClientIp(req);

  console.log(
    `Route: POST /api/boards/${boardId}/threads/${threadId}/posts/${postId}/survey`
  );

  try {
    // Check if thread is dead
    const thread = await threadModel.getThreadById(threadId, boardId);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    if (thread.is_dead) {
      console.log(
        `Route: Thread ${threadId} is dead - rejecting survey creation`
      );
      return res.status(403).json({
        error: "Cannot create surveys in archived threads",
      });
    }

    // Validate input
    if (!survey_type || !question || !options) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["survey_type", "question", "options"],
      });
    }

    if (!["single", "multiple"].includes(survey_type)) {
      return res.status(400).json({
        error: "Invalid survey type",
        allowed: ["single", "multiple"],
      });
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 16) {
      return res.status(400).json({
        error: "Options must be an array with 2-16 items",
      });
    }

    // Check if user is the post owner
    const post = await postModel.getPostById(postId, boardId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.ip_address !== ipAddress) {
      return res.status(403).json({
        error: "Only the post owner can attach a survey",
      });
    }

    // Check if post already has a survey
    const existingSurvey = await surveyModel.getSurveyByPostId(postId, boardId);
    if (existingSurvey) {
      return res.status(409).json({
        error: "Post already has a survey attached",
      });
    }

    // Create survey WITHOUT expiration
    const survey = await surveyModel.createSurvey({
      post_id: parseInt(postId),
      thread_id: parseInt(threadId),
      board_id: boardId,
      survey_type,
      question,
      options,
      // NO expires_at field
    });

    console.log(`Route: Created survey ${survey.id} for post ${postId}`);
    res.status(201).json({
      message: "Survey created successfully",
      survey,
    });
  } catch (error) {
    console.error(`Route Error - POST survey:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/threads/:threadId/posts/:postId/survey
 * @desc    Get survey attached to a post - NO EXPIRATION CHECKS
 * @access  Public
 */
router.get("/:postId/survey", async (req, res, next) => {
  const { boardId, postId } = req.params;
  const ipAddress = getClientIp(req);

  console.log(
    `Route: GET /api/boards/${boardId}/threads/.../posts/${postId}/survey`
  );

  try {
    const survey = await surveyModel.getSurveyByPostId(postId, boardId);

    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }

    // NO expiration checks - surveys never expire

    // Get user's existing response if any
    const userResponse = await surveyModel.getUserResponse(
      survey.id,
      ipAddress
    );
    if (userResponse) {
      survey.user_response = userResponse;
    }

    res.json({ survey });
  } catch (error) {
    console.error(`Route Error - GET survey:`, error);
    next(error);
  }
});

module.exports = router;
