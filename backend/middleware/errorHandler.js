// backend/middleware/errorHandler.js

/**
 * Global error handler middleware
 * Catches all errors and provides consistent error responses
 */
const errorHandler = (err, req, res, next) => {
  // Log the error with stack trace
  console.error("Error caught by error handler:");
  console.error(err.stack || err);

  // Get status code from error or default to 500
  const statusCode = err.statusCode || 500;

  // Default error message
  const message = err.message || "An unexpected error occurred";

  // Only include error details in non-production environments
  const errorDetails =
    process.env.NODE_ENV === "production"
      ? {}
      : {
          stack: err.stack,
          details: err.details || null,
        };

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...errorDetails,
  });
};

module.exports = errorHandler;
