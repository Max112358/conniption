//components/BoardPage.js

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";
const SOCKET_URL = "https://conniption.onrender.com";

export default function BoardPage() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wrap fetchThreads in useCallback to avoid dependency issues
  const fetchThreads = useCallback(async () => {
    try {
      const threadsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );
      if (!threadsResponse.ok) {
        throw new Error("Failed to load threads");
      }
      const threadsData = await threadsResponse.json();
      setThreads(threadsData.threads || []);
      return true;
    } catch (err) {
      console.error("Error fetching threads:", err);
      return false;
    }
  }, [boardId]);

  useEffect(() => {
    // Socket.io setup
    const socket = io(SOCKET_URL);

    // Join the board room
    socket.emit("join_board", boardId);

    // Listen for new threads
    socket.on("thread_created", (data) => {
      if (data.boardId === boardId) {
        // Refresh threads when a new thread is created
        fetchThreads();
      }
    });

    // Fetch board details and threads
    const fetchBoardData = async () => {
      try {
        // Fetch board details
        const boardResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}`
        );
        if (!boardResponse.ok) {
          throw new Error("Board not found");
        }
        const boardData = await boardResponse.json();
        setBoard(boardData.board);

        // Fetch threads
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

    // Cleanup function to leave the board room
    return () => {
      socket.emit("leave_board", boardId);
      socket.disconnect();
    };
  }, [boardId, fetchThreads]); // Added fetchThreads to dependencies

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="spinner-border text-light" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading board...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
            <Link to="/" className="btn btn-outline-light mt-3">
              ← Back to Boards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <div className="mb-4">
          <Link to="/" className="btn btn-outline-light btn-sm">
            ← Back to Boards
          </Link>
        </div>

        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h1 className="h3 mb-0 text-light">
              <span className="badge bg-secondary me-2">/{board.id}/</span>
              {board.name}
            </h1>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-0">{board.description}</p>
          </div>
        </div>

        <div className="card bg-mid-dark border-secondary shadow">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0 text-light">Threads</h2>

            {/* Using Link without debug code */}
            <Link
              to={`/board/${boardId}/create-thread`}
              className="btn btn-sm btn-primary"
            >
              New Thread
            </Link>
          </div>
          <div className="card-body">
            {threads.length > 0 ? (
              <div className="list-group">
                {threads.map((thread) => (
                  <Link
                    key={thread.id}
                    to={`/board/${boardId}/thread/${thread.id}`}
                    className="list-group-item list-group-item-action bg-high-dark text-light border-secondary"
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-1">{thread.topic}</h5>
                      <small className="text-secondary">
                        {new Date(thread.created_at).toLocaleString()}
                      </small>
                    </div>
                    <div className="d-flex">
                      {thread.image_url && (
                        <div className="me-3">
                          <img
                            src={thread.image_url}
                            alt="Thread"
                            className="img-fluid rounded"
                            style={{
                              maxWidth: "100px",
                              maxHeight: "100px",
                              objectFit: "cover",
                              backgroundColor: "#343a40",
                              border: "1px solid #6c757d",
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <p className="mb-1 text-truncate">{thread.content}</p>
                        <small className="text-secondary">
                          {thread.post_count}{" "}
                          {thread.post_count === 1 ? "post" : "posts"}
                        </small>
                      </div>
                    </div>
                  </Link>
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
