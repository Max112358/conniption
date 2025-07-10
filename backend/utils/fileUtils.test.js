// backend/utils/fileUtils.test.js
const fileUtils = require("./fileUtils");
const { s3Client, R2_BUCKET_NAME } = require("../config/r2");

// Mock dependencies
jest.mock("../config/r2", () => ({
  s3Client: {
    send: jest.fn(),
  },
  R2_BUCKET_NAME: "test-bucket",
}));

jest.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

describe("File Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe("deleteFile", () => {
    it("should delete file from R2 successfully", async () => {
      const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
      const fileUrl = "https://test.r2.dev/image.jpg";

      s3Client.send.mockResolvedValue({});

      const result = await fileUtils.deleteFile(fileUrl);

      expect(result).toBe(true);
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "image.jpg",
      });
      expect(s3Client.send).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Deleting file from R2: image.jpg"
      );
      expect(console.log).toHaveBeenCalledWith(
        "File deleted successfully from R2: image.jpg"
      );
    });

    it("should handle deletion errors", async () => {
      const fileUrl = "https://test.r2.dev/image.jpg";
      const error = new Error("S3 deletion failed");

      s3Client.send.mockRejectedValue(error);

      await expect(fileUtils.deleteFile(fileUrl)).rejects.toThrow(
        "S3 deletion failed"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error deleting file from R2:",
        error
      );
    });

    it("should extract object key from complex URL", async () => {
      const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
      const fileUrl = "https://test.r2.dev/folder/subfolder/image.jpg";

      s3Client.send.mockResolvedValue({});

      await fileUtils.deleteFile(fileUrl);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "image.jpg", // Should extract just the filename
      });
    });

    it("should handle URLs with query parameters", async () => {
      const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
      const fileUrl = "https://test.r2.dev/image.jpg?v=1&cache=false";

      s3Client.send.mockResolvedValue({});

      await fileUtils.deleteFile(fileUrl);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "image.jpg?v=1&cache=false", // Should extract everything after last slash
      });
    });
  });

  describe("cleanupOldFiles", () => {
    it("should clean up old files successfully", async () => {
      const {
        ListObjectsV2Command,
        DeleteObjectCommand,
      } = require("@aws-sdk/client-s3");

      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 2); // 2 hours ago

      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30); // 30 minutes ago

      const mockObjects = [
        {
          Key: "old-file.jpg",
          LastModified: oldDate,
        },
        {
          Key: "recent-file.jpg",
          LastModified: recentDate,
        },
      ];

      s3Client.send
        .mockResolvedValueOnce({
          Contents: mockObjects,
        }) // ListObjectsV2Command
        .mockResolvedValue({}); // DeleteObjectCommand calls

      const maxAge = 60 * 60 * 1000; // 1 hour
      const result = await fileUtils.cleanupOldFiles(maxAge);

      expect(result).toBe(1); // Only one file should be deleted
      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: "test-bucket",
      });
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "old-file.jpg",
      });
      expect(console.log).toHaveBeenCalledWith(
        "Cleanup complete: 1 files deleted from R2"
      );
    });

    it("should handle empty bucket", async () => {
      const { ListObjectsV2Command } = require("@aws-sdk/client-s3");

      s3Client.send.mockResolvedValue({
        Contents: [],
      });

      const result = await fileUtils.cleanupOldFiles(60 * 60 * 1000);

      expect(result).toBe(0);
      expect(console.log).toHaveBeenCalledWith("No files found in R2 bucket.");
    });

    it("should handle bucket with no Contents property", async () => {
      s3Client.send.mockResolvedValue({}); // No Contents property

      const result = await fileUtils.cleanupOldFiles(60 * 60 * 1000);

      expect(result).toBe(0);
      expect(console.log).toHaveBeenCalledWith("No files found in R2 bucket.");
    });

    it("should skip recent files", async () => {
      const recentDate = new Date();
      const mockObjects = [
        {
          Key: "recent-file.jpg",
          LastModified: recentDate,
        },
      ];

      s3Client.send.mockResolvedValue({
        Contents: mockObjects,
      });

      const maxAge = 60 * 60 * 1000; // 1 hour
      const result = await fileUtils.cleanupOldFiles(maxAge);

      expect(result).toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        "Cleanup complete: 0 files deleted from R2"
      );
    });

    it("should handle deletion errors gracefully", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 2);

      const mockObjects = [
        {
          Key: "old-file.jpg",
          LastModified: oldDate,
        },
      ];

      s3Client.send
        .mockResolvedValueOnce({
          Contents: mockObjects,
        }) // ListObjectsV2Command
        .mockRejectedValueOnce(new Error("Deletion failed")); // DeleteObjectCommand

      // Catch the error thrown by the function
      await expect(fileUtils.cleanupOldFiles(60 * 60 * 1000)).rejects.toThrow(
        "Deletion failed"
      );
    });

    it("should handle list operation errors", async () => {
      s3Client.send.mockRejectedValue(new Error("List operation failed"));

      await expect(fileUtils.cleanupOldFiles(60 * 60 * 1000)).rejects.toThrow(
        "List operation failed"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error cleaning up old files in R2:",
        expect.any(Error)
      );
    });
  });
});
