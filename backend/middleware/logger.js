// backend/middleware/logger.js

/**
 * Request logger middleware for Express
 * Logs detailed information about incoming requests
 */
const logger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log the start of the request
  console.log(`[${timestamp}] ${req.method} ${req.url}`);

  // Log headers (but sanitize authorization tokens)
  const sanitizedHeaders = { ...req.headers };
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = "[REDACTED]";
  }
  console.log("Request Headers:", JSON.stringify(sanitizedHeaders, null, 2));

  // Log request body for POST requests (except file uploads)
  if (req.method === "POST" && !req.is("multipart/form-data")) {
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
  } else if (req.is("multipart/form-data")) {
    console.log("Request contains file upload (body not logged)");
  }

  // Capture the original end method
  const originalEnd = res.end;

  // Override the end method to log the response
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] Response: ${res.statusCode} (${duration}ms)`);

    // Call the original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = logger;
