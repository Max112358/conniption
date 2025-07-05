// backend/routes/admin/actions.js
const express = require("express");
const router = express.Router();
const adminModel = require("../../models/admin");
const moderationModel = require("../../models/moderation");
const adminAuth = require("../../middleware/adminAuth");

/**
 * @route   GET /api/admin/actions
 * @desc    Get moderation actions
 * @access  Private (any admin role)
 */
router.get("/", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/actions - by ${req.session.adminUser.username}`
  );

  try {
    // Get query parameters for filtering
    const {
      admin_user_id,
      action_type,
      board_id,
      thread_id,
      post_id,
      ban_id,
      ip_address,
      start_date,
      end_date,
      limit,
      offset,
    } = req.query;

    // Check board permission if board_id provided
    if (board_id && req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to view actions for this board" });
      }
    }

    // For non-admins, limit to their own actions or boards they can moderate
    let filters = {};

    if (req.session.adminUser.role !== "admin") {
      // If board specified, they must be able to moderate it (already checked above)
      if (board_id) {
        filters.board_id = board_id;
      } else {
        // Limit to their assigned boards if they have specific boards
        if (
          req.session.adminUser.boards &&
          req.session.adminUser.boards.length > 0
        ) {
          // For now just filter by their user ID - this is simpler
          filters.admin_user_id = req.session.adminUser.id;
        }
      }
    } else {
      // Admins can see everything but still apply filters if provided
      if (admin_user_id) filters.admin_user_id = admin_user_id;
      if (board_id) filters.board_id = board_id;
    }

    // Apply other filters
    if (action_type) filters.action_type = action_type;
    if (thread_id) filters.thread_id = thread_id;
    if (post_id) filters.post_id = post_id;
    if (ban_id) filters.ban_id = ban_id;
    if (ip_address) filters.ip_address = ip_address;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const actions = await moderationModel.getModerationActions(filters);

    res.json({ actions });
  } catch (error) {
    console.error("Route Error - GET /api/admin/actions:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/actions/stats
 * @desc    Get moderation action statistics
 * @access  Private (admin and moderator)
 */
router.get("/stats", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/actions/stats - by ${req.session.adminUser.username}`
  );

  // Only admins and moderators can view stats
  if (req.session.adminUser.role === "janitor") {
    return res.status(403).json({ error: "Not authorized to view statistics" });
  }

  try {
    // Get query parameters for filtering
    const { admin_user_id, board_id, start_date, end_date } = req.query;

    // Admins can see all stats, moderators see only their assigned boards
    const filters = {};

    if (req.session.adminUser.role !== "admin") {
      // Moderators only see stats for their boards or their own actions
      if (board_id) {
        const canModerate = adminModel.canModerateBoard(
          req.session.adminUser,
          board_id
        );
        if (!canModerate) {
          return res
            .status(403)
            .json({ error: "Not authorized to view stats for this board" });
        }
        filters.board_id = board_id;
      } else {
        // Only see own actions if no specific board
        filters.admin_user_id = req.session.adminUser.id;
      }
    } else {
      // Admins can filter by user or board
      if (admin_user_id) filters.admin_user_id = admin_user_id;
      if (board_id) filters.board_id = board_id;
    }

    // Apply date filters
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const stats = await moderationModel.getModerationStats(filters);

    res.json({ stats });
  } catch (error) {
    console.error("Route Error - GET /api/admin/actions/stats:", error);
    next(error);
  }
});

module.exports = router;
