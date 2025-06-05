// backend/middleware/securityHeaders.js

/**
 * Security headers middleware
 * Adds security headers to protect against common vulnerabilities
 */
const securityHeaders = (req, res, next) => {
  // Content Security Policy for media
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "img-src 'self' https://*.r2.dev https://conniption.xyz blob: data:; " +
      "media-src 'self' https://*.r2.dev https://conniption.xyz blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://conniption.onrender.com wss://conniption.onrender.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
  );

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Force HTTPS
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Don't send referrer for cross-origin requests
  res.setHeader("Referrer-Policy", "same-origin");

  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  next();
};

module.exports = securityHeaders;
