// backend/utils/getClientIp.js
/**
 * Get the real client IP address from the request
 * Handles various proxy headers used by Cloudflare and other services
 * @param {Object} req - Express request object
 * @returns {string} The client's IP address
 */
const getClientIp = (req) => {
  // Log all available headers for debugging
  console.log("IP Detection - Available headers:", {
    "cf-connecting-ip": req.headers["cf-connecting-ip"],
    "true-client-ip": req.headers["true-client-ip"],
    "x-real-ip": req.headers["x-real-ip"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "req.ip": req.ip,
    remoteAddress: req.connection?.remoteAddress,
  });

  // Priority order for checking IP addresses:

  // 1. Cloudflare's CF-Connecting-IP header (most reliable when using Cloudflare)
  if (req.headers["cf-connecting-ip"]) {
    console.log(
      "IP Detection - Using CF-Connecting-IP:",
      req.headers["cf-connecting-ip"]
    );
    return req.headers["cf-connecting-ip"];
  }

  // 2. True-Client-IP header (also used by Cloudflare Enterprise)
  if (req.headers["true-client-ip"]) {
    console.log(
      "IP Detection - Using True-Client-IP:",
      req.headers["true-client-ip"]
    );
    return req.headers["true-client-ip"];
  }

  // 3. X-Real-IP header (common reverse proxy header)
  if (req.headers["x-real-ip"]) {
    console.log("IP Detection - Using X-Real-IP:", req.headers["x-real-ip"]);
    return req.headers["x-real-ip"];
  }

  // 4. X-Forwarded-For header (can contain multiple IPs)
  if (req.headers["x-forwarded-for"]) {
    // X-Forwarded-For can contain a comma-separated list of IPs
    // The first IP is the original client
    const ips = req.headers["x-forwarded-for"].split(",");
    const clientIp = ips[0].trim();
    console.log("IP Detection - Using X-Forwarded-For:", clientIp);
    return clientIp;
  }

  // 5. req.ip (Express's built-in IP detection with trust proxy enabled)
  if (req.ip) {
    // Remove IPv6 prefix if present
    const cleanIp = req.ip.replace(/^::ffff:/, "");
    console.log("IP Detection - Using req.ip:", cleanIp);
    return cleanIp;
  }

  // 6. Direct socket connection (fallback)
  if (req.connection && req.connection.remoteAddress) {
    const cleanIp = req.connection.remoteAddress.replace(/^::ffff:/, "");
    console.log("IP Detection - Using remoteAddress:", cleanIp);
    return cleanIp;
  }

  // Default fallback
  console.log("IP Detection - No IP found, returning unknown");
  return "unknown";
};

module.exports = getClientIp;
