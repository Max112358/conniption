// frontend/src/hooks/usePostOwnership.js

import { useState, useCallback, useEffect } from "react";
import postOwnershipManager from "../utils/postOwnershipManager";

/**
 * Hook for managing post ownership state
 * @returns {Object} Post ownership methods and state
 */
export default function usePostOwnership() {
  const [ownPosts, setOwnPosts] = useState(() =>
    postOwnershipManager.getAllPosts()
  );

  // Listen for storage changes (in case user has multiple tabs open)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "conniption_user_posts") {
        // Reload posts from storage
        const posts = postOwnershipManager.getAllPosts();
        setOwnPosts(posts);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addOwnPost = useCallback((postId) => {
    postOwnershipManager.addPost(postId);
    setOwnPosts(new Set(postOwnershipManager.getAllPosts()));
  }, []);

  const removeOwnPost = useCallback((postId) => {
    postOwnershipManager.removePost(postId);
    setOwnPosts(new Set(postOwnershipManager.getAllPosts()));
  }, []);

  const isOwnPost = useCallback(
    (postId) => {
      return ownPosts.has(postId);
    },
    [ownPosts]
  );

  const clearOwnPosts = useCallback(() => {
    postOwnershipManager.clearAll();
    setOwnPosts(new Set());
  }, []);

  return {
    ownPosts,
    addOwnPost,
    removeOwnPost,
    isOwnPost,
    clearOwnPosts,
  };
}
