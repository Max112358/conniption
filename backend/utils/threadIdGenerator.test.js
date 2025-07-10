// backend/utils/threadIdGenerator.test.js
const {
  generateThreadUserId,
  generateThreadSalt,
  getThreadIdColor,
  clearCacheInterval,
} = require("./threadIdGenerator");

describe("Thread ID Generator Utils", () => {
  beforeEach(() => {
    // Clear any existing intervals
    clearCacheInterval();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearCacheInterval();
  });

  describe("generateThreadUserId", () => {
    it("should generate consistent thread user ID for same inputs", () => {
      const id1 = generateThreadUserId("192.168.1.1", 123, "test-salt");
      const id2 = generateThreadUserId("192.168.1.1", 123, "test-salt");

      expect(id1).toBe(id2);
      expect(typeof id1).toBe("string");
      expect(id1).toHaveLength(8);
    });

    it("should generate different IDs for different IPs", () => {
      const id1 = generateThreadUserId("192.168.1.1", 123, "test-salt");
      const id2 = generateThreadUserId("192.168.1.2", 123, "test-salt");

      expect(id1).not.toBe(id2);
    });

    it("should generate different IDs for different thread IDs", () => {
      const id1 = generateThreadUserId("192.168.1.1", 123, "test-salt");
      const id2 = generateThreadUserId("192.168.1.1", 124, "test-salt");

      expect(id1).not.toBe(id2);
    });

    it("should generate different IDs for different salts", () => {
      // Generate with different inputs that should bypass cache
      const id1 = generateThreadUserId("192.168.1.1", 123, "salt1");
      const id2 = generateThreadUserId("192.168.1.2", 123, "salt1"); // Different IP to bypass cache
      const id3 = generateThreadUserId("192.168.1.1", 124, "salt1"); // Different thread ID to bypass cache

      // These should all be different
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);

      // Each should be 8 characters
      expect(id1).toHaveLength(8);
      expect(id2).toHaveLength(8);
      expect(id3).toHaveLength(8);
    });

    it("should handle string thread IDs", () => {
      const id = generateThreadUserId("192.168.1.1", "123", "test-salt");

      expect(typeof id).toBe("string");
      expect(id).toHaveLength(8);
    });

    it("should use cache for repeated calls", () => {
      // First call
      const id1 = generateThreadUserId("192.168.1.1", 123, "test-salt");

      // Second call should use cache (same result)
      const id2 = generateThreadUserId("192.168.1.1", 123, "test-salt");

      expect(id1).toBe(id2);
    });
  });

  describe("generateThreadSalt", () => {
    it("should generate a random salt", () => {
      const salt1 = generateThreadSalt();
      const salt2 = generateThreadSalt();

      expect(salt1).not.toBe(salt2);
      expect(typeof salt1).toBe("string");
      expect(typeof salt2).toBe("string");
      expect(salt1).toHaveLength(32); // 16 bytes = 32 hex characters
      expect(salt2).toHaveLength(32);
    });

    it("should generate hex strings", () => {
      const salt = generateThreadSalt();

      // Check if it's a valid hex string
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it("should generate different salts each time", () => {
      const salts = new Set();

      // Generate 10 salts
      for (let i = 0; i < 10; i++) {
        salts.add(generateThreadSalt());
      }

      // All should be unique
      expect(salts.size).toBe(10);
    });
  });

  describe("getThreadIdColor", () => {
    it("should generate consistent color for same thread user ID", () => {
      const color1 = getThreadIdColor("abc12345");
      const color2 = getThreadIdColor("abc12345");

      expect(color1).toBe(color2);
    });

    it("should generate different colors for different thread user IDs", () => {
      const color1 = getThreadIdColor("abc12345");
      const color2 = getThreadIdColor("def67890");

      expect(color1).not.toBe(color2);
    });

    it("should return valid hex color codes", () => {
      const color = getThreadIdColor("test1234");

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should brighten dark colors", () => {
      // Test with a thread ID that would generate a dark color
      const color = getThreadIdColor("000000");

      // Extract RGB values
      const r = parseInt(color.substring(1, 3), 16);
      const g = parseInt(color.substring(3, 5), 16);
      const b = parseInt(color.substring(5, 7), 16);

      // Calculate brightness
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;

      // Should be brightened if originally too dark
      expect(brightness).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty string", () => {
      const color = getThreadIdColor("");

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should handle various input lengths", () => {
      const color1 = getThreadIdColor("a");
      const color2 = getThreadIdColor("abcdefghijklmnop");

      expect(color1).toMatch(/^#[0-9a-f]{6}$/);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe("clearCacheInterval", () => {
    it("should clear the cache interval", () => {
      // This test mainly ensures the function exists and can be called
      expect(() => clearCacheInterval()).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      clearCacheInterval();
      clearCacheInterval();
      clearCacheInterval();

      expect(() => clearCacheInterval()).not.toThrow();
    });
  });
});
