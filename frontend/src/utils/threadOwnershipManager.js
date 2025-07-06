// frontend/src/utils/threadOwnershipManager.js

/**
 * Manages tracking of threads created by the current user
 * Uses localStorage to persist thread ownership across sessions
 */
class ThreadOwnershipManager {
  constructor() {
    this.STORAGE_KEY = "conniption_user_threads";
    this.threads = this._loadThreads();
  }

  /**
   * Load threads from localStorage
   * @returns {Set} Set of thread IDs owned by the user
   */
  _loadThreads() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert array to Set for O(1) lookups
        return new Set(parsed.threadIds || []);
      }
    } catch (err) {
      console.error("Error loading user threads from localStorage:", err);
    }
    return new Set();
  }

  /**
   * Save threads to localStorage
   */
  _saveThreads() {
    try {
      const data = {
        threadIds: Array.from(this.threads),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Error saving user threads to localStorage:", err);
    }
  }

  /**
   * Add a thread ID as owned by the current user
   * @param {number} threadId - The ID of the thread
   */
  addThread(threadId) {
    this.threads.add(threadId);
    this._saveThreads();
  }

  /**
   * Remove a thread ID from ownership (after deletion)
   * @param {number} threadId - The ID of the thread
   */
  removeThread(threadId) {
    this.threads.delete(threadId);
    this._saveThreads();
  }

  /**
   * Check if a thread is owned by the current user
   * @param {number} threadId - The ID of the thread
   * @returns {boolean} True if the user owns the thread
   */
  isOwnThread(threadId) {
    return this.threads.has(threadId);
  }

  /**
   * Get all thread IDs owned by the user
   * @returns {Set} Set of thread IDs
   */
  getAllThreads() {
    return new Set(this.threads);
  }

  /**
   * Clear all ownership data (useful for privacy)
   */
  clearAll() {
    this.threads.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Clean up old threads (optional - to prevent unlimited growth)
   * Keeps only the most recent N threads
   * @param {number} maxThreads - Maximum number of threads to keep (default: 100)
   */
  cleanup(maxThreads = 100) {
    if (this.threads.size > maxThreads) {
      const threadsArray = Array.from(this.threads);
      // Keep the most recent threads (assuming higher IDs are newer)
      const sortedThreads = threadsArray.sort((a, b) => b - a);
      const threadsToKeep = new Set(sortedThreads.slice(0, maxThreads));
      this.threads = threadsToKeep;
      this._saveThreads();
    }
  }
}

// Create singleton instance
const threadOwnershipManager = new ThreadOwnershipManager();

// Export singleton
export default threadOwnershipManager;
