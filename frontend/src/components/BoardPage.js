// frontend/src/components/BoardPage.js (updated with text wrapping and latest posts)

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
  const [latestPosts, setLatestPosts] = useState([]);
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

  // Fetch latest posts across all threads
  const fetchLatestPosts = useCallback(async () => {
    try {
      // Get latest posts from the most recent threads
      const latestThreads = threads.slice(0, 5); // Get top 5 threads
      const postPromises = latestThreads.map(async (thread) => {
        try {
          const postsResponse = await fetch(
            `${API_BASE_URL}/api/boards/${boardId}/threads/${thread.id}/posts`
          );

          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            // Get the last post from this thread
            const posts = postsData.posts || [];
            if (posts.length > 0) {
              const lastPost = posts[posts.length - 1];
              return {
                ...lastPost,
                thread_id: thread.id,
                thread_topic: thread.topic,
              };
            }
          }
        } catch (err) {
          console.error(`Error fetching posts for thread ${thread.id}:`, err);
        }
        return null;
      });

      const posts = await Promise.all(postPromises);
      const validPosts = posts.filter((post) => post !== null);
      // Sort by creation date, most recent first
      validPosts.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setLatestPosts(validPosts.slice(0, 5)); // Keep only 5 latest
    } catch (err) {
      console.error("Error fetching latest posts:", err);
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
        // Refresh latest posts when a new post is created
        fetchLatestPosts();
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
  }, [boardId, fetchThreads, fetchLatestPosts]);

  // Fetch latest posts when threads are updated
  useEffect(() => {
    if (threads.length > 0) {
      fetchLatestPosts();
    }
  }, [threads, fetchLatestPosts]);

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

        <div className="row">
          {/* Main Threads Column */}
          <div className="col-lg-8 mb-4">
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
                {threads.length > 0 ? (
                  <div className="list-group">
                    {threads.map((thread) => (
                      <Link
                        key={thread.id}
                        to={`/board/${boardId}/thread/${thread.id}`}
                        className="list-group-item list-group-item-action bg-high-dark text-light border-secondary mb-2"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="mb-1 text-break">{thread.topic}</h5>
                          <small className="text-secondary text-nowrap ms-2">
                            {new Date(thread.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="row">
                          {thread.image_url && (
                            <div className="col-auto">
                              <img
                                src={thread.image_url}
                                alt="Thread"
                                className="img-fluid rounded"
                                style={{
                                  maxWidth: "120px",
                                  maxHeight: "120px",
                                  objectFit: "cover",
                                }}
                              />
                            </div>
                          )}
                          <div className="col">
                            <p
                              className="mb-1 text-break"
                              style={{
                                whiteSpace: "pre-wrap",
                                wordWrap: "break-word",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                              }}
                            >
                              {truncateText(thread.content, 3, 200)}
                            </p>
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

          {/* Latest Posts Sidebar */}
          <div className="col-lg-4 mb-4">
            <div className="card bg-mid-dark border-secondary shadow">
              <div className="card-header border-secondary">
                <h2 className="h5 mb-0 text-light">Latest Posts</h2>
              </div>
              <div className="card-body">
                {latestPosts.length > 0 ? (
                  <div className="list-group">
                    {latestPosts.map((post, index) => (
                      <Link
                        key={`${post.thread_id}-${post.id}`}
                        to={`/board/${boardId}/thread/${post.thread_id}`}
                        className="list-group-item list-group-item-action bg-high-dark text-light border-secondary mb-2 p-2"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <small className="text-primary fw-bold text-break">
                            {truncateText(post.thread_topic, 1, 40)}
                          </small>
                          <small className="text-secondary text-nowrap ms-1">
                            {new Date(post.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="row">
                          {post.image_url && (
                            <div className="col-auto">
                              <img
                                src={post.image_url}
                                alt="Post"
                                className="img-fluid rounded"
                                style={{
                                  maxWidth: "60px",
                                  maxHeight: "60px",
                                  objectFit: "cover",
                                }}
                              />
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
                              {truncateText(post.content, 3, 150)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-secondary small">No recent posts</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
