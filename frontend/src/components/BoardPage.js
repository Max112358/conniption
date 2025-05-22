// frontend/src/components/BoardPage.js (updated with latest posts under OP)

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import BanNotification from "./BanNotification";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";
const SOCKET_URL = "https://conniption.onrender.com";

export default function BoardPage() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [threads, setThreads] = useState([]);
  const [threadsWithPosts, setThreadsWithPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);

  // Wrap fetchThreads in useCallback to avoid dependency issues
  const fetchThreads = useCallback(async () => {
    try {
      const threadsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );

      // Check if response indicates the user is banned
      if (threadsResponse.status === 403) {
        const errorData = await threadsResponse.json();
        if (errorData.error === "Banned") {
          setBanned(true);
          setBanInfo(errorData.ban);
          return false;
        }
      }

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

  // Fetch latest posts for each thread
  const fetchThreadsWithPosts = useCallback(async () => {
    if (threads.length === 0) return;

    try {
      const threadsWithPostsPromises = threads.map(async (thread) => {
        try {
          const postsResponse = await fetch(
            `${API_BASE_URL}/api/boards/${boardId}/threads/${thread.id}/posts`
          );

          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            const posts = postsData.posts || [];

            // Get the latest 5 replies (excluding the first post which is the OP)
            const replies = posts.slice(1); // Skip first post (OP)
            const latestReplies = replies.slice(-5); // Get last 5 replies

            return {
              ...thread,
              posts: posts,
              latestReplies: latestReplies,
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
    }
  }, [boardId, threads]);

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

    // Listen for new posts
    socket.on("post_created", (data) => {
      if (data.boardId === boardId) {
        // Refresh threads with posts when a new post is created
        fetchThreadsWithPosts();
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
  }, [boardId, fetchThreads, fetchThreadsWithPosts]);

  // Fetch posts when threads are updated
  useEffect(() => {
    if (threads.length > 0) {
      fetchThreadsWithPosts();
    }
  }, [threads, fetchThreadsWithPosts]);

  // Helper function to truncate text
  const truncateText = (text, maxLines = 20, maxChars = 2000) => {
    if (!text) return "";

    // First truncate by character count
    let truncated =
      text.length > maxChars ? text.substring(0, maxChars) + "..." : text;

    // Then truncate by lines
    const lines = truncated.split("\n");
    if (lines.length > maxLines) {
      truncated = lines.slice(0, maxLines).join("\n") + "\n...";
    }

    return truncated;
  };

  // If user is banned, show the ban notification
  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

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
              {board.nsfw && <span className="badge bg-danger ms-2">NSFW</span>}
            </h1>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-0">{board.description}</p>
          </div>
        </div>

        <div className="card bg-mid-dark border-secondary shadow">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0 text-light">Threads</h2>
            <Link
              to={`/board/${boardId}/create-thread`}
              className="btn btn-sm btn-primary"
            >
              New Thread
            </Link>
          </div>
          <div className="card-body">
            {threadsWithPosts.length > 0 ? (
              <div className="thread-list">
                {threadsWithPosts.map((thread) => (
                  <div
                    key={thread.id}
                    className="card bg-high-dark border-secondary mb-4"
                  >
                    {/* Original Post (OP) */}
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <Link
                          to={`/board/${boardId}/thread/${thread.id}`}
                          className="text-decoration-none"
                        >
                          <h5 className="mb-1 text-light text-break">
                            {thread.topic}
                          </h5>
                        </Link>
                        <div className="d-flex flex-column align-items-end text-nowrap ms-2">
                          <small className="text-secondary">
                            {new Date(thread.created_at).toLocaleString()}
                          </small>
                          <small className="text-secondary">
                            {thread.post_count}{" "}
                            {thread.post_count === 1 ? "post" : "posts"}
                          </small>
                        </div>
                      </div>

                      {/* OP Content with larger thumbnail */}
                      <div className="row">
                        {thread.image_url && (
                          <div className="col-auto">
                            <Link to={`/board/${boardId}/thread/${thread.id}`}>
                              <img
                                src={thread.image_url}
                                alt="Thread"
                                className="img-fluid rounded"
                                style={{
                                  maxWidth: "150px",
                                  maxHeight: "150px",
                                  objectFit: "cover",
                                  cursor: "pointer",
                                }}
                              />
                            </Link>
                          </div>
                        )}
                        <div className="col">
                          <p
                            className="mb-0 text-break"
                            style={{
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                            }}
                          >
                            {truncateText(thread.content, 5, 300)}
                          </p>
                        </div>
                      </div>

                      {/* Latest Replies */}
                      {thread.latestReplies &&
                        thread.latestReplies.length > 0 && (
                          <div className="mt-3 border-top border-secondary pt-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <small className="text-muted">
                                Latest {thread.latestReplies.length} replies:
                              </small>
                              {thread.totalReplies > 5 && (
                                <Link
                                  to={`/board/${boardId}/thread/${thread.id}`}
                                  className="btn btn-outline-secondary btn-sm"
                                >
                                  View all {thread.totalReplies} replies
                                </Link>
                              )}
                            </div>

                            {thread.latestReplies.map((reply) => (
                              <div
                                key={reply.id}
                                className="mb-2 p-2 bg-dark rounded border border-secondary"
                              >
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                  <small className="text-secondary">
                                    Post #{reply.id}
                                  </small>
                                  <small className="text-secondary">
                                    {new Date(
                                      reply.created_at
                                    ).toLocaleString()}
                                  </small>
                                </div>

                                <div className="row">
                                  {reply.image_url && (
                                    <div className="col-auto">
                                      <Link
                                        to={`/board/${boardId}/thread/${thread.id}`}
                                      >
                                        <img
                                          src={reply.image_url}
                                          alt="Reply"
                                          className="img-fluid rounded"
                                          style={{
                                            maxWidth: "80px",
                                            maxHeight: "80px",
                                            objectFit: "cover",
                                            cursor: "pointer",
                                          }}
                                        />
                                      </Link>
                                    </div>
                                  )}
                                  <div className="col">
                                    <p
                                      className="mb-0 small text-break"
                                      style={{
                                        whiteSpace: "pre-wrap",
                                        wordWrap: "break-word",
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                      }}
                                    >
                                      {truncateText(reply.content, 3, 200)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div className="text-center mt-2">
                              <Link
                                to={`/board/${boardId}/thread/${thread.id}`}
                                className="btn btn-outline-primary btn-sm"
                              >
                                View Thread →
                              </Link>
                            </div>
                          </div>
                        )}
                    </div>
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
