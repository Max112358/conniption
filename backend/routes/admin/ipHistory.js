// backend/routes/admin/ipHistory.js
const express = require("express");
const router = express.Router();
const ipActionHistoryModel = require("../../models/ipActionHistory");
const adminAuth = require("../../middleware/adminAuth");
const getClientIp = require("../../utils/getClientIp");

/**
 * @route   GET /api/admin/ip-history/stats/actions
 * @desc    Get statistics about action types
 * @access  Admin only
 */
router.get("/stats/actions", adminAuth.requireAdmin, async (req, res, next) => {
  const { board_id, start_date, end_date } = req.query;

  console.log(
    `Route: GET /api/admin/ip-history/stats/actions - by ${req.session.adminUser.username}`
  );

  try {
    const options = {};
    if (board_id) options.board_id = board_id;
    if (start_date) options.start_date = start_date;
    if (end_date) options.end_date = end_date;

    const stats = await ipActionHistoryModel.getActionStatistics(options);

    res.json({ statistics: stats });
  } catch (error) {
    console.error(
      "Route Error - GET /api/admin/ip-history/stats/actions:",
      error
    );
    next(error);
  }
});

/**
 * @route   GET /api/admin/ip-history/search/current
 * @desc    Get action history for the requesting IP (for testing)
 * @access  Admin only
 */
router.get(
  "/search/current",
  adminAuth.requireAdmin,
  async (req, res, next) => {
    const ipAddress = getClientIp(req);

    console.log(
      `Route: GET /api/admin/ip-history/search/current - by ${req.session.adminUser.username} (IP: ${ipAddress})`
    );

    try {
      const actions = await ipActionHistoryModel.getActionsByIP(ipAddress);
      const summary = await ipActionHistoryModel.getIPSummary(ipAddress);

      res.json({
        ip_address: ipAddress,
        summary,
        actions,
        total: actions.length,
      });
    } catch (error) {
      console.error(
        "Route Error - GET /api/admin/ip-history/search/current:",
        error
      );
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/ip-history/:ipAddress
 * @desc    Get action history for a specific IP address
 * @access  Moderator or higher
 */
router.get(
  "/:ipAddress",
  adminAuth.requireModerator,
  async (req, res, next) => {
    const { ipAddress } = req.params;
    const { board_id, action_type, start_date, end_date, limit, offset } =
      req.query;

    console.log(
      `Route: GET /api/admin/ip-history/${ipAddress} - by ${req.session.adminUser.username}`
    );

    try {
      // Build options object
      const options = {};
      if (board_id) options.board_id = board_id;
      if (action_type) options.action_type = action_type;
      if (start_date) options.start_date = start_date;
      if (end_date) options.end_date = end_date;
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);

      // Get action history
      const actions = await ipActionHistoryModel.getActionsByIP(
        ipAddress,
        options
      );

      // Get summary
      const summary = await ipActionHistoryModel.getIPSummary(ipAddress);

      res.json({
        ip_address: ipAddress,
        summary,
        actions,
        total: actions.length,
      });
    } catch (error) {
      console.error(
        `Route Error - GET /api/admin/ip-history/${ipAddress}:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/ip-history/:ipAddress/summary
 * @desc    Get summary statistics for a specific IP address
 * @access  Moderator or higher
 */
router.get(
  "/:ipAddress/summary",
  adminAuth.requireModerator,
  async (req, res, next) => {
    const { ipAddress } = req.params;

    console.log(
      `Route: GET /api/admin/ip-history/${ipAddress}/summary - by ${req.session.adminUser.username}`
    );

    try {
      const summary = await ipActionHistoryModel.getIPSummary(ipAddress);

      res.json({ summary });
    } catch (error) {
      console.error(
        `Route Error - GET /api/admin/ip-history/${ipAddress}/summary:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/ip-history
 * @desc    Get problematic IPs with multiple actions
 * @access  Moderator or higher
 */
router.get("/", adminAuth.requireModerator, async (req, res, next) => {
  const { min_actions, days, limit } = req.query;

  console.log(
    `Route: GET /api/admin/ip-history - by ${req.session.adminUser.username}`
  );

  try {
    const options = {};
    if (min_actions) options.minActions = parseInt(min_actions);
    if (days) options.days = parseInt(days);
    if (limit) options.limit = parseInt(limit);

    const problematicIPs = await ipActionHistoryModel.getProblematicIPs(
      options
    );

    res.json({
      ips: problematicIPs,
      total: problematicIPs.length,
      filters: {
        min_actions: options.minActions || 5,
        days: options.days || 30,
        limit: options.limit || 100,
      },
    });
  } catch (error) {
    console.error("Route Error - GET /api/admin/ip-history:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/ip-history/stats/actions
 * @desc    Get statistics about action types
 * @access  Admin only
 */
router.get("/stats/actions", adminAuth.requireAdmin, async (req, res, next) => {
  const { board_id, start_date, end_date } = req.query;

  console.log(
    `Route: GET /api/admin/ip-history/stats/actions - by ${req.session.adminUser.username}`
  );

  try {
    const options = {};
    if (board_id) options.board_id = board_id;
    if (start_date) options.start_date = start_date;
    if (end_date) options.end_date = end_date;

    const stats = await ipActionHistoryModel.getActionStatistics(options);

    res.json({ statistics: stats });
  } catch (error) {
    console.error(
      "Route Error - GET /api/admin/ip-history/stats/actions:",
      error
    );
    next(error);
  }
});

/**
 * @route   POST /api/admin/ip-history/cleanup
 * @desc    Clean up old IP action history records
 * @access  Admin only
 */
router.post("/cleanup", adminAuth.requireAdmin, async (req, res, next) => {
  const { days_to_keep } = req.body;

  console.log(
    `Route: POST /api/admin/ip-history/cleanup - by ${req.session.adminUser.username}`
  );

  try {
    const daysToKeep = days_to_keep || 365;
    const deletedCount = await ipActionHistoryModel.cleanupOldActions(
      daysToKeep
    );

    // Log this admin action
    const { pool } = require("../../config/database");
    await pool.query(
      `INSERT INTO moderation_actions 
       (admin_user_id, action_type, reason, created_at)
       VALUES ($1, 'cleanup_ip_history', $2, CURRENT_TIMESTAMP)`,
      [
        req.session.adminUser.id,
        `Cleaned up IP history older than ${daysToKeep} days`,
      ]
    );

    res.json({
      message: `Successfully cleaned up ${deletedCount} old IP action records`,
      deleted_count: deletedCount,
      days_kept: daysToKeep,
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/ip-history/cleanup:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/ip-history/search/current
 * @desc    Get action history for the requesting IP (for testing)
 * @access  Admin only
 */
router.get(
  "/search/current",
  adminAuth.requireAdmin,
  async (req, res, next) => {
    const ipAddress = getClientIp(req);

    console.log(
      `Route: GET /api/admin/ip-history/search/current - by ${req.session.adminUser.username} (IP: ${ipAddress})`
    );

    try {
      const actions = await ipActionHistoryModel.getActionsByIP(ipAddress);
      const summary = await ipActionHistoryModel.getIPSummary(ipAddress);

      res.json({
        ip_address: ipAddress,
        summary,
        actions,
        total: actions.length,
      });
    } catch (error) {
      console.error(
        "Route Error - GET /api/admin/ip-history/search/current:",
        error
      );
      next(error);
    }
  }
);

module.exports = router;
