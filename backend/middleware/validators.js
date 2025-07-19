// backend/middleware/validators.js
const { body, param, query, validationResult } = require("express-validator");
const postsConfig = require("../config/posts");
const surveysConfig = require("../config/surveys");
const threadsConfig = require("../config/threads");

// Helper to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Board ID validation
const validateBoardId = param("boardId")
  .matches(/^[a-z0-9]+$/)
  .withMessage("Board ID must contain only lowercase letters and numbers")
  .isLength({ min: 1, max: 10 })
  .withMessage("Board ID must be between 1 and 10 characters");

// Thread ID validation
const validateThreadId = param("threadId")
  .isInt({ min: 1 })
  .withMessage("Thread ID must be a positive integer");

// Post ID validation
const validatePostId = param("postId")
  .isInt({ min: 1 })
  .withMessage("Post ID must be a positive integer");

// Content validation using config
const validateContent = body("content")
  .optional()
  .isString()
  .isLength({
    min: 1,
    max: postsConfig.characterLimit || 5000,
  })
  .withMessage(
    `Content must be between 1 and ${
      postsConfig.characterLimit || 5000
    } characters`
  )
  .trim();

// Topic validation - reasonable limit for thread titles
const validateTopic = body("topic")
  .isString()
  .isLength({ min: 1, max: 100 })
  .withMessage("Topic must be between 1 and 100 characters")
  .trim();

// Survey validation using config
const validateSurvey = [
  body("survey_type")
    .isIn(["single", "multiple"])
    .withMessage('Survey type must be "single" or "multiple"'),
  body("question")
    .isString()
    .isLength({
      min: 1,
      max: surveysConfig.questionCharacterLimit || 280,
    })
    .withMessage(
      `Question must be between 1 and ${
        surveysConfig.questionCharacterLimit || 280
      } characters`
    )
    .trim(),
  body("options")
    .isArray({
      min: surveysConfig.minOptions || 2,
      max: surveysConfig.maxOptions || 16,
    })
    .withMessage(
      `Options must be an array with ${surveysConfig.minOptions || 2}-${
        surveysConfig.maxOptions || 16
      } items`
    ),
  body("options.*")
    .isString()
    .isLength({
      min: 1,
      max: surveysConfig.optionCharacterLimit || 280,
    })
    .withMessage(
      `Each option must be between 1 and ${
        surveysConfig.optionCharacterLimit || 280
      } characters`
    )
    .trim(),
];

// Ban reason validation
const validateBanReason = body("reason")
  .isString()
  .isLength({ min: 1, max: 500 })
  .withMessage("Ban reason must be between 1 and 500 characters")
  .trim();

// Color validation
const validateColor = body("color")
  .isIn([
    "black",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "brown",
  ])
  .withMessage("Invalid color selection");

// Pagination validation
const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Enhanced content validation that can be used in security middleware
const validateContentLength = (content, type = "post") => {
  if (!content || typeof content !== "string") {
    return { valid: true }; // Optional content is valid
  }

  let maxLength;
  let contentType;

  switch (type) {
    case "post":
      maxLength = postsConfig.characterLimit;
      contentType = "Post content";
      break;
    case "topic":
      maxLength = 100; // Thread topics have a reasonable fixed limit
      contentType = "Thread topic";
      break;
    case "survey_question":
      maxLength = surveysConfig.questionCharacterLimit;
      contentType = "Survey question";
      break;
    case "survey_option":
      maxLength = surveysConfig.optionCharacterLimit;
      contentType = "Survey option";
      break;
    case "reason":
      maxLength = 500; // Ban reasons and moderation reasons
      contentType = "Reason";
      break;
    default:
      maxLength = 1000; // Default fallback
      contentType = "Content";
  }

  // If no limit is set in config, skip validation
  if (!maxLength || maxLength <= 0) {
    return { valid: true };
  }

  if (content.length > maxLength) {
    return {
      valid: false,
      message: `${contentType} exceeds the maximum character limit of ${maxLength} characters`,
      currentLength: content.length,
      maxLength: maxLength,
    };
  }

  return { valid: true };
};

// Enhanced content validation middleware using config
const validateContentWithConfig = (req, res, next) => {
  const validations = [];

  // Validate different content types based on what's in the request
  if (req.body.content) {
    const validation = validateContentLength(req.body.content, "post");
    if (!validation.valid) {
      validations.push(validation);
    }
  }

  if (req.body.topic) {
    const validation = validateContentLength(req.body.topic, "topic");
    if (!validation.valid) {
      validations.push(validation);
    }
  }

  if (req.body.question) {
    const validation = validateContentLength(
      req.body.question,
      "survey_question"
    );
    if (!validation.valid) {
      validations.push(validation);
    }
  }

  if (req.body.options && Array.isArray(req.body.options)) {
    for (let i = 0; i < req.body.options.length; i++) {
      const validation = validateContentLength(
        req.body.options[i],
        "survey_option"
      );
      if (!validation.valid) {
        validations.push({
          ...validation,
          message: `Option ${i + 1}: ${validation.message}`,
        });
      }
    }
  }

  if (req.body.reason) {
    const validation = validateContentLength(req.body.reason, "reason");
    if (!validation.valid) {
      validations.push(validation);
    }
  }

  // If any validations failed, return error
  if (validations.length > 0) {
    return res.status(400).json({
      error: "Content validation failed",
      details: validations,
    });
  }

  next();
};

// Export validation chains
module.exports = {
  handleValidationErrors,
  validateContentLength,
  validateContentWithConfig,

  // Route validations
  validateBoard: [validateBoardId, handleValidationErrors],
  validateThread: [validateBoardId, validateThreadId, handleValidationErrors],
  validatePost: [
    validateBoardId,
    validateThreadId,
    validatePostId,
    handleValidationErrors,
  ],

  // Content validations
  createThread: [
    validateBoardId,
    validateTopic,
    validateContent,
    handleValidationErrors,
  ],
  createPost: [
    validateBoardId,
    validateThreadId,
    validateContent,
    handleValidationErrors,
  ],
  createSurvey: [
    validateBoardId,
    validateThreadId,
    validatePostId,
    ...validateSurvey,
    handleValidationErrors,
  ],

  // Admin validations
  banUser: [validateBoardId, validateBanReason, handleValidationErrors],
  updateColor: [
    validateBoardId,
    validateThreadId,
    validatePostId,
    validateColor,
    handleValidationErrors,
  ],

  // Query validations
  pagination: [...validatePagination, handleValidationErrors],

  // Config values for reference
  config: {
    posts: postsConfig,
    surveys: surveysConfig,
    threads: threadsConfig,
  },
};
