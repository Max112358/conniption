// backend/models/admin.js
const { pool } = require("../config/database");
const bcrypt = require("bcrypt");

/**
 * Admin model functions for user management and authentication
 */
const adminModel = {
  /**
   * Create a new admin user
   * @param {Object} userData - Admin user data
   * @returns {Promise<Object>} Created admin user object (without password)
   */
  createAdminUser: async (userData) => {
    console.log(`Model: Creating new admin user: ${userData.username}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Insert the new admin user
      const result = await client.query(
        `INSERT INTO admin_users (username, password_hash, email, role, boards)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, role, boards, created_at, is_active`,
        [
          userData.username,
          passwordHash,
          userData.email,
          userData.role,
          userData.boards || [],
        ]
      );

      await client.query("COMMIT");
      console.log(`Model: Created admin user: ${result.rows[0].username}`);

      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createAdminUser:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Authenticate an admin user
   * @param {string} username - Admin username
   * @param {string} password - Admin password
   * @returns {Promise<Object|null>} Admin user object if authenticated, null otherwise
   */
  authenticateAdmin: async (username, password) => {
    console.log(`Model: Authenticating admin user: ${username}`);

    try {
      // Get user by username
      const result = await pool.query(
        `SELECT id, username, password_hash, email, role, boards, is_active
         FROM admin_users
         WHERE username = $1`,
        [username]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Admin user not found: ${username}`);
        return null;
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.is_active) {
        console.log(`Model: Admin user is inactive: ${username}`);
        return null;
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        console.log(`Model: Password mismatch for user: ${username}`);
        return null;
      }

      // Update last login timestamp
      await pool.query(
        `UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id]
      );

      // Return user without password hash
      const { password_hash, ...userWithoutPassword } = user;
      console.log(`Model: Admin authentication successful: ${username}`);

      return userWithoutPassword;
    } catch (error) {
      console.error(`Model Error - authenticateAdmin(${username}):`, error);
      throw error;
    }
  },

  /**
   * Get admin user by ID
   * @param {number} userId - Admin user ID
   * @returns {Promise<Object|null>} Admin user object without password
   */
  getAdminUserById: async (userId) => {
    console.log(`Model: Getting admin user with ID: ${userId}`);

    try {
      const result = await pool.query(
        `SELECT id, username, email, role, boards, created_at, last_login, is_active
         FROM admin_users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Admin user not found with ID: ${userId}`);
        return null;
      }

      console.log(`Model: Found admin user: ${result.rows[0].username}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - getAdminUserById(${userId}):`, error);
      throw error;
    }
  },

  /**
   * Get all admin users
   * @returns {Promise<Array>} Array of admin user objects without passwords
   */
  getAllAdminUsers: async () => {
    console.log("Model: Getting all admin users");

    try {
      const result = await pool.query(
        `SELECT id, username, email, role, boards, created_at, last_login, is_active
         FROM admin_users
         ORDER BY role, username`
      );

      console.log(`Model: Found ${result.rows.length} admin users`);
      return result.rows;
    } catch (error) {
      console.error("Model Error - getAllAdminUsers:", error);
      throw error;
    }
  },

  /**
   * Update an admin user
   * @param {number} userId - Admin user ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated admin user object without password
   */
  updateAdminUser: async (userId, updates) => {
    console.log(`Model: Updating admin user with ID: ${userId}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Prepare update fields
      const updateFields = [];
      const values = [];
      let paramCounter = 1;

      if (updates.username !== undefined) {
        updateFields.push(`username = $${paramCounter++}`);
        values.push(updates.username);
      }

      if (updates.email !== undefined) {
        updateFields.push(`email = $${paramCounter++}`);
        values.push(updates.email);
      }

      if (updates.role !== undefined) {
        updateFields.push(`role = $${paramCounter++}`);
        values.push(updates.role);
      }

      if (updates.boards !== undefined) {
        updateFields.push(`boards = $${paramCounter++}`);
        values.push(updates.boards);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramCounter++}`);
        values.push(updates.is_active);
      }

      if (updates.password !== undefined) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(updates.password, saltRounds);
        updateFields.push(`password_hash = $${paramCounter++}`);
        values.push(passwordHash);
      }

      // If no updates, return current user
      if (updateFields.length === 0) {
        await client.query("ROLLBACK");
        return await adminModel.getAdminUserById(userId);
      }

      // Add user ID to values array
      values.push(userId);

      // Execute update
      const result = await client.query(
        `UPDATE admin_users
         SET ${updateFields.join(", ")}
         WHERE id = $${paramCounter}
         RETURNING id, username, email, role, boards, created_at, last_login, is_active`,
        values
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: Admin user not found with ID: ${userId}`);
        return null;
      }

      await client.query("COMMIT");
      console.log(`Model: Updated admin user: ${result.rows[0].username}`);

      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - updateAdminUser(${userId}):`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete an admin user
   * @param {number} userId - Admin user ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  deleteAdminUser: async (userId) => {
    console.log(`Model: Deleting admin user with ID: ${userId}`);

    try {
      const result = await pool.query(
        "DELETE FROM admin_users WHERE id = $1 RETURNING id",
        [userId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Admin user not found with ID: ${userId}`);
        return false;
      }

      console.log(`Model: Deleted admin user with ID: ${userId}`);
      return true;
    } catch (error) {
      console.error(`Model Error - deleteAdminUser(${userId}):`, error);
      throw error;
    }
  },

  /**
   * Check if user has permission to moderate a board
   * @param {Object} user - Admin user object
   * @param {string} boardId - Board ID
   * @returns {boolean} True if user can moderate the board
   */
  canModerateBoard: (user, boardId) => {
    // Admins can moderate all boards
    if (user.role === "admin") {
      return true;
    }

    // Check if user has permission for this specific board
    if (user.boards && user.boards.length > 0) {
      return user.boards.includes(boardId);
    }

    // If boards array is empty, user can moderate all boards (for their role level)
    return true;
  },
};

module.exports = adminModel;
