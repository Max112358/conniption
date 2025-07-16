// backend/routes/admin.js
const express = require("express");
const router = express.Router();

// Import sub-routes
const authRoutes = require("./admin/auth");
const usersRoutes = require("./admin/users");
const bansRoutes = require("./admin/bans");
const rangebanRoutes = require("./admin/rangebans");
const moderationRoutes = require("./admin/moderation");
const actionsRoutes = require("./admin/actions");
const housekeepingRoutes = require("./admin/housekeeping");
const stickyRoutes = require("./admin/sticky");

// Authentication routes (login, logout, profile)
router.use("/", authRoutes);

// User management routes
router.use("/users", usersRoutes);

// Ban management routes
router.use("/bans", bansRoutes);

// Sticky thread management routes
router.use("/boards", stickyRoutes);

// Rangeban management routes
router.use("/rangebans", rangebanRoutes);

// Moderation actions history routes
router.use("/actions", actionsRoutes);

// Housekeeping routes
router.use("/housekeeping", housekeepingRoutes);

// Content moderation routes (posts, threads)
// Note: These routes don't have a common prefix, so we mount them directly
router.use("/", moderationRoutes);

module.exports = router;
