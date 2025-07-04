// frontend/src/components/BoardPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Row, Col, Button } from "react-bootstrap";
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
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boardNotFound, setBoardNotFound] = useState(false);

  const { isHidden, toggleHide } = useHideManager();
  const { isBanned, banInfo, checkBan } = useBanCheck();

  // Memoize the fetch functions to prevent recreation on every render
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

  const fetchThreads = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );
      const data = await response.json();

      if (!response.ok) {
        // Check for ban
        if (response.status === 403 && data.ban) {
          checkBan(data.ban);
          return;
        }
        throw new Error(data.error || "Failed to fetch threads");
      }

      setThreads(data.threads || []);
    } catch (err) {
      console.error("Error fetching threads:", err);
      setError(err.message);
    }
  }, [boardId, checkBan]);

  // Combined fetch function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchBoard(), fetchThreads()]);
    } finally {
      setLoading(false);
    }
  }, [fetchBoard, fetchThreads]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket event handlers - memoized to prevent recreation
  const handleThreadCreated = useCallback(
    (data) => {
      console.log("Thread created event received:", data);
      if (data.boardId === boardId) {
        fetchThreads();
      }
    },
    [boardId, fetchThreads]
  );

  const handlePostCreated = useCallback(
    (data) => {
      console.log("Post created event received:", data);
      if (data.boardId === boardId) {
        fetchThreads();
      }
    },
    [boardId, fetchThreads]
  );

  // Socket configuration with stable dependencies
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
        message="The board you're looking for doesn't exist."
        showHomeButton
      />
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchData} />;
  }

  return (
    <div className="board-page">
      <PageHeader
        title={`/${boardId}/ - ${board?.name || "Loading..."}`}
        subtitle={board?.description}
      >
        <Link to={`/boards/${boardId}/create`}>
          <Button variant="primary">Create New Thread</Button>
        </Link>
      </PageHeader>

      <Container>
        <ConnectionStatus isConnected={isConnected} />

        {threads.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p>No threads yet. Be the first to create one!</p>
          </div>
        ) : (
          <Row>
            {threads.map((thread) => (
              <Col key={thread.id} xs={12} className="mb-4">
                <ThreadCard
                  thread={thread}
                  boardId={boardId}
                  isHidden={isHidden(thread.id)}
                  onToggleHide={() => toggleHide(thread.id)}
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
