// backend/middleware/validators.js
const { body, param, query, validationResult } = require("express-validator");

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

// Content validation
const validateContent = body("content")
  .optional()
  .isString()
  .isLength({ min: 1, max: 5000 })
  .withMessage("Content must be between 1 and 5000 characters")
  .trim();

// Topic validation
const validateTopic = body("topic")
  .isString()
  .isLength({ min: 1, max: 100 })
  .withMessage("Topic must be between 1 and 100 characters")
  .trim();

// Survey validation
const validateSurvey = [
  body("survey_type")
    .isIn(["single", "multiple"])
    .withMessage('Survey type must be "single" or "multiple"'),
  body("question")
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage("Question must be between 1 and 200 characters")
    .trim(),
  body("options")
    .isArray({ min: 2, max: 10 })
    .withMessage("Options must be an array with 2-10 items"),
  body("options.*")
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Each option must be between 1 and 100 characters")
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

// Export validation chains
module.exports = {
  handleValidationErrors,

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
};
