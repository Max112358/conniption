// frontend/src/utils/postOwnershipManager.js

/**
 * Manages tracking of posts created by the current user
 * Uses localStorage to persist post ownership across sessions
 */
class PostOwnershipManager {
  constructor() {
    this.STORAGE_KEY = "conniption_user_posts";
    this.posts = this._loadPosts();
  }

  /**
   * Load posts from localStorage
   * @returns {Set} Set of post IDs owned by the user
   */
  _loadPosts() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert array to Set for O(1) lookups
        return new Set(parsed.postIds || []);
      }
    } catch (err) {
      console.error("Error loading user posts from localStorage:", err);
    }
    return new Set();
  }

  /**
   * Save posts to localStorage
   */
  _savePosts() {
    try {
      const data = {
        postIds: Array.from(this.posts),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Error saving user posts to localStorage:", err);
    }
  }

  /**
   * Add a post ID as owned by the current user
   * @param {number} postId - The ID of the post
   */
  addPost(postId) {
    this.posts.add(postId);
    this._savePosts();
  }

  /**
   * Remove a post ID from ownership (after deletion)
   * @param {number} postId - The ID of the post
   */
  removePost(postId) {
    this.posts.delete(postId);
    this._savePosts();
  }

  /**
   * Check if a post is owned by the current user
   * @param {number} postId - The ID of the post
   * @returns {boolean} True if the user owns the post
   */
  isOwnPost(postId) {
    return this.posts.has(postId);
  }

  /**
   * Get all post IDs owned by the user
   * @returns {Set} Set of post IDs
   */
  getAllPosts() {
    return new Set(this.posts);
  }

  /**
   * Clear all ownership data (useful for privacy)
   */
  clearAll() {
    this.posts.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Clean up old posts (optional - to prevent unlimited growth)
   * Keeps only the most recent N posts
   * @param {number} maxPosts - Maximum number of posts to keep (default: 1000)
   */
  cleanup(maxPosts = 1000) {
    if (this.posts.size > maxPosts) {
      const postsArray = Array.from(this.posts);
      // Keep the most recent posts (assuming higher IDs are newer)
      const sortedPosts = postsArray.sort((a, b) => b - a);
      const postsToKeep = new Set(sortedPosts.slice(0, maxPosts));
      this.posts = postsToKeep;
      this._savePosts();
    }
  }
}

// Create singleton instance
const postOwnershipManager = new PostOwnershipManager();

// Export singleton
export default postOwnershipManager;
