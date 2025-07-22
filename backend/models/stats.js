// backend/models/stats.js
const { pool } = require("../config/database");
const crypto = require("crypto");

/**
 * Stats model functions
 */
const statsModel = {
  /**
   * Hash an IP address for privacy
   * @param {string} ipAddress - The IP address to hash
   * @returns {string} Hashed IP address
   */
  hashIpAddress: (ipAddress) => {
    if (!ipAddress || ipAddress === "unknown") return "unknown";
    return crypto.createHash("sha256").update(ipAddress).digest("hex");
  },

  /**
   * Track a page view
   * @param {string} ipAddress - The visitor's IP address
   * @param {string} countryCode - The visitor's country code
   * @param {string} boardId - The board being viewed (optional)
   * @returns {Promise<void>}
   */
  trackPageView: async (ipAddress, countryCode, boardId = null) => {
    const hashedIp = statsModel.hashIpAddress(ipAddress);

    try {
      await pool.query(
        `INSERT INTO page_views (hashed_ip, country_code, board_id, viewed_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [hashedIp, countryCode, boardId]
      );
    } catch (error) {
      console.error("Error tracking page view:", error);
      throw error;
    }
  },

  /**
   * Track a post creation
   * @param {string} ipAddress - The poster's IP address
   * @param {string} countryCode - The poster's country code
   * @param {string} boardId - The board where post was made
   * @returns {Promise<void>}
   */
  trackPost: async (ipAddress, countryCode, boardId) => {
    const hashedIp = statsModel.hashIpAddress(ipAddress);

    try {
      await pool.query(
        `INSERT INTO post_stats (hashed_ip, country_code, board_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [hashedIp, countryCode, boardId]
      );
    } catch (error) {
      console.error("Error tracking post:", error);
      throw error;
    }
  },

  /**
   * Get overall statistics
   * @returns {Promise<Object>} Statistics object
   */
  getOverallStats: async () => {
    try {
      const stats = {};

      // Unique visitors (lifetime)
      const lifetimeVisitorsResult = await pool.query(
        `SELECT COUNT(DISTINCT hashed_ip) as count FROM page_views`
      );
      stats.uniqueVisitorsLifetime = parseInt(
        lifetimeVisitorsResult.rows[0].count
      );

      // Unique visitors (last month)
      const monthVisitorsResult = await pool.query(
        `SELECT COUNT(DISTINCT hashed_ip) as count 
         FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'`
      );
      stats.uniqueVisitorsMonth = parseInt(monthVisitorsResult.rows[0].count);

      // Unique visitors (last day)
      const dayVisitorsResult = await pool.query(
        `SELECT COUNT(DISTINCT hashed_ip) as count 
         FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`
      );
      stats.uniqueVisitorsDay = parseInt(dayVisitorsResult.rows[0].count);

      // Unique visitors (last hour)
      const hourVisitorsResult = await pool.query(
        `SELECT COUNT(DISTINCT hashed_ip) as count 
         FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`
      );
      stats.uniqueVisitorsHour = parseInt(hourVisitorsResult.rows[0].count);

      return stats;
    } catch (error) {
      console.error("Error getting overall stats:", error);
      throw error;
    }
  },

  /**
   * Get board statistics
   * @returns {Promise<Array>} Array of board statistics
   */
  getBoardStats: async () => {
    try {
      const boardStats = await pool.query(`
        WITH board_stats AS (
          SELECT 
            b.id as board_id,
            b.name as board_name,
            -- Lifetime posts
            (SELECT COUNT(*) FROM post_stats WHERE board_id = b.id) as posts_lifetime,
            -- Month posts
            (SELECT COUNT(*) FROM post_stats 
             WHERE board_id = b.id 
             AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as posts_month,
            -- Day posts
            (SELECT COUNT(*) FROM post_stats 
             WHERE board_id = b.id 
             AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as posts_day,
            -- Hour posts
            (SELECT COUNT(*) FROM post_stats 
             WHERE board_id = b.id 
             AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as posts_hour
          FROM boards b
        )
        SELECT * FROM board_stats
        ORDER BY posts_lifetime DESC
      `);

      return boardStats.rows.map((row) => ({
        boardId: row.board_id,
        boardName: row.board_name,
        postsLifetime: parseInt(row.posts_lifetime),
        postsMonth: parseInt(row.posts_month),
        postsDay: parseInt(row.posts_day),
        postsHour: parseInt(row.posts_hour),
      }));
    } catch (error) {
      console.error("Error getting board stats:", error);
      throw error;
    }
  },

  /**
   * Get country statistics for views
   * @returns {Promise<Array>} Array of country view statistics
   */
  getCountryViewStats: async () => {
    try {
      const countryStats = await pool.query(`
        SELECT 
          country_code,
          COUNT(DISTINCT hashed_ip) as unique_visitors,
          COUNT(*) as total_views
        FROM page_views
        WHERE country_code IS NOT NULL
        GROUP BY country_code
        ORDER BY unique_visitors DESC
        LIMIT 50
      `);

      return countryStats.rows.map((row) => ({
        countryCode: row.country_code,
        uniqueVisitors: parseInt(row.unique_visitors),
        totalViews: parseInt(row.total_views),
      }));
    } catch (error) {
      console.error("Error getting country view stats:", error);
      throw error;
    }
  },

  /**
   * Get country statistics for posts
   * @returns {Promise<Array>} Array of country post statistics
   */
  getCountryPostStats: async () => {
    try {
      const countryStats = await pool.query(`
        SELECT 
          country_code,
          COUNT(DISTINCT hashed_ip) as unique_posters,
          COUNT(*) as total_posts
        FROM post_stats
        WHERE country_code IS NOT NULL
        GROUP BY country_code
        ORDER BY total_posts DESC
        LIMIT 50
      `);

      return countryStats.rows.map((row) => ({
        countryCode: row.country_code,
        uniquePosters: parseInt(row.unique_posters),
        totalPosts: parseInt(row.total_posts),
      }));
    } catch (error) {
      console.error("Error getting country post stats:", error);
      throw error;
    }
  },

  /**
   * Get hourly activity data for charts
   * @param {number} hours - Number of hours to get data for
   * @returns {Promise<Object>} Hourly activity data
   */
  getHourlyActivity: async (hours = 24) => {
    try {
      const viewsResult = await pool.query(
        `
        SELECT 
          DATE_TRUNC('hour', viewed_at) as hour,
          COUNT(DISTINCT hashed_ip) as unique_visitors,
          COUNT(*) as page_views
        FROM page_views
        WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL $1
        GROUP BY hour
        ORDER BY hour ASC
      `,
        [`${hours} hours`]
      );

      const postsResult = await pool.query(
        `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as posts_count
        FROM post_stats
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL $1
        GROUP BY hour
        ORDER BY hour ASC
      `,
        [`${hours} hours`]
      );

      return {
        views: viewsResult.rows,
        posts: postsResult.rows,
      };
    } catch (error) {
      console.error("Error getting hourly activity:", error);
      throw error;
    }
  },

  /**
   * Clean up old statistics data (optional, for privacy)
   * @param {number} daysToKeep - Number of days of data to keep
   * @returns {Promise<Object>} Cleanup results
   */
  cleanupOldStats: async (daysToKeep = 90) => {
    try {
      const viewsResult = await pool.query(
        `DELETE FROM page_views 
         WHERE viewed_at < CURRENT_TIMESTAMP - INTERVAL $1
         RETURNING *`,
        [`${daysToKeep} days`]
      );

      const postsResult = await pool.query(
        `DELETE FROM post_stats 
         WHERE created_at < CURRENT_TIMESTAMP - INTERVAL $1
         RETURNING *`,
        [`${daysToKeep} days`]
      );

      return {
        deletedViews: viewsResult.rowCount,
        deletedPosts: postsResult.rowCount,
      };
    } catch (error) {
      console.error("Error cleaning up old stats:", error);
      throw error;
    }
  },
};

module.exports = statsModel;
