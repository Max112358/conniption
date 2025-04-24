// backend/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log(`File upload: Storing in ${uploadDir}`);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = uniqueSuffix + ext;
    console.log(
      `File upload: Generated filename ${filename} for ${file.originalname}`
    );
    cb(null, filename);
  },
});

// Limit file size to 5MB and only allow image files
const upload = multer({
  storage: storage,
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

module.exports = upload;
