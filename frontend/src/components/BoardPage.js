// frontend/src/components/BoardPage.js

import { useState, useEffect, useCallback } from "react";
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

export default function BoardPage() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [threads, setThreads] = useState([]);
  const [threadsWithPosts, setThreadsWithPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Custom hooks
  const { banned, banInfo } = useBanCheck();
  const { socket, connected } = useSocket("board", boardId);
  const {
    hiddenPosts,
    toggleThreadHidden,
    togglePostHidden,
    toggleUserHidden,
    isThreadHidden,
    isUserHidden,
  } = useHideManager();

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );

      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.error === "Banned") {
          return false;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to load threads");
      }

      const data = await response.json();
      setThreads(data.threads || []);
      return true;
    } catch (err) {
      console.error("Error fetching threads:", err);
      setError(err.message || "Failed to load threads");
      return false;
    }
  }, [boardId]);

  // Fetch posts for threads
  const fetchThreadsWithPosts = useCallback(
    async (threadList) => {
      const updatedThreads = await Promise.all(
        threadList.map(async (thread) => {
          try {
            const postsResponse = await fetch(
              `${API_BASE_URL}/api/boards/${boardId}/threads/${thread.id}/posts`
            );

            if (!postsResponse.ok) {
              console.error(`Failed to fetch posts for thread ${thread.id}`);
              return thread;
            }

            const postsData = await postsResponse.json();
            const posts = postsData.posts || [];
            const replies = posts.slice(1);
            const latestReplies = replies.slice(-5);

            return {
              ...thread,
              posts: posts,
              latestReplies: latestReplies,
              totalReplies: replies.length,
            };
          } catch (err) {
            console.error(`Error fetching posts for thread ${thread.id}:`, err);
            return thread;
          }
        })
      );

      setThreadsWithPosts(updatedThreads);
    },
    [boardId]
  );

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleThreadCreated = async (data) => {
      console.log("New thread created:", data);
      if (data.boardId === boardId) {
        await fetchThreads();
      }
    };

    const handlePostCreated = async (data) => {
      console.log("New post created:", data);
      if (data.boardId === boardId) {
        // Update specific thread or refetch all
        await fetchThreads();
      }
    };

    socket.on("thread_created", handleThreadCreated);
    socket.on("post_created", handlePostCreated);

    return () => {
      socket.off("thread_created", handleThreadCreated);
      socket.off("post_created", handlePostCreated);
    };
  }, [socket, boardId, fetchThreads]);

  // Initial data fetch
  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const boardResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}`
        );

        if (!boardResponse.ok) {
          throw new Error("Board not found");
        }

        const boardData = await boardResponse.json();
        setBoard(boardData.board);

        await fetchThreads();
        setLoading(false);
      } catch (err) {
        console.error("Error fetching board data:", err);
        setError(
          err.message || "Failed to load board data. Please try again later."
        );
        setLoading(false);
      }
    };

    fetchBoardData();
  }, [boardId, fetchThreads]);

  // Fetch posts when threads change
  useEffect(() => {
    if (threads.length > 0) {
      fetchThreadsWithPosts(threads);
    }
  }, [threads, fetchThreadsWithPosts]);

  // Handle banned state
  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading board..." />;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} backLink="/" backText="← Back to Boards" />
    );
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <PageHeader
          backLink="/"
          backText="← Back to Boards"
          title={board.name}
          badge={`/${board.id}/`}
          subtitle={board.description}
          nsfw={board.nsfw}
        />

        <div className="card bg-mid-dark border-secondary shadow">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0 text-light">Threads</h2>
            <div className="d-flex align-items-center gap-3">
              <ConnectionStatus connected={connected} />
              <Link
                to={`/board/${boardId}/create-thread`}
                className="btn btn-sm btn-primary"
              >
                New Thread
              </Link>
            </div>
          </div>
          <div className="card-body">
            {threadsWithPosts.length > 0 ? (
              <div className="row">
                {threadsWithPosts.map((thread) => (
                  <div key={thread.id} className="col-12">
                    <ThreadCard
                      thread={thread}
                      boardId={boardId}
                      isHidden={isThreadHidden(thread.id)}
                      isUserHidden={isUserHidden}
                      onToggleHidden={() => toggleThreadHidden(thread.id)}
                      onToggleUserHidden={toggleUserHidden}
                      hiddenPosts={hiddenPosts}
                      onTogglePostHidden={togglePostHidden}
                    />
                  </div>
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
