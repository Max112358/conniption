// backend/middleware/upload.js
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const { s3Client, R2_BUCKET_NAME, getPublicUrl } = require("../config/r2");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

// Configure multer to use R2 storage
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: R2_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Create unique filename with original extension
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = uniqueSuffix + ext;

      console.log(
        `File upload: Generated filename ${filename} for ${file.originalname}`
      );
      cb(null, filename);
    },
    contentType: function (req, file, cb) {
      // Set proper content type for files
      const mimeTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
      };

      const ext = path.extname(file.originalname).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      cb(null, contentType);
    },
  }),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB limit
    files: 1, // Only allow 1 file per upload
  },
  fileFilter: function (req, file, cb) {
    // Log upload attempt
    console.log(
      `File upload attempt: ${file.originalname}, mimetype: ${
        file.mimetype
      }, size: ${file.size || "unknown"}`
    );

    // Allowed MIME types
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ];

    // Allowed extensions
    const allowedExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".mp4",
      ".webm",
    ];
    const ext = path.extname(file.originalname).toLowerCase();

    // Check both MIME type and extension for security
    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(
        `File upload rejected: ${file.originalname} - invalid MIME type: ${file.mimetype}`
      );
      return cb(
        new Error(
          "Invalid file type. Only PNG, JPG, WebP, GIF, MP4, and WebM files are allowed."
        ),
        false
      );
    }

    if (!allowedExtensions.includes(ext)) {
      console.log(
        `File upload rejected: ${file.originalname} - invalid extension: ${ext}`
      );
      return cb(new Error("Invalid file extension."), false);
    }

    console.log(`File upload accepted: ${file.originalname}`);
    cb(null, true);
  },
});

// Middleware to transform S3 URLs to public custom domain URLs
const processUploadResult = async (req, res, next) => {
  if (req.file) {
    // Security: Verify file size again (belt and suspenders approach)
    if (req.file.size > 4 * 1024 * 1024) {
      // Delete the file from R2
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: req.file.key,
        });
        await s3Client.send(deleteCommand);
        console.log(`Deleted oversized file: ${req.file.key}`);
      } catch (err) {
        console.error("Error deleting oversized file:", err);
      }

      return res.status(400).json({
        error: "File size exceeds 4MB limit",
      });
    }

    // The S3 client will save the direct S3 URL in req.file.location
    // We need to replace this with the public custom domain URL
    const objectKey = req.file.key;
    req.file.publicUrl = getPublicUrl(objectKey);
    req.file.originalLocation = req.file.location; // Store original R2 URL for reference
    req.file.location = req.file.publicUrl; // Replace with custom domain URL

    // Add file type for frontend use
    const ext = path.extname(req.file.originalname).toLowerCase();
    req.file.fileType = [".mp4", ".webm"].includes(ext) ? "video" : "image";

    console.log(`File uploaded to R2: ${req.file.originalLocation}`);
    console.log(`Public URL: ${req.file.publicUrl}`);
    console.log(`File type: ${req.file.fileType}`);
  }
  next();
};

// Create a combined middleware that handles both upload and URL transformation
const uploadWithUrlTransform = (fieldName) => {
  return [upload.single(fieldName), processUploadResult];
};

module.exports = upload;
module.exports.processUploadResult = processUploadResult;
module.exports.uploadWithUrlTransform = uploadWithUrlTransform;
