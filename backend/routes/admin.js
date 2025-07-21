// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
  requireAuth,
  requireAdmin,
  requireModerator,
} = require("../middleware/adminAuth");
const getClientIp = require("../utils/getClientIp");
const { pool } = require("../config/database");

// Import sub-routes
const authRoutes = require("./admin/auth");
const usersRoutes = require("./admin/users");
const bansRoutes = require("./admin/bans");
const rangebanRoutes = require("./admin/rangebans");
const moderationRoutes = require("./admin/moderation");
const actionsRoutes = require("./admin/actions");
const housekeepingRoutes = require("./admin/housekeeping");
const stickyRoutes = require("./admin/sticky");
const ipHistoryRoutes = require("./admin/ipHistory");

// Rate limiters for different admin operations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Custom key generator to track by username + IP
  keyGenerator: (req) => {
    return `${req.body.username || "unknown"}_${getClientIp(req)}`;
  },
});

const moderationActionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 moderation actions per minute
  message: "Too many moderation actions, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 sensitive actions per 5 minutes
  message: "Too many sensitive operations, please wait",
  standardHeaders: true,
  legacyHeaders: false,
});

// Logging middleware for all admin actions
const logAdminAccess = async (req, res, next) => {
  const startTime = Date.now();

  // Log the access attempt
  const logEntry = {
    user: req.session?.adminUser?.username || "anonymous",
    userId: req.session?.adminUser?.id || null,
    method: req.method,
    path: req.originalUrl,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  };

  // Log to console
  console.log(
    `Admin Access: ${logEntry.user} - ${logEntry.method} ${logEntry.path} from ${logEntry.ip}`
  );

  // Store original end function
  const originalEnd = res.end;

  // Override end to capture response details
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log completion
    console.log(
      `Admin Access Complete: ${logEntry.user} - ${logEntry.method} ${logEntry.path} - Status: ${statusCode} - Duration: ${duration}ms`
    );

    // Log to database for sensitive operations
    if (req.method !== "GET" || req.path.includes("sensitive")) {
      pool
        .query(
          `INSERT INTO admin_access_logs (user_id, username, method, path, ip_address, user_agent, status_code, duration_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
          [
            logEntry.userId,
            logEntry.user,
            logEntry.method,
            logEntry.path,
            logEntry.ip,
            logEntry.userAgent,
            statusCode,
            duration,
          ]
        )
        .catch((err) => console.error("Failed to log admin access:", err));
    }

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

// Apply logging to all admin routes
router.use(logAdminAccess);

// Security headers for admin panel
router.use((req, res, next) => {
  // Prevent admin pages from being embedded
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");

  // Prevent caching of admin pages
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
});

// Session validation middleware
router.use((req, res, next) => {
  // Skip for login/logout routes
  if (req.path === "/login" || req.path === "/logout") {
    return next();
  }

  // Check if session exists and is valid
  if (req.session && req.session.adminUser) {
    // Validate session hasn't expired
    const sessionAge =
      Date.now() - new Date(req.session.adminUser.loginTime).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      req.session.destroy();
      return res.status(401).json({ error: "Session expired" });
    }

    // Refresh session activity
    req.session.touch();
  }

  next();
});

// Apply rate limiting to authentication routes
router.use("/login", loginLimiter);

// Authentication routes (login, logout, profile) - no auth required
router.use("/", authRoutes);

// All routes below require authentication
router.use(requireAuth);

// User management routes - admin only
router.use("/users", requireAdmin, sensitiveActionLimiter, usersRoutes);

// Ban management routes - moderator or higher
router.use("/bans", requireModerator, moderationActionLimiter, bansRoutes);

// Sticky thread management routes - moderator or higher
router.use("/boards", requireModerator, moderationActionLimiter, stickyRoutes);

// Rangeban management routes - admin only
router.use("/rangebans", requireAdmin, sensitiveActionLimiter, rangebanRoutes);

// Moderation actions history routes - view only, all authenticated users
router.use("/actions", actionsRoutes);

// IP action history routes - moderator or higher
router.use("/ip-history", requireModerator, ipHistoryRoutes);

// Housekeeping routes - admin only
router.use("/housekeeping", requireAdmin, housekeepingRoutes);

// Content moderation routes - moderator or higher
router.use("/", requireModerator, moderationActionLimiter, moderationRoutes);

// Error handler for admin routes
router.use((err, req, res, next) => {
  // Log admin route errors
  console.error("Admin route error:", {
    user: req.session?.adminUser?.username,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  // Don't leak error details
  res.status(err.status || 500).json({
    error: "An error occurred processing your request",
    requestId: req.id,
  });
});

// 404 handler for admin routes
router.use((req, res) => {
  console.warn("Admin 404:", {
    user: req.session?.adminUser?.username,
    path: req.originalUrl,
    ip: getClientIp(req),
  });

  res.status(404).json({ error: "Admin endpoint not found" });
});

module.exports = router;
