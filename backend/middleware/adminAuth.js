// backend/middleware/adminAuth.js
const getClientIp = require("../utils/getClientIp");

/**
 * Admin authentication middleware
 * Verifies admin users and their roles
 */

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  // Check if user is logged in
  if (!req.session || !req.session.adminUser) {
    console.log("Auth: Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized - Login required" });
  }

  // User is authenticated
  console.log(`Auth: User ${req.session.adminUser.username} authorized`);
  next();
};

// Middleware to check if user is an admin
const requireAdmin = (req, res, next) => {
  // First check if user is authenticated
  if (!req.session || !req.session.adminUser) {
    console.log("Auth: Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized - Login required" });
  }

  // Check if user is an admin
  if (req.session.adminUser.role !== "admin") {
    console.log(
      `Auth: User ${req.session.adminUser.username} lacks admin privileges`
    );
    return res
      .status(403)
      .json({ error: "Forbidden - Admin privileges required" });
  }

  // User is an admin
  console.log(`Auth: Admin ${req.session.adminUser.username} authorized`);
  next();
};

// Middleware to check if user is a moderator or higher
const requireModerator = (req, res, next) => {
  // First check if user is authenticated
  if (!req.session || !req.session.adminUser) {
    console.log("Auth: Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized - Login required" });
  }

  // Check if user is a moderator or admin
  if (
    req.session.adminUser.role !== "moderator" &&
    req.session.adminUser.role !== "admin"
  ) {
    console.log(
      `Auth: User ${req.session.adminUser.username} lacks moderator privileges`
    );
    return res
      .status(403)
      .json({ error: "Forbidden - Moderator privileges required" });
  }

  // User is a moderator or admin
  console.log(`Auth: Moderator ${req.session.adminUser.username} authorized`);
  next();
};

// Middleware to check board-specific permissions
const canModerateBoard = (req, res, next) => {
  // First check if user is authenticated
  if (!req.session || !req.session.adminUser) {
    console.log("Auth: Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized - Login required" });
  }

  // Get board ID from request params or body
  const boardId = req.params.boardId || req.body.boardId || req.query.boardId;

  if (!boardId) {
    console.log("Auth: No board ID provided for permission check");
    return res.status(400).json({ error: "Board ID required" });
  }

  // Admins can moderate all boards
  if (req.session.adminUser.role === "admin") {
    console.log(
      `Auth: Admin ${req.session.adminUser.username} authorized for board ${boardId}`
    );
    return next();
  }

  // Check if user has permission for this specific board
  const userBoards = req.session.adminUser.boards || [];
  if (userBoards.length > 0 && !userBoards.includes(boardId)) {
    console.log(
      `Auth: User ${req.session.adminUser.username} lacks permission for board ${boardId}`
    );
    return res
      .status(403)
      .json({ error: "Not authorized to moderate this board" });
  }

  // User has permission
  console.log(
    `Auth: User ${req.session.adminUser.username} authorized for board ${boardId}`
  );
  next();
};

// Helper function to check if IP is banned
// This middleware doesn't block the request but adds ban info to req object
const checkBanned = async (req, res, next) => {
  try {
    // Extract IP address from request using the new utility
    const ipAddress = getClientIp(req);

    // Get board ID from request
    const boardId = req.params.boardId;

    if (!boardId) {
      // Skip ban check if no board ID
      return next();
    }

    // Require the ban model
    const banModel = require("../models/ban");

    // Check if IP is banned
    const ban = await banModel.checkIpBanned(ipAddress, boardId);

    if (ban) {
      // Add ban info to request object
      req.banned = true;
      req.banInfo = ban;
      console.log(
        `Auth: Banned IP ${ipAddress} attempted to access board ${boardId}`
      );
    } else {
      req.banned = false;
    }

    next();
  } catch (error) {
    console.error("Error checking ban status:", error);
    // Continue without blocking even if ban check fails
    next();
  }
};

// Middleware to enforce ban (block request if banned)
const enforceBan = async (req, res, next) => {
  try {
    // Extract IP address from request using the new utility
    const ipAddress = getClientIp(req);

    // Get board ID from request
    const boardId = req.params.boardId;

    if (!boardId) {
      // Skip ban enforcement if no board ID
      return next();
    }

    // Require the ban model
    const banModel = require("../models/ban");

    // Check if IP is banned
    const ban = await banModel.checkIpBanned(ipAddress, boardId);

    if (ban) {
      // Format expiration date if it exists
      let expiresMessage = "";
      if (ban.expires_at) {
        const expiresDate = new Date(ban.expires_at);
        expiresMessage = ` until ${expiresDate.toLocaleString()}`;
      } else {
        expiresMessage = " permanently";
      }

      console.log(
        `Auth: Banned IP ${ipAddress} blocked from accessing board ${boardId}`
      );

      return res.status(403).json({
        error: "You are banned from this board",
        reason: ban.reason,
        expires: ban.expires_at,
        banId: ban.id,
        message: `You are banned from this board${expiresMessage}. Reason: ${ban.reason}`,
        canAppeal: true,
      });
    }

    next();
  } catch (error) {
    console.error("Error enforcing ban:", error);
    // Continue without blocking if ban check fails
    next();
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireModerator,
  canModerateBoard,
  checkBanned,
  enforceBan,
};
