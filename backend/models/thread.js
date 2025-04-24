// backend/models/thread.js
const { pool } = require("../config/database");

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
          p.content,
          p.image_path,
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
      return result.rows;
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
        SELECT id, board_id, topic, created_at, updated_at
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
   * @returns {Promise<Object>} Object with threadId and boardId
   */
  createThread: async (boardId, topic, content, imagePath) => {
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
        const oldestThreadResult = await client.query(
          `
          SELECT id 
          FROM threads 
          WHERE board_id = $1 
          ORDER BY updated_at ASC 
          LIMIT 1
          `,
          [boardId]
        );

        if (oldestThreadResult.rows.length > 0) {
          const oldestThreadId = oldestThreadResult.rows[0].id;
          console.log(
            `Model: Deleting oldest thread ${oldestThreadId} from board ${boardId}`
          );

          // Delete the oldest thread and its posts (should cascade delete)
          await client.query(
            "DELETE FROM threads WHERE id = $1 AND board_id = $2",
            [oldestThreadId, boardId]
          );
        }
      }

      // Create new thread
      const threadResult = await client.query(
        `
        INSERT INTO threads (board_id, topic, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        `,
        [boardId, topic]
      );

      const threadId = threadResult.rows[0].id;
      console.log(`Model: Created thread with ID: ${threadId}`);

      // Create initial post with image
      await client.query(
        `
        INSERT INTO posts (thread_id, board_id, content, image_path, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `,
        [threadId, boardId, content, imagePath]
      );
      console.log(`Model: Created initial post for thread ${threadId}`);

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
};

module.exports = threadModel;
