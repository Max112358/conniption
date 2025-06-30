// backend/utils/threadIdGenerator.js
const crypto = require("crypto");

// Secret key for additional security - should be in environment variable
const SECRET_KEY =
  process.env.THREAD_ID_SECRET || "default-secret-key-change-in-production";

// Cache for thread IDs to avoid recalculating for same IP in same thread
// This is cleared periodically to prevent memory bloat
const threadIdCache = new Map();

// Clear cache every hour
setInterval(() => {
  threadIdCache.clear();
  console.log("Thread ID cache cleared");
}, 60 * 60 * 1000);

/**
 * Generate a unique thread ID for a user within a specific thread
 * @param {string} ipAddress - The user's IP address
 * @param {number} threadId - The thread ID
 * @param {string} threadSalt - The thread-specific salt
 * @returns {string} 8-character thread user ID
 */
const generateThreadUserId = (ipAddress, threadId, threadSalt) => {
  // Create cache key
  const cacheKey = `${ipAddress}-${threadId}`;

  // Check cache first
  if (threadIdCache.has(cacheKey)) {
    return threadIdCache.get(cacheKey);
  }

  // Create a hash using IP, thread salt, and secret key
  const hash = crypto
    .createHash("sha256")
    .update(ipAddress)
    .update(threadSalt)
    .update(SECRET_KEY)
    .update(threadId.toString())
    .digest("hex");

  // Take first 8 characters
  const threadUserId = hash.substring(0, 8);

  // Cache it
  threadIdCache.set(cacheKey, threadUserId);

  return threadUserId;
};

/**
 * Generate a random salt for a new thread
 * @returns {string} Random salt
 */
const generateThreadSalt = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Get a color for a thread ID (for visual differentiation)
 * @param {string} threadUserId - The thread user ID
 * @returns {string} Hex color code
 */
const getThreadIdColor = (threadUserId) => {
  // Use the thread ID to generate a consistent color
  const hash = crypto.createHash("md5").update(threadUserId).digest("hex");

  // Use first 6 characters as hex color, but ensure it's bright enough
  let color = hash.substring(0, 6);

  // Convert to RGB to check brightness
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // If too dark, lighten it
  if (brightness < 128) {
    // Add 80 to each component to lighten
    const newR = Math.min(r + 80, 255)
      .toString(16)
      .padStart(2, "0");
    const newG = Math.min(g + 80, 255)
      .toString(16)
      .padStart(2, "0");
    const newB = Math.min(b + 80, 255)
      .toString(16)
      .padStart(2, "0");
    color = newR + newG + newB;
  }

  return `#${color}`;
};

module.exports = {
  generateThreadUserId,
  generateThreadSalt,
  getThreadIdColor,
};
