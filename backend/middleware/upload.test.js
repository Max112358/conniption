// backend/middleware/upload.test.js
const path = require("path");
const { processUploadResult } = require("./upload");

// Mock dependencies
jest.mock("../config/r2", () => ({
  s3Client: {
    send: jest.fn(),
  },
  R2_BUCKET_NAME: "test-bucket",
  getPublicUrl: (key) => `https://test.r2.dev/${key}`,
}));

jest.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: jest.fn(),
}));

describe("Upload Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("processUploadResult", () => {
    it("should process uploaded image file", async () => {
      req.file = {
        key: "test-image.jpg",
        originalname: "image.jpg",
        size: 1024 * 1024, // 1MB
        location: "https://bucket.r2.cloudflarestorage.com/test-image.jpg",
      };

      await processUploadResult(req, res, next);

      expect(req.file.publicUrl).toBe("https://test.r2.dev/test-image.jpg");
      expect(req.file.location).toBe("https://test.r2.dev/test-image.jpg");
      expect(req.file.fileType).toBe("image");
      expect(next).toHaveBeenCalled();
    });

    it("should process uploaded video file", async () => {
      req.file = {
        key: "test-video.mp4",
        originalname: "video.mp4",
        size: 2 * 1024 * 1024, // 2MB
        location: "https://bucket.r2.cloudflarestorage.com/test-video.mp4",
      };

      await processUploadResult(req, res, next);

      expect(req.file.fileType).toBe("video");
      expect(next).toHaveBeenCalled();
    });

    it("should process webm video file", async () => {
      req.file = {
        key: "test-video.webm",
        originalname: "video.webm",
        size: 1024 * 1024,
        location: "https://bucket.r2.cloudflarestorage.com/test-video.webm",
      };

      await processUploadResult(req, res, next);

      expect(req.file.fileType).toBe("video");
      expect(next).toHaveBeenCalled();
    });

    it("should reject file exceeding 4MB limit", async () => {
      const { s3Client } = require("../config/r2");
      const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

      req.file = {
        key: "large-file.jpg",
        originalname: "large.jpg",
        size: 5 * 1024 * 1024, // 5MB (exceeds 4MB limit)
        location: "https://bucket.r2.cloudflarestorage.com/large-file.jpg",
      };

      s3Client.send.mockResolvedValue({});

      await processUploadResult(req, res, next);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "large-file.jpg",
      });
      expect(s3Client.send).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "File size exceeds 4MB limit",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle file deletion error gracefully", async () => {
      const { s3Client } = require("../config/r2");

      req.file = {
        key: "large-file.jpg",
        originalname: "large.jpg",
        size: 5 * 1024 * 1024, // 5MB
        location: "https://bucket.r2.cloudflarestorage.com/large-file.jpg",
      };

      s3Client.send.mockRejectedValue(new Error("S3 deletion failed"));
      jest.spyOn(console, "error").mockImplementation();

      await processUploadResult(req, res, next);

      expect(console.error).toHaveBeenCalledWith(
        "Error deleting oversized file:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(400);

      console.error.mockRestore();
    });

    it("should call next when no file uploaded", async () => {
      // No req.file

      await processUploadResult(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should handle files with no extension as image", async () => {
      req.file = {
        key: "file-no-ext",
        originalname: "image",
        size: 1024,
        location: "https://bucket.r2.cloudflarestorage.com/file-no-ext",
      };

      await processUploadResult(req, res, next);

      expect(req.file.fileType).toBe("image");
      expect(next).toHaveBeenCalled();
    });

    it("should preserve original location", async () => {
      req.file = {
        key: "test.jpg",
        originalname: "test.jpg",
        size: 1024,
        location: "https://bucket.r2.cloudflarestorage.com/test.jpg",
      };

      await processUploadResult(req, res, next);

      expect(req.file.originalLocation).toBe(
        "https://bucket.r2.cloudflarestorage.com/test.jpg"
      );
      expect(req.file.location).toBe("https://test.r2.dev/test.jpg");
    });
  });

  // Note: Testing the full multer configuration would require more complex setup
  // and might not be worth the effort since it's mostly configuration
  describe("multer configuration (basic validation)", () => {
    it("should be importable without errors", () => {
      expect(() => {
        require("./upload");
      }).not.toThrow();
    });
  });
});
