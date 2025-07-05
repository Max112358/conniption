// backend/routes/admin/housekeeping.js
const express = require("express");
const router = express.Router();
const adminAuth = require("../../middleware/adminAuth");
const scheduledJobs = require("../../utils/scheduledJobs");

/**
 * @route   GET /api/admin/housekeeping/status
 * @desc    Get housekeeping job status
 * @access  Admin only
 */
router.get("/status", adminAuth.requireAdmin, (req, res) => {
  console.log(
    `Route: GET /api/admin/housekeeping/status - by ${req.session.adminUser.username}`
  );

  const status = scheduledJobs.getStatus();
  res.json({ status });
});

/**
 * @route   POST /api/admin/housekeeping/run
 * @desc    Manually trigger housekeeping
 * @access  Admin only
 */
router.post("/run", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: POST /api/admin/housekeeping/run - by ${req.session.adminUser.username}`
  );

  try {
    const results = await scheduledJobs.runHousekeepingNow();
    res.json({
      message: "Housekeeping completed successfully",
      results,
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/housekeeping/run:", error);
    next(error);
  }
});

module.exports = router;
