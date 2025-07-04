// frontend/src/components/BoardPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import BanNotification from "./BanNotification";
import LoadingSpinner from "./LoadingSpinner";
import PageHeader from "./shared/PageHeader";
import ErrorDisplay from "./shared/ErrorDisplay";
import ConnectionStatus from "./shared/ConnectionStatus";
import ThreadCard from "./shared/ThreadCard";
import useSocket from "../hooks/useSocket";
import useHideManager from "../hooks/useHideManager";
import useBanCheck from "../hooks/useBanCheck";
import { API_BASE_URL } from "../config/api";

function BoardPage() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [threadsWithPosts, setThreadsWithPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boardNotFound, setBoardNotFound] = useState(false);

  const {
    hiddenThreads,
    hiddenPosts,
    toggleThreadHidden,
    togglePostHidden,
    toggleUserHidden,
    isThreadHidden,
    isUserHidden,
  } = useHideManager();

  const { banned, banInfo, checkBanStatus, resetBanStatus } = useBanCheck();

  // Fetch board details
  const fetchBoard = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setBoardNotFound(true);
          return;
        }
        throw new Error(data.error || "Failed to fetch board");
      }

      setBoard(data.board);
      setBoardNotFound(false);
    } catch (err) {
      console.error("Error fetching board:", err);
      setError(err.message);
    }
  }, [boardId]);

  // Fetch threads with their latest posts
  const fetchThreadsWithPosts = useCallback(async () => {
    try {
      // First fetch threads
      const threadsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );

      // Check for ban
      if (threadsResponse.status === 403) {
        const isBanned = await checkBanStatus(threadsResponse);
        if (isBanned) return;
      }

      if (!threadsResponse.ok) {
        throw new Error("Failed to fetch threads");
      }

      const threadsData = await threadsResponse.json();
      const threads = threadsData.threads || [];

      // Then fetch posts for each thread
      const threadsWithPostsPromises = threads.map(async (thread) => {
        try {
          const postsResponse = await fetch(
            `${API_BASE_URL}/api/boards/${boardId}/threads/${thread.id}/posts`
          );

          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            const posts = postsData.posts || [];
            const replies = posts.slice(1); // Skip OP
            const latestReplies = replies.slice(-5); // Get last 5 replies

            return {
              ...thread,
              posts,
              latestReplies,
              totalReplies: replies.length,
            };
          }
        } catch (err) {
          console.error(`Error fetching posts for thread ${thread.id}:`, err);
        }

        return {
          ...thread,
          posts: [],
          latestReplies: [],
          totalReplies: 0,
        };
      });

      const threadsWithPostsData = await Promise.all(threadsWithPostsPromises);
      setThreadsWithPosts(threadsWithPostsData);
    } catch (err) {
      console.error("Error fetching threads with posts:", err);
      setError(err.message);
    }
  }, [boardId, checkBanStatus]);

  // Combined fetch function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    resetBanStatus();
    try {
      await Promise.all([fetchBoard(), fetchThreadsWithPosts()]);
    } finally {
      setLoading(false);
    }
  }, [fetchBoard, fetchThreadsWithPosts, resetBanStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket event handlers
  const handleThreadCreated = useCallback(
    (data) => {
      if (data.boardId === boardId) {
        fetchThreadsWithPosts();
      }
    },
    [boardId, fetchThreadsWithPosts]
  );

  const handlePostCreated = useCallback(
    (data) => {
      if (data.boardId === boardId) {
        fetchThreadsWithPosts();
      }
    },
    [boardId, fetchThreadsWithPosts]
  );

  // Socket configuration
  const socketConfig = useMemo(
    () => ({
      room: boardId,
      enabled: !loading && !error && !boardNotFound && !banned,
      events: {
        thread_created: handleThreadCreated,
        post_created: handlePostCreated,
      },
    }),
    [
      boardId,
      loading,
      error,
      boardNotFound,
      banned,
      handleThreadCreated,
      handlePostCreated,
    ]
  );

  const { isConnected } = useSocket(socketConfig);

  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading board..." />;
  }

  if (boardNotFound) {
    return (
      <ErrorDisplay
        error="Board not found"
        backLink="/"
        backText="← Back to Boards"
      />
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <PageHeader
          backLink="/"
          backText="← Back to Boards"
          title={`/${board?.id}/ - ${board?.name}`}
          nsfw={board?.nsfw}
          subtitle={board?.description}
          actions={
            <Link
              to={`/board/${boardId}/create-thread`}
              className="btn btn-sm btn-primary"
            >
              New Thread
            </Link>
          }
        />

        <ConnectionStatus connected={isConnected} className="mb-3" />

        <div className="card bg-mid-dark border-secondary shadow">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0 text-light">Threads</h2>
          </div>
          <div className="card-body">
            {threadsWithPosts.length > 0 ? (
              <div className="thread-list">
                {threadsWithPosts.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    boardId={boardId}
                    board={board}
                    isHidden={isThreadHidden(thread.id)}
                    isUserHidden={isUserHidden}
                    onToggleHidden={() => toggleThreadHidden(thread.id)}
                    onToggleUserHidden={toggleUserHidden}
                    hiddenPosts={hiddenPosts}
                    onTogglePostHidden={togglePostHidden}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-5">
                <p className="text-secondary">
                  No threads yet. Be the first to create one!
                </p>
                <Link
                  to={`/board/${boardId}/create-thread`}
                  className="btn btn-primary"
                >
                  Create Thread
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoardPage;
