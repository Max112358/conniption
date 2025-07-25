// backend/models/moderation.js
const { pool } = require("../config/database");
const fileUtils = require("../utils/fileUtils");
const ipActionHistoryModel = require("./ipActionHistory");

/**
 * Moderation model functions
 */
const moderationModel = {
  /**
   * Get moderation actions
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of moderation action objects
   */
  getModerationActions: async (filters = {}) => {
    console.log("Model: Getting moderation actions");

    try {
      let query = `
        SELECT ma.id, ma.admin_user_id, ma.action_type, ma.board_id, ma.thread_id, ma.post_id, 
               ma.ban_id, ma.reason, ma.created_at, ma.ip_address,
               au.username as admin_username
        FROM moderation_actions ma
        LEFT JOIN admin_users au ON ma.admin_user_id = au.id
      `;

      const params = [];
      const conditions = [];
      let paramCounter = 1;

      // Apply filters
      if (filters.admin_user_id) {
        conditions.push(`ma.admin_user_id = $${paramCounter++}`);
        params.push(filters.admin_user_id);
      }

      if (filters.action_type) {
        conditions.push(`ma.action_type = $${paramCounter++}`);
        params.push(filters.action_type);
      }

      if (filters.board_id) {
        conditions.push(`ma.board_id = $${paramCounter++}`);
        params.push(filters.board_id);
      }

      if (filters.thread_id) {
        conditions.push(`ma.thread_id = $${paramCounter++}`);
        params.push(filters.thread_id);
      }

      if (filters.post_id) {
        conditions.push(`ma.post_id = $${paramCounter++}`);
        params.push(filters.post_id);
      }

      if (filters.ban_id) {
        conditions.push(`ma.ban_id = $${paramCounter++}`);
        params.push(filters.ban_id);
      }

      if (filters.ip_address) {
        conditions.push(`ma.ip_address = $${paramCounter++}`);
        params.push(filters.ip_address);
      }

      if (filters.start_date) {
        conditions.push(`ma.created_at >= $${paramCounter++}`);
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push(`ma.created_at <= $${paramCounter++}`);
        params.push(filters.end_date);
      }

      // Add conditions to query
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      // Add order by
      query += " ORDER BY ma.created_at DESC";

      // Add limit and offset
      if (filters.limit) {
        query += ` LIMIT $${paramCounter++}`;
        params.push(filters.limit);

        if (filters.offset) {
          query += ` OFFSET $${paramCounter++}`;
          params.push(filters.offset);
        }
      }

      const result = await pool.query(query, params);

      console.log(`Model: Found ${result.rows.length} moderation actions`);
      return result.rows;
    } catch (error) {
      console.error("Model Error - getModerationActions:", error);
      throw error;
    }
  },

  /**
   * Delete a thread and record the moderation action
   * @param {Object} data - Data for deletion
   * @returns {Promise<boolean>} True if deleted successfully
   */
  deleteThread: async (data) => {
    console.log(
      `Model: Deleting thread ${data.thread_id} in board ${data.board_id}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get thread info for logging
      const threadResult = await client.query(
        `SELECT topic FROM threads WHERE id = $1 AND board_id = $2`,
        [data.thread_id, data.board_id]
      );

      if (threadResult.rows.length === 0) {
        console.log(`Model: Thread not found with ID: ${data.thread_id}`);
        await client.query("ROLLBACK");
        return false;
      }

      // Get image URLs to delete from R2
      const imageResult = await client.query(
        `SELECT image_url FROM posts WHERE thread_id = $1 AND board_id = $2`,
        [data.thread_id, data.board_id]
      );

      const imageUrls = imageResult.rows
        .map((row) => row.image_url)
        .filter((url) => url);

      // Delete thread (will cascade delete posts)
      await client.query(
        `DELETE FROM threads WHERE id = $1 AND board_id = $2`,
        [data.thread_id, data.board_id]
      );

      // Log moderation action
      await client.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, reason, ip_address)
         VALUES ($1, 'delete_thread', $2, $3, $4, $5)`,
        [
          data.admin_user_id,
          data.board_id,
          data.thread_id,
          data.reason,
          data.ip_address,
        ]
      );

      // Record in IP action history
      await ipActionHistoryModel.recordAction({
        ip_address: data.ip_address,
        action_type: "thread_deleted",
        admin_user_id: data.admin_user_id,
        admin_username: data.admin_username,
        board_id: data.board_id,
        thread_id: data.thread_id,
        reason: data.reason,
        details: {
          thread_topic: threadResult.rows[0].topic,
          image_count: imageUrls.length,
        },
      });

      // Delete images from R2
      for (const imageUrl of imageUrls) {
        try {
          await fileUtils.deleteFile(imageUrl);
        } catch (err) {
          console.error(`Failed to delete image: ${imageUrl}`, err);
          // Continue with other deletions
        }
      }

      await client.query("COMMIT");
      console.log(`Model: Successfully deleted thread ${data.thread_id}`);
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - deleteThread:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a post and record the moderation action
   * @param {Object} data - Data for deletion
   * @returns {Promise<Object>} Success object with IP address
   */
  deletePost: async (data) => {
    console.log(
      `Model: Deleting post ${data.post_id} in thread ${data.thread_id}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get post info to check if it exists and get image URL and IP address
      const postResult = await client.query(
        `SELECT image_url, ip_address, content FROM posts 
       WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
        [data.post_id, data.thread_id, data.board_id]
      );

      if (postResult.rows.length === 0) {
        console.log(`Model: Post not found with ID: ${data.post_id}`);
        await client.query("ROLLBACK");
        return false;
      }

      const imageUrl = postResult.rows[0].image_url;
      const ipAddress = postResult.rows[0].ip_address || "Unknown";
      const postContent = postResult.rows[0].content;

      // Delete post
      await client.query(
        `DELETE FROM posts WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
        [data.post_id, data.thread_id, data.board_id]
      );

      // Log moderation action
      await client.query(
        `INSERT INTO moderation_actions 
       (admin_user_id, action_type, board_id, thread_id, post_id, reason, ip_address)
       VALUES ($1, 'delete_post', $2, $3, $4, $5, $6)`,
        [
          data.admin_user_id,
          data.board_id,
          data.thread_id,
          data.post_id,
          data.reason,
          ipAddress,
        ]
      );

      // Record in IP action history
      await ipActionHistoryModel.recordAction({
        ip_address: ipAddress,
        action_type: "post_deleted",
        admin_user_id: data.admin_user_id,
        admin_username: data.admin_username,
        board_id: data.board_id,
        thread_id: data.thread_id,
        post_id: data.post_id,
        reason: data.reason,
        details: {
          content_preview: postContent ? postContent.substring(0, 100) : null,
          had_image: !!imageUrl,
        },
      });

      // Delete image from R2 if exists
      if (imageUrl) {
        try {
          await fileUtils.deleteFile(imageUrl);
        } catch (err) {
          console.error(`Failed to delete image: ${imageUrl}`, err);
          // Continue with transaction
        }
      }

      await client.query("COMMIT");
      console.log(`Model: Successfully deleted post ${data.post_id}`);

      // Return true and the IP address for potential banning
      return {
        success: true,
        ipAddress: ipAddress,
        postContent: postContent,
        imageUrl: imageUrl,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - deletePost:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Edit a post content and record the moderation action
   * @param {Object} data - Data for edit
   * @returns {Promise<Object|null>} Updated post object
   */
  editPost: async (data) => {
    console.log(
      `Model: Editing post ${data.post_id} in thread ${data.thread_id}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get original post content and IP
      const originalResult = await client.query(
        `SELECT content, ip_address FROM posts 
         WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
        [data.post_id, data.thread_id, data.board_id]
      );

      if (originalResult.rows.length === 0) {
        console.log(`Model: Post not found with ID: ${data.post_id}`);
        await client.query("ROLLBACK");
        return null;
      }

      const originalContent = originalResult.rows[0].content;
      const ipAddress = originalResult.rows[0].ip_address || "Unknown";

      // Update post content
      const result = await client.query(
        `UPDATE posts 
         SET content = $1
         WHERE id = $2 AND thread_id = $3 AND board_id = $4
         RETURNING id, content, image_url, created_at, color`,
        [data.content, data.post_id, data.thread_id, data.board_id]
      );

      // Log moderation action
      await client.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, post_id, reason, ip_address)
         VALUES ($1, 'edit_post', $2, $3, $4, $5, $6)`,
        [
          data.admin_user_id,
          data.board_id,
          data.thread_id,
          data.post_id,
          data.reason,
          data.ip_address,
        ]
      );

      // Record in IP action history
      await ipActionHistoryModel.recordAction({
        ip_address: ipAddress,
        action_type: "post_edited",
        admin_user_id: data.admin_user_id,
        admin_username: data.admin_username,
        board_id: data.board_id,
        thread_id: data.thread_id,
        post_id: data.post_id,
        reason: data.reason,
        details: {
          original_content: originalContent,
          new_content: data.content,
        },
      });

      await client.query("COMMIT");
      console.log(`Model: Successfully edited post ${data.post_id}`);
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - editPost:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Change post color and record the moderation action
   * @param {Object} data - Data for color change
   * @returns {Promise<Object|null>} Updated post object
   */
  changePostColor: async (data) => {
    console.log(
      `Model: Changing color of post ${data.post_id} to ${data.color}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get current post info
      const postResult = await client.query(
        `SELECT ip_address, color as old_color FROM posts 
         WHERE id = $1 AND thread_id = $2 AND board_id = $3`,
        [data.post_id, data.thread_id, data.board_id]
      );

      if (postResult.rows.length === 0) {
        console.log(`Model: Post not found with ID: ${data.post_id}`);
        await client.query("ROLLBACK");
        return null;
      }

      const oldColor = postResult.rows[0].old_color;
      const ipAddress = postResult.rows[0].ip_address || "Unknown";

      // Update post color
      const result = await client.query(
        `UPDATE posts 
         SET color = $1
         WHERE id = $2 AND thread_id = $3 AND board_id = $4
         RETURNING id, content, image_url, created_at, color, thread_user_id, country_code`,
        [data.color, data.post_id, data.thread_id, data.board_id]
      );

      // Log moderation action with old and new color in reason
      await client.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, post_id, reason, ip_address)
         VALUES ($1, 'change_post_color', $2, $3, $4, $5, $6)`,
        [
          data.admin_user_id,
          data.board_id,
          data.thread_id,
          data.post_id,
          `Changed color from ${oldColor} to ${data.color}: ${data.reason}`,
          ipAddress,
        ]
      );

      // Record in IP action history
      await ipActionHistoryModel.recordAction({
        ip_address: ipAddress,
        action_type: "color_changed",
        admin_user_id: data.admin_user_id,
        admin_username: data.admin_username,
        board_id: data.board_id,
        thread_id: data.thread_id,
        post_id: data.post_id,
        reason: data.reason,
        details: {
          old_color: oldColor,
          new_color: data.color,
        },
      });

      await client.query("COMMIT");
      console.log(
        `Model: Successfully changed post ${data.post_id} color to ${data.color}`
      );
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - changePostColor:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Log a moderation action (helper function)
   * @param {Object} actionData - Action data
   * @returns {Promise<Object>} Created action
   */
  logAction: async (actionData) => {
    console.log(`Model: Logging moderation action: ${actionData.action_type}`);

    try {
      const result = await pool.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, post_id, ban_id, rangeban_id, reason, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          actionData.admin_user_id,
          actionData.action_type,
          actionData.board_id || null,
          actionData.thread_id || null,
          actionData.post_id || null,
          actionData.ban_id || null,
          actionData.rangeban_id || null,
          actionData.reason,
          actionData.ip_address || null,
        ]
      );

      console.log(
        `Model: Logged moderation action with ID: ${result.rows[0].id}`
      );
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - logAction:`, error);
      throw error;
    }
  },

  /**
   * Get statistics for moderation actions
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Moderation statistics
   */
  getModerationStats: async (filters = {}) => {
    console.log("Model: Getting moderation statistics");

    try {
      const conditions = [];
      const params = [];
      let paramCounter = 1;

      // Build conditions for WHERE clause
      if (filters.admin_user_id) {
        conditions.push(`admin_user_id = ${paramCounter++}`);
        params.push(filters.admin_user_id);
      }

      if (filters.board_id) {
        conditions.push(`board_id = ${paramCounter++}`);
        params.push(filters.board_id);
      }

      if (filters.start_date) {
        conditions.push(`created_at >= ${paramCounter++}`);
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push(`created_at <= ${paramCounter++}`);
        params.push(filters.end_date);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Get action counts by type
      const actionQuery = `
        SELECT action_type, COUNT(*) as count
        FROM moderation_actions
        ${whereClause}
        GROUP BY action_type
        ORDER BY count DESC
      `;

      const actionResult = await pool.query(actionQuery, params);

      // Get counts by admin
      const adminQuery = `
        SELECT ma.admin_user_id, au.username, COUNT(*) as count
        FROM moderation_actions ma
        JOIN admin_users au ON ma.admin_user_id = au.id
        ${whereClause}
        GROUP BY ma.admin_user_id, au.username
        ORDER BY count DESC
      `;

      const adminResult = await pool.query(adminQuery, params);

      // Get counts by board
      const boardQuery = `
        SELECT board_id, COUNT(*) as count
        FROM moderation_actions
        ${whereClause}
        GROUP BY board_id
        ORDER BY count DESC
      `;

      const boardResult = await pool.query(boardQuery, params);

      // Get total count
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM moderation_actions
        ${whereClause}
      `;

      const totalResult = await pool.query(totalQuery, params);

      const stats = {
        total: parseInt(totalResult.rows[0].total),
        byActionType: actionResult.rows,
        byAdmin: adminResult.rows,
        byBoard: boardResult.rows,
      };

      console.log("Model: Successfully retrieved moderation statistics");
      return stats;
    } catch (error) {
      console.error("Model Error - getModerationStats:", error);
      throw error;
    }
  },
};

module.exports = moderationModel;
