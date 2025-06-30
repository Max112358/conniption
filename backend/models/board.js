// backend/models/board.js
const { pool } = require("../config/database");

/**
 * Board model functions
 */
const boardModel = {
  /**
   * Get all boards
   * @returns {Promise<Array>} Array of board objects
   */
  getAllBoards: async () => {
    console.log("Model: Getting all boards");
    try {
      const result = await pool.query(
        "SELECT id, name, description, nsfw, thread_ids_enabled, country_flags_enabled FROM boards"
      );
      console.log(`Model: Found ${result.rows.length} boards`);
      return result.rows;
    } catch (error) {
      console.error("Model Error - getAllBoards:", error);
      throw error;
    }
  },

  /**
   * Get a board by ID
   * @param {string} boardId - The board ID
   * @returns {Promise<Object>} Board object
   */
  getBoardById: async (boardId) => {
    console.log(`Model: Getting board with ID: ${boardId}`);
    try {
      const result = await pool.query(
        "SELECT id, name, description, nsfw, thread_ids_enabled, country_flags_enabled FROM boards WHERE id = $1",
        [boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Board not found with ID: ${boardId}`);
        return null;
      }

      console.log(`Model: Found board: ${result.rows[0].name}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - getBoardById(${boardId}):`, error);
      throw error;
    }
  },

  /**
   * Create a new board
   * @param {Object} boardData - The board data
   * @returns {Promise<Object>} Created board object
   */
  createBoard: async (boardData) => {
    console.log(`Model: Creating new board: ${boardData.id}`);
    try {
      const result = await pool.query(
        `INSERT INTO boards (id, name, description, nsfw, thread_ids_enabled, country_flags_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, nsfw, thread_ids_enabled, country_flags_enabled`,
        [
          boardData.id,
          boardData.name,
          boardData.description,
          boardData.nsfw || false,
          boardData.thread_ids_enabled || false,
          boardData.country_flags_enabled || false,
        ]
      );

      console.log(`Model: Created board: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - createBoard:`, error);
      throw error;
    }
  },
};

module.exports = boardModel;
