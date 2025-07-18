// backend/middleware/csrfProtection.js
const csrf = require("csurf");

// Create CSRF middleware with configuration
const csrfProtection = csrf({
  cookie: false, // Use session instead of cookies
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
  value: (req) => {
    // Check multiple possible locations for CSRF token
    return (
      req.body._csrf ||
      req.query._csrf ||
      req.headers["x-csrf-token"] ||
      req.headers["x-xsrf-token"]
    );
  },
});

// Middleware to send CSRF token to client
const sendCSRFToken = (req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();

    // Also set it as a response header for AJAX requests
    res.setHeader("X-CSRF-Token", res.locals.csrfToken);
  }
  next();
};

// Error handler for CSRF failures
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    // CSRF token validation failed
    console.warn(
      `CSRF validation failed for ${req.method} ${req.url} from IP ${req.ip}`
    );

    res.status(403).json({
      error: "Invalid or missing CSRF token",
      code: "CSRF_VALIDATION_FAILED",
    });
  } else {
    next(err);
  }
};

module.exports = {
  csrfProtection,
  sendCSRFToken,
  csrfErrorHandler,
};
