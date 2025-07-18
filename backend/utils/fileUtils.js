// backend/utils/fileUtils.js
const {
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { s3Client, R2_BUCKET_NAME } = require("../config/r2");
const path = require("path");

/**
 * Utility functions for R2 file operations
 */
const fileUtils = {
  /**
   * Delete a file from R2
   * @param {string} fileUrl - Full URL of the file to delete
   * @returns {Promise<boolean>} Success status
   */
  deleteFile: async (fileUrl) => {
    try {
      // Validate URL format
      if (!fileUrl || typeof fileUrl !== "string") {
        throw new Error("Invalid file URL provided");
      }

      // Extract the object key from the URL
      const urlParts = fileUrl.split("/");
      const objectKey = urlParts[urlParts.length - 1];

      // Validate object key - prevent path traversal
      if (!objectKey || objectKey.includes("..") || objectKey.includes("\\")) {
        throw new Error("Invalid object key");
      }

      // Additional validation: ensure it's a valid filename pattern
      const validFilenamePattern =
        /^[0-9]+-[0-9]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3)$/i;
      if (!validFilenamePattern.test(objectKey)) {
        console.error(`Invalid filename pattern: ${objectKey}`);
        throw new Error("Invalid filename format");
      }

      console.log(`Deleting file from R2: ${objectKey}`);

      const deleteCommand = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      });

      await s3Client.send(deleteCommand);
      console.log(`File deleted successfully from R2: ${objectKey}`);
      return true;
    } catch (err) {
      console.error(`Error deleting file from R2:`, err);
      throw err;
    }
  },

  /**
   * Clean up old files in R2 based on age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of files deleted
   */
  cleanupOldFiles: async (maxAge) => {
    try {
      // Validate maxAge
      if (!maxAge || typeof maxAge !== "number" || maxAge < 0) {
        throw new Error("Invalid maxAge parameter");
      }

      console.log(`Cleaning up old files in R2 bucket: ${R2_BUCKET_NAME}`);

      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
      });

      const response = await s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        console.log("No files found in R2 bucket.");
        return 0;
      }

      const now = Date.now();
      let deletedCount = 0;

      for (const object of response.Contents) {
        // Validate object key before deletion
        if (object.Key && object.Key.includes("..")) {
          console.warn(`Skipping suspicious object key: ${object.Key}`);
          continue;
        }

        const fileAge = now - object.LastModified.getTime();

        if (fileAge > maxAge) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: object.Key,
          });

          await s3Client.send(deleteCommand);
          deletedCount++;
          console.log(`Deleted old file from R2: ${object.Key}`);
        }
      }

      console.log(`Cleanup complete: ${deletedCount} files deleted from R2`);
      return deletedCount;
    } catch (err) {
      console.error("Error cleaning up old files in R2:", err);
      throw err;
    }
  },
};

module.exports = fileUtils;
