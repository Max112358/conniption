// frontend/src/hooks/useThreadOwnership.js

import { useState, useCallback, useEffect } from "react";
import threadOwnershipManager from "../utils/threadOwnershipManager";

/**
 * Hook for managing thread ownership state
 * @returns {Object} Thread ownership methods and state
 */
export default function useThreadOwnership() {
  const [ownThreads, setOwnThreads] = useState(() =>
    threadOwnershipManager.getAllThreads()
  );

  // Listen for storage changes (in case user has multiple tabs open)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "conniption_user_threads") {
        // Reload threads from storage
        const threads = threadOwnershipManager.getAllThreads();
        setOwnThreads(threads);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addOwnThread = useCallback((threadId) => {
    threadOwnershipManager.addThread(threadId);
    setOwnThreads(new Set(threadOwnershipManager.getAllThreads()));
  }, []);

  const removeOwnThread = useCallback((threadId) => {
    threadOwnershipManager.removeThread(threadId);
    setOwnThreads(new Set(threadOwnershipManager.getAllThreads()));
  }, []);

  const isOwnThread = useCallback(
    (threadId) => {
      return ownThreads.has(threadId);
    },
    [ownThreads]
  );

  const clearOwnThreads = useCallback(() => {
    threadOwnershipManager.clearAll();
    setOwnThreads(new Set());
  }, []);

  return {
    ownThreads,
    addOwnThread,
    removeOwnThread,
    isOwnThread,
    clearOwnThreads,
  };
}
