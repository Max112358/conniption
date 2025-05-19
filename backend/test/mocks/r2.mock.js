// backend/test/mocks/r2.mock.js
const mockS3 = require("mock-aws-s3");
const path = require("path");
const fs = require("fs");

// Initialize mock S3 client
mockS3.config.basePath = path.join(__dirname, ".s3");

// Create the mock directory if it doesn't exist
if (!fs.existsSync(mockS3.config.basePath)) {
  fs.mkdirSync(mockS3.config.basePath, { recursive: true });
}

// Create a mock S3 client
const s3Client = mockS3.S3({
  region: "auto",
  endpoint: "https://test.r2.dev",
  credentials: {
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
  },
});

// Mock configuration
const R2_BUCKET_NAME = "test-bucket";
const R2_PUBLIC_URL = "https://test.r2.dev";

// Helper function to create public URL for an object
const getPublicUrl = (objectKey) => {
  return `${R2_PUBLIC_URL}/${objectKey}`;
};

// Create test bucket if it doesn't exist
s3Client.createBucket({ Bucket: R2_BUCKET_NAME }, (err) => {
  if (err && err.code !== "BucketAlreadyExists") {
    console.error("Error creating test bucket:", err);
  }
});

module.exports = {
  s3Client,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  getPublicUrl,
  cleanUp: () => {
    // Clean up mock S3 directory after tests
    if (fs.existsSync(mockS3.config.basePath)) {
      fs.rmSync(mockS3.config.basePath, { recursive: true, force: true });
    }
  },
};
