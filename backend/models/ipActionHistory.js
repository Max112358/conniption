// backend/models/ipActionHistory.js
const { pool } = require("../config/database");

/**
 * IP Action History model functions
 */
const ipActionHistoryModel = {
  /**
   * Record an action against an IP address
   * @param {Object} actionData - Action data
   * @returns {Promise<Object>} Created action record
   */
  recordAction: async (actionData) => {
    console.log(
      `Model: Recording action for IP ${actionData.ip_address}: ${actionData.action_type}`
    );

    try {
      const result = await pool.query(
        `INSERT INTO ip_action_history 
         (ip_address, action_type, admin_user_id, admin_username, board_id, 
          thread_id, post_id, ban_id, rangeban_id, reason, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          actionData.ip_address,
          actionData.action_type,
          actionData.admin_user_id || null,
          actionData.admin_username || null,
          actionData.board_id || null,
          actionData.thread_id || null,
          actionData.post_id || null,
          actionData.ban_id || null,
          actionData.rangeban_id || null,
          actionData.reason || null,
          actionData.details ? JSON.stringify(actionData.details) : null,
        ]
      );

      console.log(`Model: Recorded action with ID: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - recordAction:`, error);
      throw error;
    }
  },

  /**
   * Get action history for a specific IP address
   * @param {string} ipAddress - IP address to look up
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of action records
   */
  getActionsByIP: async (ipAddress, options = {}) => {
    console.log(`Model: Getting action history for IP: ${ipAddress}`);

    try {
      let query = `
        SELECT 
          iah.*,
          au.username as current_admin_username,
          au.role as admin_role
        FROM ip_action_history iah
        LEFT JOIN admin_users au ON iah.admin_user_id = au.id
        WHERE iah.ip_address = $1
      `;

      const params = [ipAddress];
      let paramCount = 2;

      // Add optional filters
      if (options.board_id) {
        query += ` AND iah.board_id = $${paramCount}`;
        params.push(options.board_id);
        paramCount++;
      }

      if (options.action_type) {
        query += ` AND iah.action_type = $${paramCount}`;
        params.push(options.action_type);
        paramCount++;
      }

      if (options.start_date) {
        query += ` AND iah.created_at >= $${paramCount}`;
        params.push(options.start_date);
        paramCount++;
      }

      if (options.end_date) {
        query += ` AND iah.created_at <= $${paramCount}`;
        params.push(options.end_date);
        paramCount++;
      }

      // Add ordering
      query += ` ORDER BY iah.created_at DESC`;

      // Add pagination
      if (options.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
        paramCount++;
      }

      if (options.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }

      const result = await pool.query(query, params);

      console.log(
        `Model: Found ${result.rows.length} actions for IP ${ipAddress}`
      );
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getActionsByIP(${ipAddress}):`, error);
      throw error;
    }
  },

  /**
   * Get IP action summary (aggregated data)
   * @param {string} ipAddress - IP address to look up
   * @returns {Promise<Object>} Summary object
   */
  getIPSummary: async (ipAddress) => {
    console.log(`Model: Getting action summary for IP: ${ipAddress}`);

    try {
      const result = await pool.query(
        `SELECT 
          ip_address,
          COUNT(*) as total_actions,
          COUNT(DISTINCT board_id) as boards_affected,
          COUNT(CASE WHEN action_type = 'banned' THEN 1 END) as ban_count,
          COUNT(CASE WHEN action_type = 'post_deleted' THEN 1 END) as posts_deleted,
          COUNT(CASE WHEN action_type = 'thread_deleted' THEN 1 END) as threads_deleted,
          MIN(created_at) as first_action,
          MAX(created_at) as last_action,
          COUNT(DISTINCT admin_user_id) as unique_admins,
          ARRAY_AGG(DISTINCT board_id) FILTER (WHERE board_id IS NOT NULL) as boards_list
        FROM ip_action_history
        WHERE ip_address = $1
        GROUP BY ip_address`,
        [ipAddress]
      );

      if (result.rows.length === 0) {
        return {
          ip_address: ipAddress,
          total_actions: 0,
          boards_affected: 0,
          ban_count: 0,
          posts_deleted: 0,
          threads_deleted: 0,
          first_action: null,
          last_action: null,
          unique_admins: 0,
          boards_list: [],
        };
      }

      console.log(`Model: Found summary for IP ${ipAddress}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - getIPSummary(${ipAddress}):`, error);
      throw error;
    }
  },

  /**
   * Get recent problematic IPs (those with many actions)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of IP summaries
   */
  getProblematicIPs: async (options = {}) => {
    console.log(`Model: Getting problematic IPs`);

    try {
      const minActions = options.minActions || 5;
      const days = options.days || 30;

      const result = await pool.query(
        `SELECT 
          ip_address,
          COUNT(*) as total_actions,
          COUNT(DISTINCT board_id) as boards_affected,
          COUNT(CASE WHEN action_type = 'banned' THEN 1 END) as ban_count,
          COUNT(CASE WHEN action_type = 'post_deleted' THEN 1 END) as posts_deleted,
          COUNT(CASE WHEN action_type = 'thread_deleted' THEN 1 END) as threads_deleted,
          MIN(created_at) as first_action,
          MAX(created_at) as last_action,
          COUNT(DISTINCT admin_user_id) as unique_admins
        FROM ip_action_history
        WHERE created_at >= NOW() - INTERVAL $1
        GROUP BY ip_address
        HAVING COUNT(*) >= $2
        ORDER BY COUNT(*) DESC
        LIMIT $3`,
        [`${days} days`, minActions, options.limit || 100]
      );

      console.log(`Model: Found ${result.rows.length} problematic IPs`);
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getProblematicIPs:`, error);
      throw error;
    }
  },

  /**
   * Get action statistics by type
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of statistics
   */
  getActionStatistics: async (options = {}) => {
    console.log(`Model: Getting action statistics`);

    try {
      let query = `
        SELECT 
          action_type,
          COUNT(*) as count,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT board_id) as boards_affected
        FROM ip_action_history
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      if (options.start_date) {
        query += ` AND created_at >= ${paramCount}`;
        params.push(options.start_date);
        paramCount++;
      }

      if (options.end_date) {
        query += ` AND created_at <= ${paramCount}`;
        params.push(options.end_date);
        paramCount++;
      }

      if (options.board_id) {
        query += ` AND board_id = ${paramCount}`;
        params.push(options.board_id);
        paramCount++;
      }

      query += ` GROUP BY action_type ORDER BY count DESC`;

      const result = await pool.query(query, params);

      console.log(`Model: Retrieved action statistics`);
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getActionStatistics:`, error);
      throw error;
    }
  },

  /**
   * Clean up old action history (for maintenance)
   * @param {number} daysToKeep - Number of days of history to keep
   * @returns {Promise<number>} Number of records deleted
   */
  cleanupOldActions: async (daysToKeep = 365) => {
    console.log(
      `Model: Cleaning up action history older than ${daysToKeep} days`
    );

    try {
      const result = await pool.query(
        `DELETE FROM ip_action_history 
         WHERE created_at < NOW() - INTERVAL $1
         RETURNING id`,
        [`${daysToKeep} days`]
      );

      console.log(`Model: Deleted ${result.rowCount} old action records`);
      return result.rowCount;
    } catch (error) {
      console.error(`Model Error - cleanupOldActions:`, error);
      throw error;
    }
  },
};

module.exports = ipActionHistoryModel;
