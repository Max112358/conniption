// frontend/src/components/ThreadPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Button } from "react-bootstrap";
import BanNotification from "./BanNotification";
import LoadingSpinner from "./LoadingSpinner";
import PageHeader from "./shared/PageHeader";
import ErrorDisplay from "./shared/ErrorDisplay";
import ConnectionStatus from "./shared/ConnectionStatus";
import PostCard from "./shared/PostCard";
import ReplyForm from "./shared/ReplyForm";
import useSocket from "../hooks/useSocket";
import useHideManager from "../hooks/useHideManager";
import useBanCheck from "../hooks/useBanCheck";
import useAdminStatus from "../hooks/useAdminStatus";
import { API_BASE_URL } from "../config/api";

function ThreadPage() {
  const { boardId, threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threadNotFound, setThreadNotFound] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const { isHidden, toggleHide } = useHideManager();
  const { isBanned, banInfo, checkBan } = useBanCheck();
  const { isAdmin } = useAdminStatus();

  // Memoize the fetch functions
  const fetchThread = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setThreadNotFound(true);
          return;
        }
        throw new Error(data.error || "Failed to fetch thread");
      }

      setThread(data.thread);
      setThreadNotFound(false);
    } catch (err) {
      console.error("Error fetching thread:", err);
      setError(err.message);
    }
  }, [boardId, threadId]);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
      );
      const data = await response.json();

      if (!response.ok) {
        // Check for ban
        if (response.status === 403 && data.ban) {
          checkBan(data.ban);
          return;
        }
        throw new Error(data.error || "Failed to fetch posts");
      }

      setPosts(data.posts || []);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError(err.message);
    }
  }, [boardId, threadId, checkBan]);

  // Combined fetch function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchThread(), fetchPosts()]);
    } finally {
      setLoading(false);
    }
  }, [fetchThread, fetchPosts]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket event handler - memoized
  const handlePostCreated = useCallback(
    (data) => {
      console.log("Post created event received:", data);
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        fetchPosts();
      }
    },
    [boardId, threadId, fetchPosts]
  );

  // Socket configuration with stable dependencies
  const socketConfig = useMemo(
    () => ({
      room: `${boardId}-${threadId}`,
      enabled: !loading && !error && !threadNotFound,
      events: {
        post_created: handlePostCreated,
      },
    }),
    [boardId, threadId, loading, error, threadNotFound, handlePostCreated]
  );

  const { isConnected } = useSocket(socketConfig);

  const handleReplySuccess = useCallback(() => {
    setShowReplyForm(false);
    fetchPosts();
  }, [fetchPosts]);

  const handleDeletePost = useCallback(
    async (postId) => {
      if (!window.confirm("Are you sure you want to delete this post?")) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/posts/${postId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              boardId,
              threadId,
              reason: "Admin deletion",
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete post");
        }

        // Refresh posts after deletion
        fetchPosts();
      } catch (err) {
        console.error("Error deleting post:", err);
        alert("Failed to delete post: " + err.message);
      }
    },
    [boardId, threadId, fetchPosts]
  );

  if (isBanned) {
    return <BanNotification banInfo={banInfo} />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (threadNotFound) {
    return (
      <ErrorDisplay
        error="Thread not found"
        message="The thread you're looking for doesn't exist."
        showHomeButton
      />
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchData} />;
  }

  return (
    <div className="thread-page">
      <PageHeader
        title={thread?.topic || "Loading..."}
        subtitle={
          <Link to={`/boards/${boardId}`} className="text-decoration-none">
            ← Back to /{boardId}/
          </Link>
        }
      />

      <Container>
        <ConnectionStatus isConnected={isConnected} />

        <div className="posts-container">
          {posts.length === 0 ? (
            <div className="text-center text-muted py-5">
              <p>No posts in this thread yet.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                isOP={index === 0}
                isHidden={isHidden(post.id)}
                onToggleHide={() => toggleHide(post.id)}
                isAdmin={isAdmin}
                onDelete={() => handleDeletePost(post.id)}
                boardSettings={{
                  thread_ids_enabled: thread?.thread_ids_enabled,
                  country_flags_enabled: thread?.country_flags_enabled,
                }}
              />
            ))
          )}
        </div>

        {!showReplyForm && (
          <div className="text-center my-4">
            <Button
              variant="primary"
              onClick={() => setShowReplyForm(true)}
              disabled={isBanned}
            >
              Reply to Thread
            </Button>
          </div>
        )}

        {showReplyForm && (
          <ReplyForm
            boardId={boardId}
            threadId={threadId}
            onSuccess={handleReplySuccess}
            onCancel={() => setShowReplyForm(false)}
          />
        )}
      </Container>
    </div>
  );
}

export default ThreadPage;
