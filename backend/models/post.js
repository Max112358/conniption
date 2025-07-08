// backend/models/post.js
const { pool } = require("../config/database");
const transformImageUrl = require("../utils/transformImageUrl");
const { generateThreadUserId } = require("../utils/threadIdGenerator");
const { getCountryCode } = require("../utils/countryLookup");

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
        SELECT id, content, image_url, file_type, created_at, thread_user_id, country_code
        FROM posts
        WHERE thread_id = $1 AND board_id = $2
        ORDER BY created_at ASC
        `,
        [threadId, boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} posts for thread: ${threadId}`
      );

      // Transform image URLs to use custom domain
      const posts = result.rows.map((post) => ({
        ...post,
        image_url: transformImageUrl(post.image_url),
      }));

      return posts;
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
   * @param {string} ipAddress - IP address of the poster
   * @param {Object} boardSettings - Board settings for thread IDs and country flags
   * @param {string} threadSalt - The thread's salt for generating thread IDs
   * @returns {Promise<Object>} Object with postId, threadId, and boardId
   */
  createPost: async (
    threadId,
    boardId,
    content,
    imagePath,
    ipAddress,
    boardSettings,
    threadSalt
  ) => {
    console.log(`Model: Creating post in thread ${threadId}, board ${boardId}`);
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query("BEGIN");

      // Generate thread user ID if enabled
      let threadUserId = null;
      if (boardSettings.thread_ids_enabled && threadSalt) {
        threadUserId = generateThreadUserId(ipAddress, threadId, threadSalt);
      }

      // Get country code if enabled
      let countryCode = null;
      if (boardSettings.country_flags_enabled) {
        countryCode = getCountryCode(ipAddress);
      }

      // Create post
      let postQuery, postParams;

      if (imagePath) {
        // Determine file type from path
        const fileType = imagePath.match(/\.(mp4|webm)$/i) ? "video" : "image";

        // Post with media
        console.log(`Model: Creating post with ${fileType}: ${imagePath}`);
        postQuery = `
          INSERT INTO posts (thread_id, board_id, content, image_url, file_type, created_at, ip_address, thread_user_id, country_code)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8)
          RETURNING id
        `;
        postParams = [
          threadId,
          boardId,
          content,
          imagePath,
          fileType,
          ipAddress,
          threadUserId,
          countryCode,
        ];
      } else {
        // Post without media
        console.log(`Model: Creating post without media`);
        postQuery = `
          INSERT INTO posts (thread_id, board_id, content, created_at, ip_address, thread_user_id, country_code)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)
          RETURNING id
        `;
        postParams = [
          threadId,
          boardId,
          content,
          ipAddress,
          threadUserId,
          countryCode,
        ];
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
