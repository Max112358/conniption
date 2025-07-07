// backend/models/thread.js
const { pool } = require("../config/database");
const transformImageUrl = require("../utils/transformImageUrl");
const fileUtils = require("../utils/fileUtils");
const { generateThreadSalt } = require("../utils/threadIdGenerator");

/**
 * Thread model functions
 */
const threadModel = {
  /**
   * Get threads for a board
   * @param {string} boardId - The board ID
   * @returns {Promise<Array>} Array of thread objects
   */
  getThreadsByBoardId: async (boardId) => {
    console.log(`Model: Getting threads for board: ${boardId}`);
    try {
      const result = await pool.query(
        `
        SELECT 
          t.id, 
          t.topic, 
          t.created_at,
          t.updated_at,
          t.thread_salt,
          p.content,
          p.image_url,
          p.file_type,
          p.color,
          (SELECT COUNT(*) FROM posts WHERE thread_id = t.id) as post_count
        FROM 
          threads t
        JOIN 
          posts p ON p.thread_id = t.id
        WHERE 
          t.board_id = $1 
          AND p.id = (SELECT MIN(id) FROM posts WHERE thread_id = t.id)
        ORDER BY 
          t.updated_at DESC
        `,
        [boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} threads for board: ${boardId}`
      );

      // Transform image URLs to use custom domain
      const threads = result.rows.map((thread) => ({
        ...thread,
        image_url: transformImageUrl(thread.image_url),
      }));

      return threads;
    } catch (error) {
      console.error(`Model Error - getThreadsByBoardId(${boardId}):`, error);
      throw error;
    }
  },

  /**
   * Get a thread by ID
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @returns {Promise<Object>} Thread object
   */
  getThreadById: async (threadId, boardId) => {
    console.log(`Model: Getting thread ${threadId} in board ${boardId}`);
    try {
      const result = await pool.query(
        `
        SELECT id, board_id, topic, created_at, updated_at, thread_salt
        FROM threads
        WHERE id = $1 AND board_id = $2
        `,
        [threadId, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Thread not found with ID: ${threadId}`);
        return null;
      }

      console.log(`Model: Found thread: ${result.rows[0].topic}`);
      return result.rows[0];
    } catch (error) {
      console.error(
        `Model Error - getThreadById(${threadId}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Create a new thread
   * @param {string} boardId - The board ID
   * @param {string} topic - The thread topic
   * @param {string} content - The initial post content
   * @param {string} imagePath - Path to the uploaded image
   * @param {string} ipAddress - IP address of the poster
   * @param {Object} boardSettings - Board settings for thread IDs and country flags
   * @returns {Promise<Object>} Object with threadId and boardId
   */
  createThread: async (
    boardId,
    topic,
    content,
    imagePath,
    ipAddress,
    boardSettings
  ) => {
    console.log(`Model: Creating thread in board ${boardId}: "${topic}"`);
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query("BEGIN");

      // Count threads in this board
      const threadCountResult = await client.query(
        "SELECT COUNT(*) FROM threads WHERE board_id = $1",
        [boardId]
      );

      const threadCount = parseInt(threadCountResult.rows[0].count);
      console.log(
        `Model: Current thread count for board ${boardId}: ${threadCount}`
      );

      // If we have 100 threads, delete the oldest one
      if (threadCount >= 100) {
        console.log(
          `Model: Board ${boardId} has reached 100 threads limit, removing oldest thread`
        );

        // Get the oldest thread and its image URLs before deletion
        const oldestThreadResult = await client.query(
          `
          SELECT t.id, array_agg(p.image_url) as image_urls
          FROM threads t
          LEFT JOIN posts p ON p.thread_id = t.id AND p.board_id = t.board_id
          WHERE t.board_id = $1 AND p.image_url IS NOT NULL
          GROUP BY t.id
          ORDER BY t.updated_at ASC 
          LIMIT 1
          `,
          [boardId]
        );

        if (oldestThreadResult.rows.length > 0) {
          const oldestThreadId = oldestThreadResult.rows[0].id;
          const imageUrls = oldestThreadResult.rows[0].image_urls || [];

          console.log(
            `Model: Deleting oldest thread ${oldestThreadId} from board ${boardId} with ${imageUrls.length} images`
          );

          // Delete the oldest thread (posts will cascade delete)
          await client.query(
            "DELETE FROM threads WHERE id = $1 AND board_id = $2",
            [oldestThreadId, boardId]
          );

          // Delete images from R2 after transaction commits
          // We'll do this outside the transaction to avoid blocking
          setImmediate(async () => {
            for (const imageUrl of imageUrls) {
              if (imageUrl) {
                try {
                  await fileUtils.deleteFile(imageUrl);
                  console.log(`Model: Deleted image from R2: ${imageUrl}`);
                } catch (err) {
                  console.error(
                    `Model: Failed to delete image from R2: ${imageUrl}`,
                    err
                  );
                }
              }
            }
          });
        }
      }

      // Generate thread salt for thread IDs
      const threadSalt = generateThreadSalt();

      // Create new thread
      const threadResult = await client.query(
        `
        INSERT INTO threads (board_id, topic, created_at, updated_at, thread_salt)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3)
        RETURNING id
        `,
        [boardId, topic, threadSalt]
      );

      const threadId = threadResult.rows[0].id;
      console.log(`Model: Created thread with ID: ${threadId}`);

      // Determine file type
      const fileType = imagePath.match(/\.(mp4|webm)$/i) ? "video" : "image";

      // Import required utilities for the first post
      const { generateThreadUserId } = require("../utils/threadIdGenerator");
      const { getCountryCode } = require("../utils/countryLookup");

      // Generate thread user ID if enabled
      let threadUserId = null;
      if (boardSettings.thread_ids_enabled) {
        threadUserId = generateThreadUserId(ipAddress, threadId, threadSalt);
      }

      // Get country code if enabled
      let countryCode = null;
      if (boardSettings.country_flags_enabled) {
        countryCode = getCountryCode(ipAddress);
      }

      // Create initial post with media
      await client.query(
        `
        INSERT INTO posts (thread_id, board_id, content, image_url, file_type, created_at, ip_address, thread_user_id, country_code, color)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9)
        `,
        [
          threadId,
          boardId,
          content,
          imagePath,
          fileType,
          ipAddress,
          threadUserId,
          countryCode,
          "black", // Default color
        ]
      );
      console.log(
        `Model: Created initial post with ${fileType} for thread ${threadId}`
      );

      // Commit transaction
      await client.query("COMMIT");

      return { threadId, boardId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createThread:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a thread and clean up its images
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  deleteThread: async (threadId, boardId) => {
    console.log(`Model: Deleting thread ${threadId} from board ${boardId}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get all image URLs before deletion
      const imageResult = await client.query(
        `
        SELECT image_url 
        FROM posts 
        WHERE thread_id = $1 AND board_id = $2 AND image_url IS NOT NULL
        `,
        [threadId, boardId]
      );

      const imageUrls = imageResult.rows.map((row) => row.image_url);
      console.log(
        `Model: Found ${imageUrls.length} media files to delete for thread ${threadId}`
      );

      // Delete the thread (posts will cascade delete)
      const deleteResult = await client.query(
        "DELETE FROM threads WHERE id = $1 AND board_id = $2 RETURNING id",
        [threadId, boardId]
      );

      if (deleteResult.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: Thread ${threadId} not found`);
        return false;
      }

      await client.query("COMMIT");

      // Delete images from R2 (do this after commit to avoid blocking)
      setImmediate(async () => {
        for (const imageUrl of imageUrls) {
          try {
            await fileUtils.deleteFile(imageUrl);
            console.log(`Model: Deleted media from R2: ${imageUrl}`);
          } catch (err) {
            console.error(
              `Model: Failed to delete media from R2: ${imageUrl}`,
              err
            );
          }
        }
      });

      console.log(`Model: Successfully deleted thread ${threadId}`);
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - deleteThread(${threadId}):`, error);
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = threadModel;
