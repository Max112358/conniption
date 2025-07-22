// backend/routes/stats.js
const express = require("express");
const router = express.Router();
const statsModel = require("../models/stats");
const { getCountryName } = require("../utils/countryLookup");

/**
 * @route   GET /api/stats
 * @desc    Get overall statistics
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  console.log("Route: GET /api/stats");

  try {
    // Get overall stats
    const overallStats = await statsModel.getOverallStats();

    // Get board stats
    const boardStats = await statsModel.getBoardStats();

    // Get country stats for views
    const countryViewStats = await statsModel.getCountryViewStats();

    // Get country stats for posts
    const countryPostStats = await statsModel.getCountryPostStats();

    // Add country names to the stats
    const countryViewStatsWithNames = countryViewStats.map((stat) => ({
      ...stat,
      countryName: getCountryName(stat.countryCode),
    }));

    const countryPostStatsWithNames = countryPostStats.map((stat) => ({
      ...stat,
      countryName: getCountryName(stat.countryCode),
    }));

    res.json({
      overall: overallStats,
      boards: boardStats,
      countries: {
        views: countryViewStatsWithNames,
        posts: countryPostStatsWithNames,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Route Error - GET /api/stats:", error);
    next(error);
  }
});

/**
 * @route   GET /api/stats/hourly
 * @desc    Get hourly activity data for charts
 * @access  Public
 */
router.get("/hourly", async (req, res, next) => {
  console.log("Route: GET /api/stats/hourly");
  const { hours = 24 } = req.query;

  try {
    const hourlyData = await statsModel.getHourlyActivity(parseInt(hours));

    res.json({
      hours: parseInt(hours),
      data: hourlyData,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Route Error - GET /api/stats/hourly:", error);
    next(error);
  }
});

/**
 * @route   GET /api/stats/boards/:boardId
 * @desc    Get statistics for a specific board
 * @access  Public
 */
router.get("/boards/:boardId", async (req, res, next) => {
  const { boardId } = req.params;
  console.log(`Route: GET /api/stats/boards/${boardId}`);

  try {
    // Get board-specific stats
    const boardStats = await statsModel.getBoardStats();
    const boardData = boardStats.find((b) => b.boardId === boardId);

    if (!boardData) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Get board-specific country breakdown
    const countryViewsResult = await statsModel.pool.query(
      `
      SELECT 
        country_code,
        COUNT(DISTINCT hashed_ip) as unique_visitors,
        COUNT(*) as total_views
      FROM page_views
      WHERE board_id = $1 AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY unique_visitors DESC
      LIMIT 30
    `,
      [boardId]
    );

    const countryPostsResult = await statsModel.pool.query(
      `
      SELECT 
        country_code,
        COUNT(DISTINCT hashed_ip) as unique_posters,
        COUNT(*) as total_posts
      FROM post_stats
      WHERE board_id = $1 AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY total_posts DESC
      LIMIT 30
    `,
      [boardId]
    );

    // Add country names
    const countryViews = countryViewsResult.rows.map((row) => ({
      countryCode: row.country_code,
      countryName: getCountryName(row.country_code),
      uniqueVisitors: parseInt(row.unique_visitors),
      totalViews: parseInt(row.total_views),
    }));

    const countryPosts = countryPostsResult.rows.map((row) => ({
      countryCode: row.country_code,
      countryName: getCountryName(row.country_code),
      uniquePosters: parseInt(row.unique_posters),
      totalPosts: parseInt(row.total_posts),
    }));

    res.json({
      board: boardData,
      countries: {
        views: countryViews,
        posts: countryPosts,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Route Error - GET /api/stats/boards/${boardId}:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/stats/live
 * @desc    Get live statistics (current active users estimate)
 * @access  Public
 */
router.get("/live", async (req, res, next) => {
  console.log("Route: GET /api/stats/live");

  try {
    // Get active users in last 5 minutes
    const activeUsersResult = await statsModel.pool.query(`
      SELECT COUNT(DISTINCT hashed_ip) as active_users
      FROM page_views
      WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `);

    // Get posts in last 5 minutes
    const recentPostsResult = await statsModel.pool.query(`
      SELECT COUNT(*) as recent_posts
      FROM post_stats
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `);

    res.json({
      activeUsers: parseInt(activeUsersResult.rows[0].active_users),
      recentPosts: parseInt(recentPostsResult.rows[0].recent_posts),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Route Error - GET /api/stats/live:", error);
    next(error);
  }
});

module.exports = router;
