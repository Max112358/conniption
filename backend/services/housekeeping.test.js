// backend/services/housekeeping.test.js
const housekeepingService = require("./housekeeping");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock("../config/r2", () => ({
  s3Client: {
    send: jest.fn(),
  },
  R2_BUCKET_NAME: "test-bucket",
}));

jest.mock("@aws-sdk/client-s3", () => ({
  ListObjectsV2Command: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

describe("Housekeeping Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe("getAllR2Files", () => {
    it("should get all files from R2 bucket", async () => {
      const { s3Client } = require("../config/r2");
      const { ListObjectsV2Command } = require("@aws-sdk/client-s3");

      const mockFiles = [
        { Key: "file1.jpg", LastModified: new Date(), Size: 1024 },
        { Key: "file2.jpg", LastModified: new Date(), Size: 2048 },
      ];

      s3Client.send.mockResolvedValue({
        Contents: mockFiles,
        NextContinuationToken: null,
      });

      const files = await housekeepingService.getAllR2Files();

      expect(files).toEqual(mockFiles);
      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        ContinuationToken: null,
        MaxKeys: 1000,
      });
    });

    it("should handle paginated results", async () => {
      const { s3Client } = require("../config/r2");

      const mockFiles1 = [
        { Key: "file1.jpg", LastModified: new Date(), Size: 1024 },
      ];
      const mockFiles2 = [
        { Key: "file2.jpg", LastModified: new Date(), Size: 2048 },
      ];

      s3Client.send
        .mockResolvedValueOnce({
          Contents: mockFiles1,
          NextContinuationToken: "token123",
        })
        .mockResolvedValueOnce({
          Contents: mockFiles2,
          NextContinuationToken: null,
        });

      const files = await housekeepingService.getAllR2Files();

      expect(files).toEqual([...mockFiles1, ...mockFiles2]);
      expect(s3Client.send).toHaveBeenCalledTimes(2);
    });

    it("should handle empty bucket", async () => {
      const { s3Client } = require("../config/r2");

      s3Client.send.mockResolvedValue({
        Contents: null,
        NextContinuationToken: null,
      });

      const files = await housekeepingService.getAllR2Files();

      expect(files).toEqual([]);
    });
  });

  describe("getAllDatabaseImages", () => {
    it("should get all image URLs from database", async () => {
      const { pool } = require("../config/database");

      const mockResults = [
        { image_url: "https://test.r2.dev/image1.jpg" },
        { post_image_url: "https://test.r2.dev/image2.jpg" },
        { image_url: "https://test.r2.dev/image3.jpg" },
      ];

      pool.query.mockResolvedValue({ rows: mockResults });

      const images = await housekeepingService.getAllDatabaseImages();

      expect(images).toEqual([
        "https://test.r2.dev/image1.jpg",
        "https://test.r2.dev/image2.jpg",
        "https://test.r2.dev/image3.jpg",
      ]);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("UNION"));
    });

    it("should handle empty database", async () => {
      const { pool } = require("../config/database");

      pool.query.mockResolvedValue({ rows: [] });

      const images = await housekeepingService.getAllDatabaseImages();

      expect(images).toEqual([]);
    });
  });

  describe("cleanupExcessThreads", () => {
    it("should clean up excess threads", async () => {
      const { pool } = require("../config/database");
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      // Mock boards with excess threads
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            { board_id: "tech", thread_count: "105" },
            { board_id: "gaming", thread_count: "102" },
          ],
        }) // SELECT boards with >100 threads
        .mockResolvedValueOnce({ rowCount: 5 }) // DELETE tech threads
        .mockResolvedValueOnce({ rowCount: 2 }) // DELETE gaming threads
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await housekeepingService.cleanupExcessThreads();

      expect(result).toEqual({
        boardsChecked: 2,
        threadsDeleted: 7,
      });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should handle no excess threads", async () => {
      const { pool } = require("../config/database");
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // No boards with >100 threads
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await housekeepingService.cleanupExcessThreads();

      expect(result).toEqual({
        boardsChecked: 0,
        threadsDeleted: 0,
      });
    });

    it("should handle database errors", async () => {
      const { pool } = require("../config/database");
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // SELECT fails

      await expect(housekeepingService.cleanupExcessThreads()).rejects.toThrow(
        "Database error"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("cleanupOrphanedFiles", () => {
    it("should identify and delete orphaned files", async () => {
      const { s3Client } = require("../config/r2");
      const { pool } = require("../config/database");

      // Mock R2 files
      const mockR2Files = [
        {
          Key: "image1.jpg",
          LastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }, // 2 hours old
        {
          Key: "image2.jpg",
          LastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }, // 2 hours old
        {
          Key: "image3.jpg",
          LastModified: new Date(Date.now() - 30 * 60 * 1000),
        }, // 30 minutes old (too recent)
      ];

      // Mock database images
      const mockDbImages = [
        { image_url: "https://test.r2.dev/image1.jpg" }, // This file is referenced
      ];

      s3Client.send
        .mockResolvedValueOnce({
          Contents: mockR2Files,
          NextContinuationToken: null,
        }) // getAllR2Files
        .mockResolvedValue({}); // Delete operations

      pool.query.mockResolvedValue({ rows: mockDbImages }); // getAllDatabaseImages

      const result = await housekeepingService.cleanupOrphanedFiles();

      expect(result.totalFiles).toBe(3);
      expect(result.databaseImages).toBe(1);
      expect(result.orphanedFiles).toBe(2); // image2.jpg and image3.jpg
      expect(result.deletedFiles).toBe(1); // Only image2.jpg (image3.jpg is too recent)
      expect(result.errors).toBe(0);
    });

    it("should skip recent files", async () => {
      const { s3Client } = require("../config/r2");
      const { pool } = require("../config/database");

      // Mock R2 files - all recent
      const mockR2Files = [
        {
          Key: "image1.jpg",
          LastModified: new Date(Date.now() - 30 * 60 * 1000),
        }, // 30 minutes old
      ];

      s3Client.send.mockResolvedValue({
        Contents: mockR2Files,
        NextContinuationToken: null,
      });

      pool.query.mockResolvedValue({ rows: [] }); // No database images

      const result = await housekeepingService.cleanupOrphanedFiles();

      expect(result.deletedFiles).toBe(0); // No files deleted due to age
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Skipping recent file")
      );
    });

    it("should handle file deletion errors", async () => {
      const { s3Client } = require("../config/r2");
      const { pool } = require("../config/database");

      const mockR2Files = [
        {
          Key: "image1.jpg",
          LastModified: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];

      s3Client.send
        .mockResolvedValueOnce({
          Contents: mockR2Files,
          NextContinuationToken: null,
        }) // getAllR2Files
        .mockRejectedValueOnce(new Error("Deletion failed")); // Delete operation fails

      pool.query.mockResolvedValue({ rows: [] }); // No database images

      const result = await housekeepingService.cleanupOrphanedFiles();

      expect(result.deletedFiles).toBe(0);
      expect(result.errors).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        "Housekeeping: Error deleting file image1.jpg:",
        "Deletion failed"
      );
    });
  });

  describe("runAllTasks", () => {
    it("should run all housekeeping tasks", async () => {
      // Mock both cleanup functions
      housekeepingService.cleanupExcessThreads = jest.fn().mockResolvedValue({
        boardsChecked: 2,
        threadsDeleted: 5,
      });

      housekeepingService.cleanupOrphanedFiles = jest.fn().mockResolvedValue({
        totalFiles: 10,
        deletedFiles: 3,
        errors: 0,
      });

      const result = await housekeepingService.runAllTasks();

      expect(result.timestamp).toBeDefined();
      expect(result.tasks.threadCleanup).toEqual({
        boardsChecked: 2,
        threadsDeleted: 5,
      });
      expect(result.tasks.fileCleanup).toEqual({
        totalFiles: 10,
        deletedFiles: 3,
        errors: 0,
      });
    });

    it("should handle task errors gracefully", async () => {
      housekeepingService.cleanupExcessThreads = jest
        .fn()
        .mockRejectedValue(new Error("Thread cleanup failed"));

      housekeepingService.cleanupOrphanedFiles = jest.fn().mockResolvedValue({
        totalFiles: 5,
        deletedFiles: 2,
      });

      const result = await housekeepingService.runAllTasks();

      expect(result.tasks.threadCleanup).toEqual({
        error: "Thread cleanup failed",
      });
      expect(result.tasks.fileCleanup).toEqual({
        totalFiles: 5,
        deletedFiles: 2,
      });
    });
  });
});
