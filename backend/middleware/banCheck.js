// backend/middleware/banCheck.js
const banModel = require("../models/ban");
const rangebanModel = require("../models/rangeban");
const getClientIp = require("../utils/getClientIp");
const { getCountryCode } = require("../utils/countryLookup");

/**
 * Middleware to check if user's IP is banned or rangebanned
 */
const checkBannedIP = async (req, res, next) => {
  // Skip ban check for appeal routes
  if (req.path.includes("/appeal")) {
    return next();
  }

  const ipAddress = getClientIp(req);
  const boardId = req.params.boardId;

  try {
    // Check individual IP ban first
    const ipBan = await banModel.checkIpBanned(ipAddress, boardId);

    if (ipBan) {
      console.log(
        `Route: Banned IP ${ipAddress} attempted to access board ${boardId}`
      );

      // Format expiration date if it exists
      let expiresMessage = "";
      if (ipBan.expires_at) {
        const expiresDate = new Date(ipBan.expires_at);
        expiresMessage = ` until ${expiresDate.toLocaleString()}`;
      } else {
        expiresMessage = " permanently";
      }

      return res.status(403).json({
        error: "Banned",
        message: `You are banned from this board${expiresMessage}. Reason: ${ipBan.reason}`,
        ban: {
          id: ipBan.id,
          reason: ipBan.reason,
          expires_at: ipBan.expires_at,
          appeal_status: ipBan.appeal_status || "none",
          board_id: boardId,
          post_content: ipBan.post_content,
          post_image_url: ipBan.post_image_url,
          thread_id: ipBan.thread_id,
          post_id: ipBan.post_id,
        },
      });
    }

    // Check country rangeban
    const countryCode = getCountryCode(ipAddress);
    if (countryCode && countryCode !== "LO") {
      // Don't check rangebans for local IPs
      const countryBan = await rangebanModel.checkCountryBanned(
        countryCode,
        boardId
      );

      if (countryBan) {
        console.log(
          `Route: Rangebanned country ${countryCode} attempted to access board ${boardId}`
        );

        // Format expiration date if it exists
        let expiresMessage = "";
        if (countryBan.expires_at) {
          const expiresDate = new Date(countryBan.expires_at);
          expiresMessage = ` until ${expiresDate.toLocaleString()}`;
        } else {
          expiresMessage = " permanently";
        }

        return res.status(403).json({
          error: "Rangebanned",
          message: `Your country is banned from this board${expiresMessage}. Reason: ${countryBan.reason}`,
          rangeban: {
            type: "country",
            value: countryCode,
            reason: countryBan.reason,
            expires_at: countryBan.expires_at,
            board_id: countryBan.board_id,
          },
        });
      }
    }

    next();
  } catch (error) {
    console.error("Error checking ban status:", error);
    // Continue without blocking even if ban check fails
    next();
  }
};

module.exports = checkBannedIP;
