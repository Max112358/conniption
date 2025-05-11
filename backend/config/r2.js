// backend/config/r2.js
const { S3Client } = require("@aws-sdk/client-s3");

// Configure R2 credentials with strict environment variable requirements
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
if (!R2_ACCOUNT_ID) {
  throw new Error("R2_ACCOUNT_ID environment variable is required");
}

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
if (!R2_ACCESS_KEY_ID) {
  throw new Error("R2_ACCESS_KEY_ID environment variable is required");
}

const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
if (!R2_SECRET_ACCESS_KEY) {
  throw new Error("R2_SECRET_ACCESS_KEY environment variable is required");
}

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
if (!R2_BUCKET_NAME) {
  throw new Error("R2_BUCKET_NAME environment variable is required");
}

// Custom domain URL - strictly require environment variable
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
if (!R2_PUBLIC_URL) {
  throw new Error("R2_PUBLIC_URL environment variable is required");
}

// Create an S3 client configured to use R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Helper function to create public URL for an object
const getPublicUrl = (objectKey) => {
  return `${R2_PUBLIC_URL}/${objectKey}`;
};

module.exports = {
  s3Client,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  getPublicUrl,
};
