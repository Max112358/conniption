// backend/middleware/security.js

const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const hpp = require("hpp");
const csrf = require("csurf");

// Import the content sanitizer
const contentSanitizer = require("./contentSanitizer");

// Rate limiting configurations
const createAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many accounts created from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const postCreationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 posts per minute
  message: "Posting too quickly, please wait before posting again",
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 uploads per 5 minutes
  message: "Too many file uploads, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Content validation middleware
const validateContent = (req, res, next) => {
  const { content, topic, question } = req.body;

  // Check for spam patterns
  const spamPatterns = [
    /\b(viagra|cialis|loans?|casino|poker)\b/i,
    /\b(click here|buy now|limited time)\b/i,
    /(https?:\/\/[^\s]+){5,}/i, // Too many URLs
  ];

  const checkSpam = (text) => {
    if (!text) return false;
    return spamPatterns.some((pattern) => pattern.test(text));
  };

  if (checkSpam(content) || checkSpam(topic) || checkSpam(question)) {
    return res.status(400).json({ error: "Content appears to be spam" });
  }

  // Check for excessive caps
  const checkExcessiveCaps = (text) => {
    if (!text || text.length < 10) return false;
    const capsCount = (text.match(/[A-Z]/g) || []).length;
    return capsCount / text.length > 0.7;
  };

  if (checkExcessiveCaps(content) || checkExcessiveCaps(topic)) {
    return res
      .status(400)
      .json({ error: "Please avoid excessive capitalization" });
  }

  next();
};

// CSRF protection setup (to be used with express-session)
const csrfProtection = csrf({ cookie: false });

// Password validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);

  if (password.length < minLength) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!hasUpperCase || !hasLowerCase) {
    return {
      valid: false,
      message: "Password must contain both uppercase and lowercase letters",
    };
  }

  if (!hasNumbers) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }

  if (!hasSpecialChar) {
    return {
      valid: false,
      message:
        "Password must contain at least one special character (!@#$%^&*)",
    };
  }

  return { valid: true };
};

module.exports = {
  createAccountLimiter,
  generalLimiter,
  postCreationLimiter,
  uploadLimiter,
  sanitizeInput: contentSanitizer.middleware, // Use the imported sanitizer's middleware
  validateContent,
  csrfProtection,
  validatePassword,
  // Export individual middleware
  preventXSS: xss(),
  preventParameterPollution: hpp(),
};
