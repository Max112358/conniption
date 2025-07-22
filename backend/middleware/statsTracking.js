// backend/middleware/statsTracking.js
const statsModel = require("../models/stats");
const getClientIp = require("../utils/getClientIp");
const { getCountryCode } = require("../utils/countryLookup");

/**
 * Middleware to track page views
 * @param {Object} options - Options for tracking
 * @param {boolean} options.trackViews - Whether to track page views
 * @param {boolean} options.trackPosts - Whether to track post creation
 */
const createStatsMiddleware = (options = {}) => {
  return async (req, res, next) => {
    try {
      const ipAddress = getClientIp(req);
      const countryCode = getCountryCode(ipAddress);

      // Track page views for GET requests
      if (options.trackViews && req.method === "GET") {
        // Extract board ID from URL if present
        let boardId = null;

        // Check various URL patterns
        if (req.params.boardId) {
          boardId = req.params.boardId;
        } else if (req.path.match(/^\/api\/boards\/([^\/]+)/)) {
          const match = req.path.match(/^\/api\/boards\/([^\/]+)/);
          boardId = match[1];
        }

        // Don't track admin routes or static assets
        if (
          !req.path.startsWith("/api/admin") &&
          !req.path.startsWith("/api/stats") &&
          !req.path.includes("/socket.io")
        ) {
          // Track the view asynchronously (don't wait for it)
          statsModel
            .trackPageView(ipAddress, countryCode, boardId)
            .catch((err) => {
              console.error("Failed to track page view:", err);
            });
        }
      }

      // Track post creation for specific POST endpoints
      if (options.trackPosts && req.method === "POST") {
        // Store tracking function on res.locals for use after successful post creation
        res.locals.trackPost = async (boardId) => {
          try {
            await statsModel.trackPost(ipAddress, countryCode, boardId);
          } catch (err) {
            console.error("Failed to track post creation:", err);
          }
        };
      }

      next();
    } catch (error) {
      // Don't let tracking errors break the application
      console.error("Stats tracking middleware error:", error);
      next();
    }
  };
};

/**
 * Track page views middleware (for general use)
 */
const trackPageViews = createStatsMiddleware({ trackViews: true });

/**
 * Track post creation middleware (for post routes)
 */
const trackPostCreation = createStatsMiddleware({ trackPosts: true });

/**
 * Combined tracking middleware
 */
const trackAll = createStatsMiddleware({ trackViews: true, trackPosts: true });

module.exports = {
  createStatsMiddleware,
  trackPageViews,
  trackPostCreation,
  trackAll,
};
