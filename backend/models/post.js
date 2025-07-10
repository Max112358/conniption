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
        SELECT id, content, image_url, file_type, created_at, thread_user_id, country_code, color
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

      // Get survey info for posts
      const postIds = posts.map((p) => p.id);
      if (postIds.length > 0) {
        const surveyResult = await pool.query(
          `SELECT s.id as survey_id, s.post_id, s.survey_type, s.question, 
                  COUNT(DISTINCT sr.id) as response_count
           FROM surveys s
           LEFT JOIN survey_responses sr ON s.id = sr.survey_id
           WHERE s.post_id = ANY($1) AND s.board_id = $2 AND s.is_active = TRUE
           GROUP BY s.id`,
          [postIds, boardId]
        );

        // Create a map of post_id to survey info
        const surveyMap = {};
        surveyResult.rows.forEach((survey) => {
          surveyMap[survey.post_id] = {
            survey_id: survey.survey_id,
            survey_type: survey.survey_type,
            question: survey.question,
            response_count: parseInt(survey.response_count),
          };
        });

        // Add survey info to posts
        posts.forEach((post) => {
          if (surveyMap[post.id]) {
            post.survey = surveyMap[post.id];
          }
        });
      }

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
          INSERT INTO posts (thread_id, board_id, content, image_url, file_type, created_at, ip_address, thread_user_id, country_code, color)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9)
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
          "black", // Default color
        ];
      } else {
        // Post without media
        console.log(`Model: Creating post without media`);
        postQuery = `
          INSERT INTO posts (thread_id, board_id, content, created_at, ip_address, thread_user_id, country_code, color)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7)
          RETURNING id
        `;
        postParams = [
          threadId,
          boardId,
          content,
          ipAddress,
          threadUserId,
          countryCode,
          "black", // Default color
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

  /**
   * Get a single post by ID
   * @param {number} postId - The post ID
   * @param {string} boardId - The board ID
   * @returns {Promise<Object|null>} Post object or null if not found
   */
  getPostById: async (postId, boardId) => {
    console.log(`Model: Getting post ${postId} in board ${boardId}`);

    try {
      const result = await pool.query(
        `
        SELECT id, thread_id, board_id, content, image_url, file_type, created_at, 
               ip_address, thread_user_id, country_code, color
        FROM posts
        WHERE id = $1 AND board_id = $2
        `,
        [postId, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Post not found with ID: ${postId}`);
        return null;
      }

      const post = result.rows[0];
      post.image_url = transformImageUrl(post.image_url);

      console.log(`Model: Found post: ${postId}`);
      return post;
    } catch (error) {
      console.error(`Model Error - getPostById(${postId}, ${boardId}):`, error);
      throw error;
    }
  },

  /**
   * Update post color
   * @param {number} postId - The post ID
   * @param {string} boardId - The board ID
   * @param {string} color - The new color
   * @returns {Promise<Object|null>} Updated post object or null if not found
   */
  updatePostColor: async (postId, boardId, color) => {
    console.log(`Model: Updating color for post ${postId} to ${color}`);

    try {
      const result = await pool.query(
        `
        UPDATE posts
        SET color = $1
        WHERE id = $2 AND board_id = $3
        RETURNING id, thread_id, board_id, content, image_url, file_type, created_at, 
                  ip_address, thread_user_id, country_code, color
        `,
        [color, postId, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Post not found with ID: ${postId}`);
        return null;
      }

      const post = result.rows[0];
      post.image_url = transformImageUrl(post.image_url);

      console.log(`Model: Updated post ${postId} color to ${color}`);
      return post;
    } catch (error) {
      console.error(
        `Model Error - updatePostColor(${postId}, ${color}):`,
        error
      );
      throw error;
    }
  },
};

module.exports = postModel;
