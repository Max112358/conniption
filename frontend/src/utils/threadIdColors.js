// frontend/src/utils/threadIdColors.js

/**
 * Get a color for a thread ID (for visual differentiation)
 * This should match the backend logic for consistency
 * @param {string} threadUserId - The thread user ID
 * @returns {string} Hex color code
 */
export const getThreadIdColor = (threadUserId) => {
  if (!threadUserId) return "#6c757d"; // Default gray

  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < threadUserId.length; i++) {
    const char = threadUserId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive number
  hash = Math.abs(hash);

  // Generate color components
  const hue = hash % 360;
  const saturation = 50 + (hash % 30); // 50-80%
  const lightness = 40 + (hash % 20); // 40-60%

  // Convert HSL to RGB
  const hslToRgb = (h, s, l) => {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  };

  const [r, g, b] = hslToRgb(hue, saturation, lightness);

  // Convert to hex
  const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
