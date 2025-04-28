// backend/middleware/upload.js
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const { s3Client, R2_BUCKET_NAME, getPublicUrl } = require("../config/r2");

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
      const ext = path.extname(file.originalname);
      const filename = uniqueSuffix + ext;

      console.log(
        `File upload: Generated filename ${filename} for ${file.originalname}`
      );
      cb(null, filename);
    },
    // Transform the S3 storage URL to the public R2.dev URL
    transformRequest: function (req, file, cb) {
      // This runs after the upload but before sending the response
      cb(null, {});
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    // Log upload attempt
    console.log(
      `File upload attempt: ${file.originalname}, mimetype: ${file.mimetype}`
    );

    // Accept only image files
    if (!file.mimetype.startsWith("image/")) {
      console.log(`File upload rejected: ${file.originalname} - not an image`);
      return cb(new Error("Only image files are allowed!"), false);
    }
    console.log(`File upload accepted: ${file.originalname}`);
    cb(null, true);
  },
});

// Middleware to transform S3 URLs to public R2.dev URLs
const processUploadResult = (req, res, next) => {
  if (req.file) {
    // The S3 client will save the direct S3 URL in req.file.location
    // We need to replace this with the public R2.dev URL
    const objectKey = req.file.key;
    req.file.publicUrl = getPublicUrl(objectKey);
    req.file.originalLocation = req.file.location;
    req.file.location = req.file.publicUrl;

    console.log(`File uploaded to R2: ${req.file.originalLocation}`);
    console.log(`Public URL: ${req.file.publicUrl}`);
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
