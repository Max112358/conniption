// backend/utils/fileUtils.js
const fs = require("fs");
const path = require("path");

/**
 * Utility functions for file operations
 */
const fileUtils = {
  /**
   * Delete a file
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<boolean>} Success status
   */
  deleteFile: (filePath) => {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err);
          reject(err);
          return;
        }
        console.log(`File deleted successfully: ${filePath}`);
        resolve(true);
      });
    });
  },

  /**
   * Ensure upload directory exists
   * @returns {Promise<string>} Path to upload directory
   */
  ensureUploadDir: () => {
    return new Promise((resolve, reject) => {
      const uploadDir = path.join(__dirname, "..", "uploads");

      fs.mkdir(uploadDir, { recursive: true }, (err) => {
        if (err) {
          console.error(`Error creating upload directory ${uploadDir}:`, err);
          reject(err);
          return;
        }
        console.log(`Upload directory ensured: ${uploadDir}`);
        resolve(uploadDir);
      });
    });
  },

  /**
   * Clean up old files (could be used in a scheduled job)
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of files deleted
   */
  cleanupOldFiles: (maxAge) => {
    return new Promise(async (resolve, reject) => {
      try {
        const uploadDir = await fileUtils.ensureUploadDir();

        fs.readdir(uploadDir, (err, files) => {
          if (err) {
            console.error(`Error reading upload directory ${uploadDir}:`, err);
            reject(err);
            return;
          }

          const now = Date.now();
          let deletedCount = 0;

          const deletePromises = files.map((file) => {
            return new Promise((resolve) => {
              const filePath = path.join(uploadDir, file);

              fs.stat(filePath, (err, stats) => {
                if (err) {
                  console.error(
                    `Error getting file stats for ${filePath}:`,
                    err
                  );
                  resolve();
                  return;
                }

                const fileAge = now - stats.mtime.getTime();

                if (fileAge > maxAge) {
                  fileUtils
                    .deleteFile(filePath)
                    .then(() => {
                      deletedCount++;
                      resolve();
                    })
                    .catch(() => resolve());
                } else {
                  resolve();
                }
              });
            });
          });

          Promise.all(deletePromises)
            .then(() => {
              console.log(`Cleanup complete: ${deletedCount} files deleted`);
              resolve(deletedCount);
            })
            .catch(reject);
        });
      } catch (err) {
        reject(err);
      }
    });
  },
};

module.exports = fileUtils;
