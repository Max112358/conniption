// backend/middleware/banCheck.js
const banModel = require("../models/ban");
const getClientIp = require("../utils/getClientIp");

/**
 * Middleware to check if user's IP is banned
 */
const checkBannedIP = async (req, res, next) => {
  // Skip ban check for appeal routes
  if (req.path.includes("/appeal")) {
    return next();
  }

  const ipAddress = getClientIp(req); // Use the new utility
  const boardId = req.params.boardId;

  try {
    // Check if IP is banned
    const ban = await banModel.checkIpBanned(ipAddress, boardId);

    if (ban) {
      console.log(
        `Route: Banned IP ${ipAddress} attempted to access board ${boardId}`
      );

      // Format expiration date if it exists
      let expiresMessage = "";
      if (ban.expires_at) {
        const expiresDate = new Date(ban.expires_at);
        expiresMessage = ` until ${expiresDate.toLocaleString()}`;
      } else {
        expiresMessage = " permanently";
      }

      return res.status(403).json({
        error: "Banned",
        message: `You are banned from this board${expiresMessage}. Reason: ${ban.reason}`,
        ban: {
          id: ban.id,
          reason: ban.reason,
          expires_at: ban.expires_at,
          appeal_status: ban.appeal_status || "none",
          board_id: boardId,
          post_content: ban.post_content,
          post_image_url: ban.post_image_url,
          thread_id: ban.thread_id,
          post_id: ban.post_id,
        },
      });
    }

    next();
  } catch (error) {
    console.error("Error checking ban status:", error);
    // Continue without blocking even if ban check fails
    next();
  }
};

module.exports = checkBannedIP;
