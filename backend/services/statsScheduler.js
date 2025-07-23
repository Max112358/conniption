// backend/services/statsScheduler.js
const cron = require("node-cron");
const { pool } = require("../config/database");
const statsModel = require("../models/stats");

/**
 * Statistics maintenance scheduler
 */
const statsScheduler = {
  /**
   * Refresh materialized view for faster stats queries
   */
  refreshMaterializedView: async () => {
    try {
      console.log("Refreshing stats materialized view...");
      await pool.query("SELECT refresh_stats_summary()");
      console.log("Stats materialized view refreshed successfully");
    } catch (error) {
      console.error("Error refreshing materialized view:", error);
    }
  },

  /**
   * Clean up old statistics data (optional, for privacy)
   */
  cleanupOldStats: async () => {
    try {
      console.log("Cleaning up old statistics data...");
      const results = await statsModel.cleanupOldStats(90); // Keep 90 days of data
      console.log(
        `Cleaned up ${results.deletedViews} views and ${results.deletedPosts} post records`
      );
    } catch (error) {
      console.error("Error cleaning up old stats:", error);
    }
  },

  /**
   * Start all scheduled tasks
   */
  start: () => {
    // Refresh materialized view every 5 minutes
    cron.schedule("*/5 * * * *", statsScheduler.refreshMaterializedView, {
      scheduled: true,
      timezone: "UTC",
    });
    console.log("Scheduled stats materialized view refresh every 5 minutes");

    // Clean up old stats data daily at 3 AM
    cron.schedule("0 3 * * *", statsScheduler.cleanupOldStats, {
      scheduled: true,
      timezone: "UTC",
    });
    console.log("Scheduled daily stats cleanup at 3 AM UTC");

    // Initial refresh on startup
    statsScheduler.refreshMaterializedView();
  },

  /**
   * Get scheduler status
   */
  getStatus: () => {
    return {
      active: true,
      tasks: [
        {
          name: "Refresh materialized view",
          schedule: "Every 5 minutes",
          lastRun: null, // You could track this if needed
        },
        {
          name: "Cleanup old stats",
          schedule: "Daily at 3 AM UTC",
          lastRun: null,
        },
      ],
    };
  },
};

module.exports = statsScheduler;
