// backend/middleware/security.js

const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const hpp = require("hpp");
const csrf = require("csurf");

// Import the content sanitizer and validators
const contentSanitizer = require("./contentSanitizer");
const { validateContentLength } = require("./validators");

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

// Enhanced content validation middleware using config
const validateContent = (req, res, next) => {
  const validationErrors = [];

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

  // Check for excessive caps
  const checkExcessiveCaps = (text) => {
    if (!text || text.length < 10) return false;
    const capsCount = (text.match(/[A-Z]/g) || []).length;
    return capsCount / text.length > 0.7;
  };

  // Validate content using config-based length validation
  const { content, topic, question, options, reason } = req.body;

  // Check content length using config
  if (content) {
    const validation = validateContentLength(content, "post");
    if (!validation.valid) {
      validationErrors.push(validation);
    }

    if (checkSpam(content)) {
      validationErrors.push({
        valid: false,
        message: "Content appears to be spam",
      });
    }

    if (checkExcessiveCaps(content)) {
      validationErrors.push({
        valid: false,
        message: "Please avoid excessive capitalization in content",
      });
    }
  }

  // Check topic length using config
  if (topic) {
    const validation = validateContentLength(topic, "topic");
    if (!validation.valid) {
      validationErrors.push(validation);
    }

    if (checkSpam(topic)) {
      validationErrors.push({
        valid: false,
        message: "Topic appears to be spam",
      });
    }

    if (checkExcessiveCaps(topic)) {
      validationErrors.push({
        valid: false,
        message: "Please avoid excessive capitalization in topic",
      });
    }
  }

  // Check survey question length using config
  if (question) {
    const validation = validateContentLength(question, "survey_question");
    if (!validation.valid) {
      validationErrors.push(validation);
    }

    if (checkSpam(question)) {
      validationErrors.push({
        valid: false,
        message: "Survey question appears to be spam",
      });
    }
  }

  // Check survey options length using config
  if (options && Array.isArray(options)) {
    options.forEach((option, index) => {
      const validation = validateContentLength(option, "survey_option");
      if (!validation.valid) {
        validationErrors.push({
          ...validation,
          message: `Option ${index + 1}: ${validation.message}`,
        });
      }

      if (checkSpam(option)) {
        validationErrors.push({
          valid: false,
          message: `Option ${index + 1} appears to be spam`,
        });
      }
    });
  }

  // Check reason length using config
  if (reason) {
    const validation = validateContentLength(reason, "reason");
    if (!validation.valid) {
      validationErrors.push(validation);
    }
  }

  // If any validation errors, return them
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: "Content validation failed",
      details: validationErrors,
    });
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
  validateContent, // Now uses config-based validation
  csrfProtection,
  validatePassword,
  // Export individual middleware
  preventXSS: xss(),
  preventParameterPollution: hpp(),
};
