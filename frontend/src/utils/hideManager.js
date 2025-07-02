// frontend/src/utils/hideManager.js

/**
 * Manages hidden posts, threads, and users using localStorage
 */
class HideManager {
  constructor() {
    this.STORAGE_KEYS = {
      POSTS: "conniption_hidden_posts",
      THREADS: "conniption_hidden_threads",
      USERS: "conniption_hidden_users",
    };
  }

  // Initialize and get data from localStorage
  _getData(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error("Error reading from localStorage:", err);
      return [];
    }
  }

  // Save data to localStorage
  _setData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error("Error writing to localStorage:", err);
    }
  }

  // Posts
  hidePost(postId) {
    const hiddenPosts = this._getData(this.STORAGE_KEYS.POSTS);
    if (!hiddenPosts.includes(postId)) {
      hiddenPosts.push(postId);
      this._setData(this.STORAGE_KEYS.POSTS, hiddenPosts);
    }
  }

  unhidePost(postId) {
    const hiddenPosts = this._getData(this.STORAGE_KEYS.POSTS);
    const filtered = hiddenPosts.filter((id) => id !== postId);
    this._setData(this.STORAGE_KEYS.POSTS, filtered);
  }

  isPostHidden(postId) {
    const hiddenPosts = this._getData(this.STORAGE_KEYS.POSTS);
    return hiddenPosts.includes(postId);
  }

  // Threads
  hideThread(threadId) {
    const hiddenThreads = this._getData(this.STORAGE_KEYS.THREADS);
    if (!hiddenThreads.includes(threadId)) {
      hiddenThreads.push(threadId);
      this._setData(this.STORAGE_KEYS.THREADS, hiddenThreads);
    }
  }

  unhideThread(threadId) {
    const hiddenThreads = this._getData(this.STORAGE_KEYS.THREADS);
    const filtered = hiddenThreads.filter((id) => id !== threadId);
    this._setData(this.STORAGE_KEYS.THREADS, filtered);
  }

  isThreadHidden(threadId) {
    const hiddenThreads = this._getData(this.STORAGE_KEYS.THREADS);
    return hiddenThreads.includes(threadId);
  }

  // Users (by thread user ID)
  hideUser(threadUserId) {
    const hiddenUsers = this._getData(this.STORAGE_KEYS.USERS);
    if (!hiddenUsers.includes(threadUserId)) {
      hiddenUsers.push(threadUserId);
      this._setData(this.STORAGE_KEYS.USERS, hiddenUsers);
    }
  }

  unhideUser(threadUserId) {
    const hiddenUsers = this._getData(this.STORAGE_KEYS.USERS);
    const filtered = hiddenUsers.filter((id) => id !== threadUserId);
    this._setData(this.STORAGE_KEYS.USERS, filtered);
  }

  isUserHidden(threadUserId) {
    if (!threadUserId) return false;
    const hiddenUsers = this._getData(this.STORAGE_KEYS.USERS);
    return hiddenUsers.includes(threadUserId);
  }

  // Get all hidden data (for debugging or settings)
  getAllHidden() {
    return {
      posts: this._getData(this.STORAGE_KEYS.POSTS),
      threads: this._getData(this.STORAGE_KEYS.THREADS),
      users: this._getData(this.STORAGE_KEYS.USERS),
    };
  }

  // Clear all hidden data
  clearAll() {
    localStorage.removeItem(this.STORAGE_KEYS.POSTS);
    localStorage.removeItem(this.STORAGE_KEYS.THREADS);
    localStorage.removeItem(this.STORAGE_KEYS.USERS);
  }
}

// Export singleton instance
export default new HideManager();
