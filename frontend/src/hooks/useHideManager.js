// frontend/src/hooks/useHideManager.js

import { useState, useEffect } from "react";
import hideManager from "../utils/hideManager";

export default function useHideManager() {
  const [hiddenThreads, setHiddenThreads] = useState(new Set());
  const [hiddenPosts, setHiddenPosts] = useState(new Set());
  const [hiddenUsers, setHiddenUsers] = useState(new Set());

  // Initialize from localStorage
  useEffect(() => {
    const hidden = hideManager.getAllHidden();
    setHiddenThreads(new Set(hidden.threads));
    setHiddenPosts(new Set(hidden.posts));
    setHiddenUsers(new Set(hidden.users));
  }, []);

  const toggleThreadHidden = (threadId) => {
    if (hiddenThreads.has(threadId)) {
      hideManager.unhideThread(threadId);
      setHiddenThreads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(threadId);
        return newSet;
      });
    } else {
      hideManager.hideThread(threadId);
      setHiddenThreads((prev) => new Set(prev).add(threadId));
    }
  };

  const togglePostHidden = (postId) => {
    if (hiddenPosts.has(postId)) {
      hideManager.unhidePost(postId);
      setHiddenPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      hideManager.hidePost(postId);
      setHiddenPosts((prev) => new Set(prev).add(postId));
    }
  };

  const toggleUserHidden = (userId) => {
    if (!userId) return;

    if (hiddenUsers.has(userId)) {
      hideManager.unhideUser(userId);
      setHiddenUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    } else {
      hideManager.hideUser(userId);
      setHiddenUsers((prev) => new Set(prev).add(userId));
    }
  };

  const isThreadHidden = (threadId) => hiddenThreads.has(threadId);
  const isPostHidden = (postId) => hiddenPosts.has(postId);
  const isUserHidden = (userId) => hiddenUsers.has(userId);

  return {
    hiddenThreads,
    hiddenPosts,
    hiddenUsers,
    toggleThreadHidden,
    togglePostHidden,
    toggleUserHidden,
    isThreadHidden,
    isPostHidden,
    isUserHidden,
  };
}
