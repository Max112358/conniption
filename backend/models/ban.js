// backend/models/ban.js
const { pool } = require("../config/database");
const ipActionHistoryModel = require("./ipActionHistory");

/**
 * Ban model functions
 */
const banModel = {
  /**
   * Create a new ban
   * @param {Object} banData - Ban data
   * @returns {Promise<Object>} Created ban object
   */
  createBan: async (banData) => {
    console.log(`Model: Creating new ban for IP: ${banData.ip_address}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Insert the ban
      const result = await client.query(
        `INSERT INTO bans (ip_address, board_id, reason, expires_at, admin_user_id, is_active, post_content, post_image_url, thread_id, post_id)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, $9)
         RETURNING id, ip_address, board_id, reason, expires_at, created_at, admin_user_id, is_active, post_content, post_image_url, thread_id, post_id`,
        [
          banData.ip_address,
          banData.board_id,
          banData.reason,
          banData.expires_at,
          banData.admin_user_id,
          banData.post_content,
          banData.post_image_url,
          banData.thread_id,
          banData.post_id,
        ]
      );

      const ban = result.rows[0];

      // Log moderation action
      await client.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, reason, ip_address, ban_id, thread_id, post_id)
         VALUES ($1, 'ban', $2, $3, $4, $5, $6, $7)`,
        [
          banData.admin_user_id,
          banData.board_id,
          banData.reason,
          banData.ip_address,
          ban.id,
          banData.thread_id,
          banData.post_id,
        ]
      );

      // Get admin username for IP action history
      const adminResult = await client.query(
        `SELECT username FROM admin_users WHERE id = $1`,
        [banData.admin_user_id]
      );
      const adminUsername = adminResult.rows[0]?.username || "Unknown";

      // Commit the transaction first so the ban exists for the foreign key
      await client.query("COMMIT");

      // Record in IP action history AFTER the ban is committed
      // This ensures the ban_id foreign key constraint is satisfied
      try {
        await ipActionHistoryModel.recordAction({
          ip_address: banData.ip_address,
          action_type: "banned",
          admin_user_id: banData.admin_user_id,
          admin_username: adminUsername,
          board_id: banData.board_id,
          thread_id: banData.thread_id,
          post_id: banData.post_id,
          ban_id: ban.id,
          reason: banData.reason,
          details: {
            expires_at: banData.expires_at,
            is_global: !banData.board_id,
            post_content_preview: banData.post_content
              ? banData.post_content.substring(0, 100)
              : null,
            had_image: !!banData.post_image_url,
          },
        });
      } catch (ipHistoryError) {
        // Log the error but don't fail the ban creation
        console.error("Failed to record IP action history:", ipHistoryError);
        // The ban was still created successfully
      }

      console.log(`Model: Created ban with ID: ${ban.id}`);
      return ban;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createBan:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get all active bans
   * @param {string|null} boardId - Optional board ID filter
   * @returns {Promise<Array>} Array of active ban objects
   */
  getActiveBans: async (boardId = null) => {
    console.log(
      `Model: Getting active bans${boardId ? ` for board ${boardId}` : ""}`
    );

    try {
      let query = `
        SELECT b.id, b.ip_address, b.board_id, b.reason, b.expires_at, b.created_at, 
               b.admin_user_id, b.is_active, b.appeal_text, b.appeal_status,
               b.post_content, b.post_image_url, b.thread_id, b.post_id,
               a.username as admin_username
        FROM bans b
        LEFT JOIN admin_users a ON b.admin_user_id = a.id
        WHERE b.is_active = TRUE
      `;

      const params = [];

      if (boardId) {
        query += " AND (b.board_id = $1 OR b.board_id IS NULL)";
        params.push(boardId);
      }

      query += " ORDER BY b.created_at DESC";

      const result = await pool.query(query, params);

      console.log(`Model: Found ${result.rows.length} active bans`);
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getActiveBans:`, error);
      throw error;
    }
  },

  /**
   * Get a ban by ID
   * @param {number} banId - Ban ID
   * @returns {Promise<Object|null>} Ban object or null if not found
   */
  getBanById: async (banId) => {
    console.log(`Model: Getting ban with ID: ${banId}`);

    try {
      const result = await pool.query(
        `SELECT b.id, b.ip_address, b.board_id, b.reason, b.expires_at, b.created_at, 
                b.admin_user_id, b.is_active, b.appeal_text, b.appeal_status,
                b.post_content, b.post_image_url, b.thread_id, b.post_id,
                a.username as admin_username
         FROM bans b
         LEFT JOIN admin_users a ON b.admin_user_id = a.id
         WHERE b.id = $1`,
        [banId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Ban not found with ID: ${banId}`);
        return null;
      }

      console.log(`Model: Found ban with ID: ${banId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - getBanById(${banId}):`, error);
      throw error;
    }
  },

  /**
   * Check if an IP address is banned for a specific board
   * @param {string} ipAddress - IP address to check
   * @param {string} boardId - Board ID to check
   * @returns {Promise<Object|null>} Ban object if banned, null otherwise
   */
  checkIpBanned: async (ipAddress, boardId) => {
    console.log(
      `Model: Checking if IP ${ipAddress} is banned on board ${boardId}`
    );

    try {
      const now = new Date().toISOString();

      const result = await pool.query(
        `SELECT id, ip_address, board_id, reason, expires_at, created_at, is_active,
                post_content, post_image_url, thread_id, post_id, appeal_status, appeal_text
         FROM bans
         WHERE ip_address = $1 
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > $2)
         AND (board_id = $3 OR board_id IS NULL)
         LIMIT 1`,
        [ipAddress, now, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: IP ${ipAddress} is not banned on board ${boardId}`);
        return null;
      }

      console.log(`Model: IP ${ipAddress} is banned on board ${boardId}`);
      return result.rows[0];
    } catch (error) {
      console.error(
        `Model Error - checkIpBanned(${ipAddress}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Get bans by post ID
   * @param {number} postId - Post ID
   * @param {string} boardId - Board ID
   * @returns {Promise<Array>} Array of ban objects for this post
   */
  getBansByPostId: async (postId, boardId) => {
    console.log(`Model: Getting bans for post ${postId} on board ${boardId}`);

    try {
      const result = await pool.query(
        `SELECT id, ip_address, board_id, reason, expires_at, created_at, is_active
         FROM bans
         WHERE post_id = $1 
         AND board_id = $2
         AND is_active = TRUE
         ORDER BY created_at DESC`,
        [postId, boardId]
      );

      console.log(`Model: Found ${result.rows.length} bans for post ${postId}`);
      return result.rows;
    } catch (error) {
      console.error(
        `Model Error - getBansByPostId(${postId}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Update a ban
   * @param {number} banId - Ban ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated ban object
   */
  updateBan: async (banId, updates) => {
    console.log(`Model: Updating ban with ID: ${banId}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get current ban info
      const currentBan = await client.query(
        `SELECT * FROM bans WHERE id = $1`,
        [banId]
      );

      if (currentBan.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: Ban not found with ID: ${banId}`);
        return null;
      }

      const ban = currentBan.rows[0];

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

      if (updates.appeal_status !== undefined) {
        updateFields.push(`appeal_status = $${paramCounter++}`);
        values.push(updates.appeal_status);
      }

      // If no updates, return current ban
      if (updateFields.length === 0) {
        await client.query("ROLLBACK");
        return await banModel.getBanById(banId);
      }

      // Add ban ID to values array
      values.push(banId);

      // Execute update
      const result = await client.query(
        `UPDATE bans
         SET ${updateFields.join(", ")}
         WHERE id = $${paramCounter}
         RETURNING id, ip_address, board_id, reason, expires_at, created_at, admin_user_id, is_active, appeal_text, appeal_status, post_content, post_image_url, thread_id, post_id`,
        values
      );

      const updatedBan = result.rows[0];

      // Get admin username
      const adminResult = await client.query(
        `SELECT username FROM admin_users WHERE id = $1`,
        [updates.admin_user_id]
      );
      const adminUsername = adminResult.rows[0]?.username || "Unknown";

      // Log moderation action for unban if is_active was set to false
      if (updates.is_active === false) {
        await client.query(
          `INSERT INTO moderation_actions 
           (admin_user_id, action_type, board_id, reason, ip_address, ban_id)
           VALUES ($1, 'unban', $2, $3, $4, $5)`,
          [
            updates.admin_user_id,
            updatedBan.board_id,
            updates.reason || "Ban removed",
            updatedBan.ip_address,
            updatedBan.id,
          ]
        );
      }

      // Log moderation action for appeal response
      if (
        updates.appeal_status === "approved" ||
        updates.appeal_status === "denied"
      ) {
        await client.query(
          `INSERT INTO moderation_actions 
           (admin_user_id, action_type, board_id, reason, ip_address, ban_id)
           VALUES ($1, 'appeal_response', $2, $3, $4, $5)`,
          [
            updates.admin_user_id,
            updatedBan.board_id,
            `Appeal ${updates.appeal_status}: ${
              updates.reason || "No reason provided"
            }`,
            updatedBan.ip_address,
            updatedBan.id,
          ]
        );
      }

      // Commit the transaction first
      await client.query("COMMIT");

      // Record IP action history AFTER commit for unban
      if (updates.is_active === false) {
        try {
          await ipActionHistoryModel.recordAction({
            ip_address: updatedBan.ip_address,
            action_type: "unbanned",
            admin_user_id: updates.admin_user_id,
            admin_username: adminUsername,
            board_id: updatedBan.board_id,
            ban_id: updatedBan.id,
            reason: updates.reason || "Ban removed",
            details: {
              original_reason: ban.reason,
              was_global: !ban.board_id,
            },
          });
        } catch (ipHistoryError) {
          console.error(
            "Failed to record unban IP action history:",
            ipHistoryError
          );
        }
      }

      // Record IP action history AFTER commit for appeal response
      if (
        updates.appeal_status === "approved" ||
        updates.appeal_status === "denied"
      ) {
        try {
          await ipActionHistoryModel.recordAction({
            ip_address: updatedBan.ip_address,
            action_type: "appeal_response",
            admin_user_id: updates.admin_user_id,
            admin_username: adminUsername,
            board_id: updatedBan.board_id,
            ban_id: updatedBan.id,
            reason: `Appeal ${updates.appeal_status}`,
            details: {
              appeal_status: updates.appeal_status,
              appeal_text: ban.appeal_text,
              response_reason: updates.reason,
            },
          });
        } catch (ipHistoryError) {
          console.error(
            "Failed to record appeal response IP action history:",
            ipHistoryError
          );
        }
      }

      console.log(`Model: Updated ban with ID: ${banId}`);
      return updatedBan;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - updateBan(${banId}):`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Submit an appeal for a ban
   * @param {number} banId - Ban ID
   * @param {string} appealText - Appeal text
   * @returns {Promise<Object|null>} Updated ban object
   */
  submitAppeal: async (banId, appealText) => {
    console.log(`Model: Submitting appeal for ban ID: ${banId}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE bans
         SET appeal_text = $1, appeal_status = 'pending'
         WHERE id = $2 AND is_active = TRUE
         RETURNING id, ip_address, board_id, reason, expires_at, created_at, admin_user_id, is_active, appeal_text, appeal_status`,
        [appealText, banId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: Ban not found or not active with ID: ${banId}`);
        return null;
      }

      const ban = result.rows[0];

      // Commit the transaction first
      await client.query("COMMIT");

      // Record appeal submission in IP action history AFTER commit
      try {
        await ipActionHistoryModel.recordAction({
          ip_address: ban.ip_address,
          action_type: "appeal_submitted",
          board_id: ban.board_id,
          ban_id: ban.id,
          reason: "Ban appeal submitted",
          details: {
            appeal_text: appealText,
            original_ban_reason: ban.reason,
          },
        });
      } catch (ipHistoryError) {
        console.error(
          "Failed to record appeal submission IP action history:",
          ipHistoryError
        );
      }

      console.log(`Model: Submitted appeal for ban ID: ${banId}`);
      return ban;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - submitAppeal(${banId}):`, error);
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = banModel;
