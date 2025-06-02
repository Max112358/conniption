// backend/services/housekeeping.js
const { pool } = require("../config/database");
const { s3Client, R2_BUCKET_NAME } = require("../config/r2");
const {
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

/**
 * Housekeeping service for cleaning up orphaned files and old data
 */
const housekeepingService = {
  /**
   * Clean up orphaned files in R2 that are not referenced in the database
   * @returns {Promise<Object>} Cleanup results
   */
  cleanupOrphanedFiles: async () => {
    console.log("Housekeeping: Starting orphaned file cleanup");
    const startTime = Date.now();

    try {
      // Step 1: Get all files from R2
      const allFiles = await housekeepingService.getAllR2Files();
      console.log(`Housekeeping: Found ${allFiles.length} files in R2`);

      // Step 2: Get all image URLs from database
      const dbImages = await housekeepingService.getAllDatabaseImages();
      console.log(
        `Housekeeping: Found ${dbImages.length} image references in database`
      );

      // Step 3: Extract filenames from database URLs
      const dbFilenames = new Set(
        dbImages.map((url) => {
          // Extract filename from URL (last part after /)
          const parts = url.split("/");
          return parts[parts.length - 1];
        })
      );

      // Step 4: Find orphaned files
      const orphanedFiles = allFiles.filter(
        (file) => !dbFilenames.has(file.Key)
      );
      console.log(`Housekeeping: Found ${orphanedFiles.length} orphaned files`);

      // Step 5: Delete orphaned files
      let deletedCount = 0;
      let errorCount = 0;

      for (const file of orphanedFiles) {
        try {
          // Skip if file is too new (less than 1 hour old) to avoid race conditions
          const fileAge = Date.now() - file.LastModified.getTime();
          if (fileAge < 60 * 60 * 1000) {
            console.log(
              `Housekeeping: Skipping recent file ${file.Key} (${Math.round(
                fileAge / 1000 / 60
              )} minutes old)`
            );
            continue;
          }

          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: file.Key,
            })
          );
          deletedCount++;
          console.log(`Housekeeping: Deleted orphaned file ${file.Key}`);
        } catch (err) {
          errorCount++;
          console.error(
            `Housekeeping: Error deleting file ${file.Key}:`,
            err.message
          );
        }
      }

      const duration = Date.now() - startTime;
      const results = {
        totalFiles: allFiles.length,
        databaseImages: dbImages.length,
        orphanedFiles: orphanedFiles.length,
        deletedFiles: deletedCount,
        errors: errorCount,
        duration: duration,
      };

      console.log(
        `Housekeeping: Cleanup completed in ${duration}ms. Deleted ${deletedCount} files.`
      );
      return results;
    } catch (error) {
      console.error("Housekeeping: Error during cleanup:", error);
      throw error;
    }
  },

  /**
   * Get all files from R2 bucket
   * @returns {Promise<Array>} Array of file objects
   */
  getAllR2Files: async () => {
    const allFiles = [];
    let continuationToken = null;

    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        allFiles.push(...response.Contents);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return allFiles;
  },

  /**
   * Get all image URLs from the database
   * @returns {Promise<Array>} Array of image URLs
   */
  getAllDatabaseImages: async () => {
    const result = await pool.query(`
      SELECT DISTINCT image_url 
      FROM posts 
      WHERE image_url IS NOT NULL
      
      UNION
      
      SELECT DISTINCT post_image_url 
      FROM bans 
      WHERE post_image_url IS NOT NULL
    `);

    return result.rows.map((row) => row.image_url || row.post_image_url);
  },

  /**
   * Clean up old threads that exceed the 100 thread limit per board
   * This is a backup in case the real-time deletion fails
   * @returns {Promise<Object>} Cleanup results
   */
  cleanupExcessThreads: async () => {
    console.log("Housekeeping: Starting excess thread cleanup");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get boards that have more than 100 threads
      const boardsResult = await client.query(`
        SELECT board_id, COUNT(*) as thread_count
        FROM threads
        GROUP BY board_id
        HAVING COUNT(*) > 100
      `);

      let totalDeleted = 0;

      for (const board of boardsResult.rows) {
        const excessCount = board.thread_count - 100;
        console.log(
          `Housekeeping: Board ${board.board_id} has ${board.thread_count} threads, deleting ${excessCount} oldest`
        );

        // Delete oldest threads beyond 100
        const deleteResult = await client.query(
          `
          DELETE FROM threads
          WHERE id IN (
            SELECT id
            FROM threads
            WHERE board_id = $1
            ORDER BY updated_at ASC
            LIMIT $2
          )
          `,
          [board.board_id, excessCount]
        );

        totalDeleted += deleteResult.rowCount;
      }

      await client.query("COMMIT");
      console.log(`Housekeeping: Deleted ${totalDeleted} excess threads`);

      return {
        boardsChecked: boardsResult.rows.length,
        threadsDeleted: totalDeleted,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Housekeeping: Error cleaning up excess threads:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Run all housekeeping tasks
   * @returns {Promise<Object>} Combined results
   */
  runAllTasks: async () => {
    console.log("Housekeeping: Running all housekeeping tasks");
    const results = {
      timestamp: new Date().toISOString(),
      tasks: {},
    };

    // Run thread cleanup
    try {
      results.tasks.threadCleanup =
        await housekeepingService.cleanupExcessThreads();
    } catch (error) {
      results.tasks.threadCleanup = { error: error.message };
    }

    // Run file cleanup
    try {
      results.tasks.fileCleanup =
        await housekeepingService.cleanupOrphanedFiles();
    } catch (error) {
      results.tasks.fileCleanup = { error: error.message };
    }

    return results;
  },
};

module.exports = housekeepingService;
