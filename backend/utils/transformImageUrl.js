// backend/utils/transformImageUrl.js
const { R2_PUBLIC_URL } = require("../config/r2");

/**
 * Transform R2 bucket URLs to custom domain URLs
 * @param {string|null} url - The URL to transform
 * @returns {string|null} - The transformed URL or null if input is null
 */
const transformImageUrl = (url) => {
  if (!url) return null;

  // If URL is already using our custom domain, return as is
  if (url.startsWith(R2_PUBLIC_URL)) return url;

  // If URL is a R2 URL, transform it to our custom domain
  const r2Match = url.match(
    /https:\/\/[^\/]+\.r2\.cloudflarestorage\.com\/([^\/]+)/
  );
  if (r2Match) {
    return `${R2_PUBLIC_URL}/${r2Match[1]}`;
  }

  // If it's a path only (no URL), prepend custom domain
  if (!url.startsWith("http")) {
    return `${R2_PUBLIC_URL}/${url}`;
  }

  // Return original if no transformation needed
  return url;
};

module.exports = transformImageUrl;
