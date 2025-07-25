// backend/routes/admin/moderation.js
const express = require("express");
const router = express.Router();
const { pool } = require("../../config/database");
const adminModel = require("../../models/admin");
const moderationModel = require("../../models/moderation");
const postModel = require("../../models/post");
const adminAuth = require("../../middleware/adminAuth");
const ipActionHistoryModel = require("../../models/ipActionHistory");

/**
 * @route   GET /api/admin/posts/:postId/ip
 * @desc    Get IP address for a specific post
 * @access  Private (moderator or admin)
 */
router.get(
  "/posts/:postId/ip",
  adminAuth.requireModerator,
  async (req, res, next) => {
    const { postId } = req.params;
    const { boardId, threadId } = req.query;

    console.log(
      `Route: GET /api/admin/posts/${postId}/ip - by ${req.session.adminUser.username}`
    );

    try {
      // Validate required query parameters
      if (!boardId || !threadId) {
        return res.status(400).json({
          error: "Missing required query parameters",
          required: ["boardId", "threadId"],
        });
      }

      // Check board permission if not admin
      if (req.session.adminUser.role !== "admin") {
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

      // Get post IP address from database
      const result = await pool.query(
        `SELECT ip_address, content, image_url 
       FROM posts 
       WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
        [postId, threadId, boardId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Post not found" });
      }

      const post = result.rows[0];

      // Log the IP lookup for audit purposes
      await pool.query(
        `INSERT INTO moderation_actions 
       (admin_user_id, action_type, board_id, thread_id, post_id, reason, ip_address)
       VALUES ($1, 'view_ip', $2, $3, $4, $5, $6)`,
        [
          req.session.adminUser.id,
          boardId,
          threadId,
          postId,
          `Viewed IP for post ${postId}`,
          post.ip_address,
        ]
      );

      // Also record in IP action history
      await ipActionHistoryModel.recordAction({
        ip_address: post.ip_address,
        action_type: "view_ip",
        admin_user_id: req.session.adminUser.id,
        admin_username: req.session.adminUser.username,
        board_id: boardId,
        thread_id: threadId,
        post_id: postId,
        reason: `IP address viewed for post ${postId}`,
        details: {
          content_preview: post.content ? post.content.substring(0, 50) : null,
          had_image: !!post.image_url,
        },
      });

      console.log(
        `Route: Admin ${req.session.adminUser.username} viewed IP ${post.ip_address} for post ${postId}`
      );

      res.json({
        ip_address: post.ip_address || "Unknown",
        post_content: post.content,
        image_url: post.image_url,
      });
    } catch (error) {
      console.error(`Route Error - GET /api/admin/posts/${postId}/ip:`, error);
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/posts/:postId/color
 * @desc    Change the color of a post
 * @access  Private (moderator or admin only, NOT janitors)
 */
router.put(
  "/posts/:postId/color",
  adminAuth.requireModerator,
  async (req, res, next) => {
    const { postId } = req.params;
    const { boardId, threadId, color, reason } = req.body;

    console.log(
      `Route: PUT /api/admin/posts/${postId}/color - by ${req.session.adminUser.username}`
    );

    try {
      // Validate input
      if (!boardId || !threadId || !color) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["boardId", "threadId", "color"],
        });
      }

      // Validate color
      const validColors = [
        "black",
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "purple",
        "brown",
      ];
      if (!validColors.includes(color)) {
        return res.status(400).json({
          error: "Invalid color",
          allowed: validColors,
        });
      }

      // Check board permission if not admin
      if (req.session.adminUser.role !== "admin") {
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

      // Change the post color using the moderation model
      const updatedPost = await moderationModel.changePostColor({
        post_id: postId,
        thread_id: threadId,
        board_id: boardId,
        color: color,
        reason: reason || `Changed to ${color}`,
        admin_user_id: req.session.adminUser.id,
        admin_username: req.session.adminUser.username,
      });

      if (!updatedPost) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Notify connected clients about the color change
      const io = require("../../utils/socketHandler").getIo;
      const socketIo = io();
      if (socketIo) {
        const roomId = `${boardId}-${threadId}`;
        console.log(`Emitting post_color_changed event to room ${roomId}`);

        socketIo.to(roomId).emit("post_color_changed", {
          postId: parseInt(postId),
          threadId: parseInt(threadId),
          boardId,
          color: color,
        });

        // Also emit to board room
        socketIo.to(boardId).emit("post_color_changed", {
          postId: parseInt(postId),
          threadId: parseInt(threadId),
          boardId,
          color: color,
        });
      }

      res.json({
        message: "Post color changed successfully",
        post: updatedPost,
      });
    } catch (error) {
      console.error(
        `Route Error - PUT /api/admin/posts/${postId}/color:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/threads/:threadId
 * @desc    Delete a thread
 * @access  Private (any admin role)
 */
router.delete(
  "/threads/:threadId",
  adminAuth.requireAuth,
  async (req, res, next) => {
    const { threadId } = req.params;
    const { boardId, reason, ip_address } = req.body;

    console.log(
      `Route: DELETE /api/admin/threads/${threadId} - by ${req.session.adminUser.username}`
    );

    try {
      // Validate input
      if (!boardId || !reason) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["boardId", "reason"],
        });
      }

      // Check permission if not admin
      if (req.session.adminUser.role !== "admin") {
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

      const deleted = await moderationModel.deleteThread({
        thread_id: threadId,
        board_id: boardId,
        reason,
        ip_address: ip_address || "Unknown",
        admin_user_id: req.session.adminUser.id,
        admin_username: req.session.adminUser.username,
      });

      if (!deleted) {
        return res.status(404).json({ error: "Thread not found" });
      }

      res.json({ message: "Thread deleted successfully" });
    } catch (error) {
      console.error(
        `Route Error - DELETE /api/admin/threads/${threadId}:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/posts/:postId
 * @desc    Delete a post
 * @access  Private (any admin role)
 */
router.delete(
  "/posts/:postId",
  adminAuth.requireAuth,
  async (req, res, next) => {
    const { postId } = req.params;
    const { boardId, threadId, reason } = req.body;

    console.log(
      `Route: DELETE /api/admin/posts/${postId} - by ${req.session.adminUser.username}`
    );

    try {
      // Validate input
      if (!boardId || !threadId || !reason) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["boardId", "threadId", "reason"],
        });
      }

      // Check permission if not admin
      if (req.session.adminUser.role !== "admin") {
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

      const result = await moderationModel.deletePost({
        post_id: postId,
        thread_id: threadId,
        board_id: boardId,
        reason,
        admin_user_id: req.session.adminUser.id,
        admin_username: req.session.adminUser.username,
      });

      if (!result.success) {
        return res.status(404).json({ error: "Post not found" });
      }

      res.json({
        message: "Post deleted successfully",
        ipAddress: result.ipAddress,
        postContent: result.postContent,
        imageUrl: result.imageUrl,
      });
    } catch (error) {
      console.error(`Route Error - DELETE /api/admin/posts/${postId}:`, error);
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/posts/:postId
 * @desc    Edit a post
 * @access  Private (any admin role)
 */
router.put("/posts/:postId", adminAuth.requireAuth, async (req, res, next) => {
  const { postId } = req.params;
  const { boardId, threadId, content, reason, ip_address } = req.body;

  console.log(
    `Route: PUT /api/admin/posts/${postId} - by ${req.session.adminUser.username}`
  );

  try {
    // Validate input
    if (!boardId || !threadId || !content || !reason) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["boardId", "threadId", "content", "reason"],
      });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin") {
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

    const updatedPost = await moderationModel.editPost({
      post_id: postId,
      thread_id: threadId,
      board_id: boardId,
      content,
      reason,
      ip_address: ip_address || "Unknown",
      admin_user_id: req.session.adminUser.id,
      admin_username: req.session.adminUser.username,
    });

    if (!updatedPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({
      message: "Post edited successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error(`Route Error - PUT /api/admin/posts/${postId}:`, error);
    next(error);
  }
});

module.exports = router;
