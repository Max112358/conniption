// backend/models/rangeban.js
const { pool } = require("../config/database");

/**
 * Rangeban model functions
 */
const rangebanModel = {
  /**
   * Create a new rangeban
   * @param {Object} rangebanData - Rangeban data
   * @returns {Promise<Object>} Created rangeban object
   */
  createRangeban: async (rangebanData) => {
    console.log(
      `Model: Creating rangeban for ${rangebanData.ban_type}: ${rangebanData.ban_value}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if rangeban already exists
      const existingCheck = await client.query(
        `SELECT id FROM rangebans 
         WHERE ban_type = $1 AND ban_value = $2 AND board_id = $3 AND is_active = TRUE`,
        [rangebanData.ban_type, rangebanData.ban_value, rangebanData.board_id]
      );

      if (existingCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        throw new Error("Active rangeban already exists for this value");
      }

      // Insert the rangeban
      const result = await client.query(
        `INSERT INTO rangebans (ban_type, ban_value, board_id, reason, expires_at, admin_user_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, ban_type, ban_value, board_id, reason, expires_at, created_at, admin_user_id, is_active`,
        [
          rangebanData.ban_type,
          rangebanData.ban_value,
          rangebanData.board_id,
          rangebanData.reason,
          rangebanData.expires_at,
          rangebanData.admin_user_id,
        ]
      );

      const rangeban = result.rows[0];

      // Log moderation action
      await client.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, reason, rangeban_id)
         VALUES ($1, 'rangeban', $2, $3, $4)`,
        [
          rangebanData.admin_user_id,
          rangebanData.board_id,
          rangebanData.reason,
          rangeban.id,
        ]
      );

      await client.query("COMMIT");
      console.log(`Model: Created rangeban with ID: ${rangeban.id}`);

      return rangeban;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createRangeban:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get all active rangebans
   * @param {string|null} boardId - Optional board ID filter
   * @returns {Promise<Array>} Array of active rangeban objects
   */
  getActiveRangebans: async (boardId = null) => {
    console.log(
      `Model: Getting active rangebans${boardId ? ` for board ${boardId}` : ""}`
    );

    try {
      let query = `
        SELECT r.*, a.username as admin_username
        FROM rangebans r
        LEFT JOIN admin_users a ON r.admin_user_id = a.id
        WHERE r.is_active = TRUE
        AND (r.expires_at IS NULL OR r.expires_at > CURRENT_TIMESTAMP)
      `;

      const params = [];

      if (boardId) {
        query += " AND (r.board_id = $1 OR r.board_id IS NULL)";
        params.push(boardId);
      }

      query += " ORDER BY r.created_at DESC";

      const result = await pool.query(query, params);

      console.log(`Model: Found ${result.rows.length} active rangebans`);
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getActiveRangebans:`, error);
      throw error;
    }
  },

  /**
   * Get rangeban by ID
   * @param {number} rangebanId - Rangeban ID
   * @returns {Promise<Object|null>} Rangeban object or null
   */
  getRangebanById: async (rangebanId) => {
    console.log(`Model: Getting rangeban with ID: ${rangebanId}`);

    try {
      const result = await pool.query(
        `SELECT r.*, a.username as admin_username
         FROM rangebans r
         LEFT JOIN admin_users a ON r.admin_user_id = a.id
         WHERE r.id = $1`,
        [rangebanId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Rangeban not found with ID: ${rangebanId}`);
        return null;
      }

      console.log(`Model: Found rangeban with ID: ${rangebanId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - getRangebanById(${rangebanId}):`, error);
      throw error;
    }
  },

  /**
   * Check if a country is rangebanned for a specific board
   * @param {string} countryCode - Two-letter country code
   * @param {string} boardId - Board ID to check
   * @returns {Promise<Object|null>} Rangeban object if banned, null otherwise
   */
  checkCountryBanned: async (countryCode, boardId) => {
    console.log(
      `Model: Checking if country ${countryCode} is banned on board ${boardId}`
    );

    try {
      const now = new Date().toISOString();

      const result = await pool.query(
        `SELECT id, ban_type, ban_value, board_id, reason, expires_at, created_at, is_active
         FROM rangebans
         WHERE ban_type = 'country'
         AND ban_value = $1
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > $2)
         AND (board_id = $3 OR board_id IS NULL)
         LIMIT 1`,
        [countryCode, now, boardId]
      );

      if (result.rows.length === 0) {
        console.log(
          `Model: Country ${countryCode} is not rangebanned on board ${boardId}`
        );
        return null;
      }

      console.log(
        `Model: Country ${countryCode} is rangebanned on board ${boardId}`
      );
      return result.rows[0];
    } catch (error) {
      console.error(
        `Model Error - checkCountryBanned(${countryCode}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Update a rangeban
   * @param {number} rangebanId - Rangeban ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated rangeban object
   */
  updateRangeban: async (rangebanId, updates) => {
    console.log(`Model: Updating rangeban with ID: ${rangebanId}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Prepare update fields
      const updateFields = [];
      const values = [];
      let paramCounter = 1;

      if (updates.reason !== undefined) {
        updateFields.push(`reason = $${paramCounter++}`);
        values.push(updates.reason);
      }

      if (updates.expires_at !== undefined) {
        updateFields.push(`expires_at = $${paramCounter++}`);
        values.push(updates.expires_at);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramCounter++}`);
        values.push(updates.is_active);
      }

      // If no updates, return current rangeban
      if (updateFields.length === 0) {
        await client.query("ROLLBACK");
        return await rangebanModel.getRangebanById(rangebanId);
      }

      // Add rangeban ID to values array
      values.push(rangebanId);

      // Execute update
      const result = await client.query(
        `UPDATE rangebans
         SET ${updateFields.join(", ")}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: Rangeban not found with ID: ${rangebanId}`);
        return null;
      }

      const rangeban = result.rows[0];

      // Log moderation action for removal if is_active was set to false
      if (updates.is_active === false) {
        await client.query(
          `INSERT INTO moderation_actions 
           (admin_user_id, action_type, board_id, reason, rangeban_id)
           VALUES ($1, 'remove_rangeban', $2, $3, $4)`,
          [
            updates.admin_user_id,
            rangeban.board_id,
            updates.reason || "Rangeban removed",
            rangeban.id,
          ]
        );
      }

      await client.query("COMMIT");
      console.log(`Model: Updated rangeban with ID: ${rangebanId}`);

      return rangeban;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - updateRangeban(${rangebanId}):`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get statistics for rangebans
   * @returns {Promise<Object>} Statistics object
   */
  getRangebanStats: async () => {
    console.log("Model: Getting rangeban statistics");

    try {
      const result = await pool.query(`
        SELECT 
          ban_type,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_count
        FROM rangebans
        GROUP BY ban_type
      `);

      const countryStats = await pool.query(`
        SELECT 
          ban_value as country_code,
          COUNT(*) as ban_count,
          COUNT(CASE WHEN board_id IS NULL THEN 1 END) as global_bans
        FROM rangebans
        WHERE ban_type = 'country' AND is_active = TRUE
        GROUP BY ban_value
        ORDER BY ban_count DESC
      `);

      return {
        byType: result.rows,
        topCountries: countryStats.rows,
      };
    } catch (error) {
      console.error("Model Error - getRangebanStats:", error);
      throw error;
    }
  },
};

module.exports = rangebanModel;
