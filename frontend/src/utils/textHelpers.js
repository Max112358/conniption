// frontend/src/utils/textHelpers.js

export function truncateText(text, maxChars = 500, maxLines = 10) {
  if (!text) return "";

  // First truncate by character count
  let truncated =
    text.length > maxChars ? text.substring(0, maxChars) + "..." : text;

  // Then truncate by lines
  const lines = truncated.split("\n");
  if (lines.length > maxLines) {
    truncated = lines.slice(0, maxLines).join("\n") + "\n...";
  }

  return truncated;
}
