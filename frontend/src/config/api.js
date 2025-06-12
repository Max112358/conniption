// frontend/src/config/api.js

/**
 * API configuration for the Conniption frontend
 * Uses environment variables with fallbacks
 */

// API base URL for backend requests
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "https://conniption.onrender.com";

// Socket.io URL (usually same as API URL)
export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "https://conniption.onrender.com";

// Log configuration in development
if (process.env.NODE_ENV === "development") {
  console.log("API Configuration:", {
    API_BASE_URL,
    SOCKET_URL,
    environment: process.env.NODE_ENV,
  });
}

// Validate URLs
const validateUrl = (url, name) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    console.error(`Invalid ${name}: ${url}`);
    return false;
  }
};

// Validate configuration on load
validateUrl(API_BASE_URL, "API_BASE_URL");
validateUrl(SOCKET_URL, "SOCKET_URL");

// Export as default for convenience
export default {
  API_BASE_URL,
  SOCKET_URL,
};
