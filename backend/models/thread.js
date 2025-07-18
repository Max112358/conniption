// backend/models/thread.js
const { pool } = require("../config/database");
const transformImageUrl = require("../utils/transformImageUrl");
const fileUtils = require("../utils/fileUtils");
const { generateThreadSalt } = require("../utils/threadIdGenerator");
const threadConfig = require("../config/threads");

/**
 * Thread model functions
 */
const threadModel = {
  /**
   * Get threads for a board (excluding dead threads)
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
          t.is_sticky,
          t.is_dead,
          t.died_at,
          t.post_count,
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
          AND t.is_dead = FALSE
          AND p.id = (SELECT MIN(id) FROM posts WHERE thread_id = t.id)
        ORDER BY 
          t.is_sticky DESC,
          t.updated_at DESC
        `,
        [boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} active threads for board: ${boardId}`
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
   * Get a thread by ID (including dead threads)
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @returns {Promise<Object>} Thread object
   */
  getThreadById: async (threadId, boardId) => {
    console.log(`Model: Getting thread ${threadId} in board ${boardId}`);
    try {
      const result = await pool.query(
        `
        SELECT id, board_id, topic, created_at, updated_at, thread_salt, is_sticky, is_dead, died_at, post_count
        FROM threads
        WHERE id = $1 AND board_id = $2
        `,
        [threadId, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Thread not found with ID: ${threadId}`);
        return null;
      }

      console.log(
        `Model: Found thread: ${result.rows[0].topic} (dead: ${result.rows[0].is_dead})`
      );
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
   * @returns {Promise<Object>} Object with threadId, boardId, and postId
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

      // Count non-sticky, non-dead threads in this board
      const threadCountResult = await client.query(
        "SELECT COUNT(*) FROM threads WHERE board_id = $1 AND is_sticky = FALSE AND is_dead = FALSE",
        [boardId]
      );

      const threadCount = parseInt(threadCountResult.rows[0].count);
      console.log(
        `Model: Current active non-sticky thread count for board ${boardId}: ${threadCount}`
      );

      // Use configurable thread limit
      const maxThreads = threadConfig.maxThreadsPerBoard || 100;

      // If we have reached the thread limit, mark the oldest one as dead
      if (threadCount >= maxThreads) {
        console.log(
          `Model: Board ${boardId} has reached ${maxThreads} active non-sticky threads limit, marking oldest as dead`
        );

        // Mark the oldest non-sticky, non-dead thread as dead
        const markDeadResult = await client.query(
          `
          UPDATE threads 
          SET is_dead = TRUE, died_at = CURRENT_TIMESTAMP
          WHERE id = (
            SELECT id 
            FROM threads 
            WHERE board_id = $1 AND is_sticky = FALSE AND is_dead = FALSE
            ORDER BY updated_at ASC 
            LIMIT 1
          )
          RETURNING id
          `,
          [boardId]
        );

        if (markDeadResult.rows.length > 0) {
          console.log(
            `Model: Marked thread ${markDeadResult.rows[0].id} as dead`
          );

          // Emit thread_died event
          const io = require("../utils/socketHandler").getIo;
          const socketIo = io();
          if (socketIo) {
            const deadThreadId = markDeadResult.rows[0].id;
            const roomId = `${boardId}-${deadThreadId}`;
            console.log(`Emitting thread_died event to room ${roomId}`);

            socketIo.to(roomId).emit("thread_died", {
              threadId: deadThreadId,
              boardId: boardId,
              diedAt: new Date().toISOString(),
            });

            // Also emit to board room so board page can update
            socketIo.to(boardId).emit("thread_died", {
              threadId: deadThreadId,
              boardId: boardId,
              diedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Generate thread salt for thread IDs
      const threadSalt = generateThreadSalt();

      // Create new thread with initial post count of 1
      const threadResult = await client.query(
        `
        INSERT INTO threads (board_id, topic, created_at, updated_at, thread_salt, is_sticky, is_dead, died_at, post_count)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, FALSE, FALSE, NULL, 1)
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

      // Create initial post with media and return its ID
      const postResult = await client.query(
        `
        INSERT INTO posts (thread_id, board_id, content, image_url, file_type, created_at, ip_address, thread_user_id, country_code, color, dont_bump)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, $10)
        RETURNING id
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
          false, // First post always bumps (creates the thread)
        ]
      );

      const postId = postResult.rows[0].id;
      console.log(
        `Model: Created initial post with ID ${postId} and ${fileType} for thread ${threadId}`
      );

      // Commit transaction
      await client.query("COMMIT");

      return { threadId, boardId, postId };
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

  /**
   * Toggle sticky status of a thread
   * @param {number} threadId - The thread ID
   * @param {string} boardId - The board ID
   * @param {boolean} isSticky - Whether to make the thread sticky
   * @returns {Promise<Object|null>} Updated thread object or null if not found
   */
  updateStickyStatus: async (threadId, boardId, isSticky) => {
    console.log(
      `Model: Updating sticky status for thread ${threadId} to ${isSticky}`
    );

    try {
      const result = await pool.query(
        `
        UPDATE threads 
        SET is_sticky = $1
        WHERE id = $2 AND board_id = $3
        RETURNING id, board_id, topic, created_at, updated_at, thread_salt, is_sticky, is_dead, died_at, post_count
        `,
        [isSticky, threadId, boardId]
      );

      if (result.rows.length === 0) {
        console.log(`Model: Thread not found with ID: ${threadId}`);
        return null;
      }

      console.log(
        `Model: Updated thread ${threadId} sticky status to ${isSticky}`
      );
      return result.rows[0];
    } catch (error) {
      console.error(`Model Error - updateStickyStatus(${threadId}):`, error);
      throw error;
    }
  },

  /**
   * Get all sticky threads for a board
   * @param {string} boardId - The board ID
   * @returns {Promise<Array>} Array of sticky thread objects
   */
  getStickyThreads: async (boardId) => {
    console.log(`Model: Getting sticky threads for board: ${boardId}`);

    try {
      const result = await pool.query(
        `
        SELECT id, board_id, topic, created_at, updated_at, thread_salt, is_sticky, is_dead, died_at, post_count
        FROM threads
        WHERE board_id = $1 AND is_sticky = TRUE
        ORDER BY updated_at DESC
        `,
        [boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} sticky threads for board: ${boardId}`
      );
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getStickyThreads(${boardId}):`, error);
      throw error;
    }
  },

  /**
   * Get dead threads that have expired (using configurable retention period)
   * @returns {Promise<Array>} Array of expired dead thread objects
   */
  getExpiredDeadThreads: async () => {
    console.log(`Model: Getting expired dead threads`);

    try {
      const retentionDays = threadConfig.deadThreadRetentionDays || 2;
      const result = await pool.query(
        `
        SELECT t.id, t.board_id, array_agg(p.image_url) as image_urls
        FROM threads t
        LEFT JOIN posts p ON p.thread_id = t.id AND p.board_id = t.board_id
        WHERE t.is_dead = TRUE 
        AND t.died_at < NOW() - INTERVAL '${retentionDays} days'
        AND p.image_url IS NOT NULL
        GROUP BY t.id, t.board_id
        `,
        []
      );

      console.log(
        `Model: Found ${result.rows.length} expired dead threads (older than ${retentionDays} days)`
      );
      return result.rows;
    } catch (error) {
      console.error(`Model Error - getExpiredDeadThreads:`, error);
      throw error;
    }
  },

  /**
   * Delete expired dead threads
   * @returns {Promise<number>} Number of threads deleted
   */
  deleteExpiredDeadThreads: async () => {
    console.log(`Model: Deleting expired dead threads`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get all expired dead threads with their images
      const expiredThreads = await threadModel.getExpiredDeadThreads();

      if (expiredThreads.length === 0) {
        await client.query("COMMIT");
        return 0;
      }

      // Collect all image URLs
      const allImageUrls = [];
      for (const thread of expiredThreads) {
        if (thread.image_urls) {
          allImageUrls.push(...thread.image_urls.filter((url) => url !== null));
        }
      }

      // Delete the threads (posts and surveys will cascade delete)
      const retentionDays = threadConfig.deadThreadRetentionDays || 2;
      const deleteResult = await client.query(
        `
        DELETE FROM threads
        WHERE is_dead = TRUE 
        AND died_at < NOW() - INTERVAL '${retentionDays} days'
        `,
        []
      );

      await client.query("COMMIT");

      const deletedCount = deleteResult.rowCount;
      console.log(`Model: Deleted ${deletedCount} expired dead threads`);

      // Delete images from R2 (do this after commit to avoid blocking)
      if (allImageUrls.length > 0) {
        setImmediate(async () => {
          for (const imageUrl of allImageUrls) {
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
      }

      return deletedCount;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - deleteExpiredDeadThreads:`, error);
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = threadModel;
