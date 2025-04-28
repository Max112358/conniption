// backend/config/r2.js
const { S3Client } = require("@aws-sdk/client-s3");

// Configure R2 credentials
const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID || "ee8bca22445b082633aad26691317236";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "your_access_key_here";
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY || "your_secret_key_here";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "conniption-bucket";

// Custom domain URL (replace with your actual domain)
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL || "https://images.yourdomain.com";

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
