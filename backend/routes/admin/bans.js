// backend/routes/admin/bans.js
const express = require("express");
const router = express.Router();
const adminModel = require("../../models/admin");
const banModel = require("../../models/ban");
const adminAuth = require("../../middleware/adminAuth");

/**
 * @route   GET /api/admin/bans
 * @desc    Get active bans
 * @access  Private (any admin role)
 */
router.get("/", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/bans - by ${req.session.adminUser.username}`
  );

  try {
    // Filter by board ID if provided
    const boardId = req.query.boardId;

    // If board ID specified, check permission
    if (boardId && req.session.adminUser.role !== "admin") {
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

    const bans = await banModel.getActiveBans(boardId);
    res.json({ bans });
  } catch (error) {
    console.error("Route Error - GET /api/admin/bans:", error);
    next(error);
  }
});

/**
 * @route   POST /api/admin/bans
 * @desc    Create a new ban
 * @access  Private (any admin role)
 */
router.post("/", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: POST /api/admin/bans - by ${req.session.adminUser.username}`
  );

  try {
    const { ip_address, board_id, reason, expires_at } = req.body;

    // Validate input
    if (!ip_address || !reason) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["ip_address", "reason"],
      });
    }

    // Check board permission if board_id provided
    if (board_id && req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to moderate this board" });
      }
    }

    const ban = await banModel.createBan({
      ip_address,
      board_id,
      reason,
      expires_at: expires_at || null,
      admin_user_id: req.session.adminUser.id,
    });

    res.status(201).json({
      message: "Ban created successfully",
      ban,
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/bans:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/bans/:banId
 * @desc    Get ban by ID
 * @access  Private (any admin role)
 */
router.get("/:banId", adminAuth.requireAuth, async (req, res, next) => {
  const { banId } = req.params;
  console.log(
    `Route: GET /api/admin/bans/${banId} - by ${req.session.adminUser.username}`
  );

  try {
    const ban = await banModel.getBanById(banId);

    if (!ban) {
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin" && ban.board_id) {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        ban.board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to view this ban" });
      }
    }

    res.json({ ban });
  } catch (error) {
    console.error(`Route Error - GET /api/admin/bans/${banId}:`, error);
    next(error);
  }
});

/**
 * @route   PUT /api/admin/bans/:banId
 * @desc    Update ban
 * @access  Private (any admin role)
 */
router.put("/:banId", adminAuth.requireAuth, async (req, res, next) => {
  const { banId } = req.params;
  console.log(
    `Route: PUT /api/admin/bans/${banId} - by ${req.session.adminUser.username}`
  );

  try {
    // First get the ban to check permissions
    const existingBan = await banModel.getBanById(banId);

    if (!existingBan) {
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin" && existingBan.board_id) {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        existingBan.board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to modify this ban" });
      }
    }

    const { reason, expires_at, is_active, appeal_status } = req.body;

    const updates = {
      admin_user_id: req.session.adminUser.id, // For action logging
    };

    if (reason !== undefined) updates.reason = reason;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (is_active !== undefined) updates.is_active = is_active;
    if (appeal_status !== undefined) {
      // Validate appeal status
      if (!["none", "pending", "approved", "denied"].includes(appeal_status)) {
        return res.status(400).json({
          error: "Invalid appeal status",
          allowed: ["none", "pending", "approved", "denied"],
        });
      }
      updates.appeal_status = appeal_status;
    }

    const updatedBan = await banModel.updateBan(banId, updates);

    res.json({
      message: "Ban updated successfully",
      ban: updatedBan,
    });
  } catch (error) {
    console.error(`Route Error - PUT /api/admin/bans/${banId}:`, error);
    next(error);
  }
});

module.exports = router;
