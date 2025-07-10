// backend/utils/transformImageUrl.test.js
const transformImageUrl = require("./transformImageUrl");

// Mock the R2 config
jest.mock("../config/r2", () => ({
  R2_PUBLIC_URL: "https://conniption.xyz",
}));

describe("Transform Image URL Utils", () => {
  it("should return null for null input", () => {
    expect(transformImageUrl(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(transformImageUrl(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(transformImageUrl("")).toBeNull();
  });

  it("should return URL as-is if already using custom domain", () => {
    const url = "https://conniption.xyz/image.jpg";
    expect(transformImageUrl(url)).toBe(url);
  });

  it("should transform R2 URL to custom domain", () => {
    const r2Url = "https://abc123.r2.cloudflarestorage.com/image.jpg";
    const expected = "https://conniption.xyz/image.jpg";
    expect(transformImageUrl(r2Url)).toBe(expected);
  });

  it("should transform different R2 account URLs", () => {
    const r2Url = "https://different123.r2.cloudflarestorage.com/video.mp4";
    const expected = "https://conniption.xyz/video.mp4";
    expect(transformImageUrl(r2Url)).toBe(expected);
  });

  it("should prepend custom domain for path-only URLs", () => {
    const path = "image.jpg";
    const expected = "https://conniption.xyz/image.jpg";
    expect(transformImageUrl(path)).toBe(expected);
  });

  it("should prepend custom domain for paths with folders", () => {
    const path = "folder/subfolder/image.jpg";
    const expected = "https://conniption.xyz/folder/subfolder/image.jpg";
    expect(transformImageUrl(path)).toBe(expected);
  });

  it("should return original URL if no transformation needed", () => {
    const url = "https://example.com/image.jpg";
    expect(transformImageUrl(url)).toBe(url);
  });

  it("should handle URLs with query parameters", () => {
    const r2Url = "https://abc123.r2.cloudflarestorage.com/image.jpg?v=1";
    const expected = "https://conniption.xyz/image.jpg?v=1";
    expect(transformImageUrl(r2Url)).toBe(expected);
  });

  it("should handle URLs with complex paths", () => {
    const r2Url =
      "https://abc123.r2.cloudflarestorage.com/uploads/2024/01/image.jpg";
    const expected = "https://conniption.xyz/uploads/2024/01/image.jpg";
    expect(transformImageUrl(r2Url)).toBe(expected);
  });

  it("should handle data URLs without transformation", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    expect(transformImageUrl(dataUrl)).toBe(dataUrl);
  });

  it("should handle blob URLs without transformation", () => {
    const blobUrl =
      "blob:https://example.com/123e4567-e89b-12d3-a456-426614174000";
    expect(transformImageUrl(blobUrl)).toBe(blobUrl);
  });
});
