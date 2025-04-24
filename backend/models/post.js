// backend/models/post.js
const { pool } = require("../config/database");

/**
 * Post model functions
 */
const postModel = {
  /**
   * Get posts for a thread
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @returns {Promise<Array>} Array of post objects
   */
  getPostsByThreadId: async (threadId, boardId) => {
    console.log(
      `Model: Getting posts for thread ${threadId} in board ${boardId}`
    );
    try {
      const result = await pool.query(
        `
        SELECT id, content, image_path, created_at
        FROM posts
        WHERE thread_id = $1 AND board_id = $2
        ORDER BY created_at ASC
        `,
        [threadId, boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} posts for thread: ${threadId}`
      );
      return result.rows;
    } catch (error) {
      console.error(
        `Model Error - getPostsByThreadId(${threadId}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Create a new post in a thread
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @param {string} content - The post content
   * @param {string|null} imagePath - Path to the uploaded image (optional)
   * @returns {Promise<Object>} Object with postId, threadId, and boardId
   */
  createPost: async (threadId, boardId, content, imagePath = null) => {
    console.log(`Model: Creating post in thread ${threadId}, board ${boardId}`);
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query("BEGIN");

      // Create post
      let postQuery, postParams;

      if (imagePath) {
        // Post with image
        console.log(`Model: Creating post with image: ${imagePath}`);
        postQuery = `
          INSERT INTO posts (thread_id, board_id, content, image_path, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        postParams = [threadId, boardId, content, imagePath];
      } else {
        // Post without image
        console.log(`Model: Creating post without image`);
        postQuery = `
          INSERT INTO posts (thread_id, board_id, content, created_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        postParams = [threadId, boardId, content];
      }

      const postResult = await client.query(postQuery, postParams);
      const postId = postResult.rows[0].id;
      console.log(`Model: Created post with ID: ${postId}`);

      // Update thread's updated_at timestamp
      await client.query(
        `
        UPDATE threads
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND board_id = $2
        `,
        [threadId, boardId]
      );
      console.log(`Model: Updated thread ${threadId} timestamp`);

      // Commit transaction
      await client.query("COMMIT");

      return { postId, threadId, boardId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createPost:`, error);
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = postModel;
