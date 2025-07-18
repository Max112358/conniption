// backend/middleware/contentSanitizer.js
const DOMPurify = require("isomorphic-dompurify");

/**
 * Enhanced content sanitization middleware
 * Provides robust protection against XSS and injection attacks
 */
const contentSanitizer = {
  /**
   * Sanitize text content (removes all HTML)
   */
  sanitizeText: (text) => {
    if (!text || typeof text !== "string") return "";

    // Remove all HTML tags
    let sanitized = text.replace(/<[^>]*>/g, "");

    // Remove zero-width characters that could be used for bypasses
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, " ");

    return sanitized;
  },

  /**
   * Sanitize content that may contain limited HTML (for rich text)
   */
  sanitizeRichText: (html) => {
    if (!html || typeof html !== "string") return "";

    // Configure DOMPurify to be very restrictive
    const config = {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "br", "p"],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_TRUSTED_TYPE: false,
    };

    return DOMPurify.sanitize(html, config);
  },

  /**
   * Sanitize URLs
   */
  sanitizeUrl: (url) => {
    if (!url || typeof url !== "string") return "";

    // Only allow http, https, and relative URLs
    const allowedProtocols = ["http:", "https:", ""];

    try {
      const urlObj = new URL(url, "http://example.com"); // Use base for relative URLs
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return "";
      }
      return url;
    } catch {
      // If URL parsing fails, check if it's a relative URL
      if (url.startsWith("/") && !url.includes("//")) {
        return url;
      }
      return "";
    }
  },

  /**
   * Middleware function
   */
  middleware: (req, res, next) => {
    // Sanitize body
    if (req.body) {
      Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === "string") {
          // Different sanitization based on field type
          if (
            key === "content" ||
            key === "topic" ||
            key === "question" ||
            key === "reason"
          ) {
            req.body[key] = contentSanitizer.sanitizeText(req.body[key]);
          } else if (key === "url" || key.includes("_url")) {
            req.body[key] = contentSanitizer.sanitizeUrl(req.body[key]);
          } else {
            // Default: remove all HTML
            req.body[key] = contentSanitizer.sanitizeText(req.body[key]);
          }
        } else if (Array.isArray(req.body[key])) {
          // Sanitize arrays (like survey options)
          req.body[key] = req.body[key].map((item) =>
            typeof item === "string"
              ? contentSanitizer.sanitizeText(item)
              : item
          );
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        if (typeof req.query[key] === "string") {
          req.query[key] = contentSanitizer.sanitizeText(req.query[key]);
        }
      });
    }

    // Sanitize URL parameters
    if (req.params) {
      Object.keys(req.params).forEach((key) => {
        if (typeof req.params[key] === "string") {
          // URL params should be more strictly validated
          req.params[key] = req.params[key].replace(/[^a-zA-Z0-9-_]/g, "");
        }
      });
    }

    next();
  },
};

module.exports = contentSanitizer;
