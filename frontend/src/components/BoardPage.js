// frontend/src/components/BoardPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
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
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [threadsWithPosts, setThreadsWithPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boardNotFound, setBoardNotFound] = useState(false);

  const {
    hiddenThreads,
    hiddenPosts,
    hiddenUsers,
    toggleThreadHidden,
    togglePostHidden,
    toggleUserHidden,
    isThreadHidden,
    isPostHidden,
    isUserHidden,
  } = useHideManager();

  const { isBanned, banInfo, checkBan } = useBanCheck();

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
        const errorData = await threadsResponse.json();
        checkBan(errorData.ban || errorData.rangeban);
        return;
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
  }, [boardId, checkBan]);

  // Combined fetch function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchBoard(), fetchThreadsWithPosts()]);
    } finally {
      setLoading(false);
    }
  }, [fetchBoard, fetchThreadsWithPosts]);

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
      enabled: !loading && !error && !boardNotFound,
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
      handleThreadCreated,
      handlePostCreated,
    ]
  );

  const { isConnected } = useSocket(socketConfig);

  if (isBanned) {
    return <BanNotification banInfo={banInfo} />;
  }

  if (loading) {
    return <LoadingSpinner />;
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
    return <ErrorDisplay error={error} onRetry={fetchData} />;
  }

  return (
    <div className="board-page">
      <PageHeader
        backLink="/"
        title={`/${board.id}/ - ${board.name}`}
        subtitle={board.description}
        nsfw={board.nsfw}
        actions={
          <Link
            to={`/board/${boardId}/create-thread`}
            className="btn btn-sm btn-primary"
          >
            New Thread
          </Link>
        }
      />

      <Container>
        <ConnectionStatus connected={isConnected} className="mb-3" />

        {threadsWithPosts.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-secondary">
              No threads yet. Be the first to create one!
            </p>
            <Link
              to={`/board/${boardId}/create-thread`}
              className="btn btn-primary mt-3"
            >
              Create Thread
            </Link>
          </div>
        ) : (
          <Row>
            {threadsWithPosts.map((thread) => (
              <Col key={thread.id} xs={12} className="mb-4">
                <ThreadCard
                  thread={thread}
                  boardId={boardId}
                  board={board}
                  isHidden={isThreadHidden(thread.id)}
                  isUserHidden={(userId) => isUserHidden(userId)}
                  onToggleHidden={() => toggleThreadHidden(thread.id)}
                  onToggleUserHidden={toggleUserHidden}
                  onTogglePostHidden={togglePostHidden}
                  hiddenPosts={hiddenPosts}
                />
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
}

export default BoardPage;
