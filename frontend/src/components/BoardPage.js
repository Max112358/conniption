// frontend/src/components/BoardPage.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import BanNotification from "./BanNotification";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";
const SOCKET_URL = "https://conniption.onrender.com";

// Component for post link preview
const PostLinkPreview = ({ postId, allThreadsWithPosts, x, y }) => {
  // Find the post across all threads
  let foundPost = null;
  let foundThread = null;

  for (const thread of allThreadsWithPosts) {
    if (thread.posts) {
      const post = thread.posts.find((p) => p.id === parseInt(postId));
      if (post) {
        foundPost = post;
        foundThread = thread;
        break;
      }
    }
  }

  if (!foundPost || !foundThread) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        maxWidth: "400px",
        zIndex: 9999,
        pointerEvents: "none",
        backgroundColor: "#1a1d20",
        border: "2px solid #495057",
        borderRadius: "0.375rem",
        padding: "1rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-secondary">Post #{foundPost.id}</span>
        <small className="text-secondary">
          {new Date(foundPost.created_at).toLocaleString()}
        </small>
      </div>
      <div className="mb-2">
        <small className="text-info">Thread: {foundThread.topic}</small>
      </div>
      {foundPost.image_url && (
        <img
          src={foundPost.image_url}
          alt="Preview"
          className="img-fluid mb-2"
          style={{ maxHeight: "100px", maxWidth: "100px", objectFit: "cover" }}
        />
      )}
      <p className="text-light mb-0 small" style={{ whiteSpace: "pre-wrap" }}>
        {foundPost.content.length > 200
          ? foundPost.content.substring(0, 200) + "..."
          : foundPost.content}
      </p>
    </div>
  );
};

// Component for rendering post content with links
const PostContent = ({
  content,
  allThreadsWithPosts,
  boardId,
  onPostLinkClick,
}) => {
  const [hoveredPostId, setHoveredPostId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Parse content and convert >>postId to links
  const parseContent = (text) => {
    const parts = text.split(/(>>\d+)/g);

    return parts.map((part, index) => {
      const match = part.match(/^>>(\d+)$/);
      if (match) {
        const postId = match[1];

        // Find the post and thread across all threads
        let targetPost = null;
        let targetThread = null;

        for (const thread of allThreadsWithPosts) {
          if (thread.posts) {
            const post = thread.posts.find((p) => p.id === parseInt(postId));
            if (post) {
              targetPost = post;
              targetThread = thread;
              break;
            }
          }
        }

        if (targetPost && targetThread) {
          // Check if this is the OP (first post in the thread)
          const isOP =
            targetThread.posts[0] &&
            targetThread.posts[0].id === parseInt(postId);

          return (
            <span
              key={index}
              className="text-primary"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => {
                onPostLinkClick(postId, targetThread.id);
              }}
              onMouseEnter={(e) => {
                setHoveredPostId(postId);
                const rect = e.target.getBoundingClientRect();
                const pos = {
                  x: rect.left,
                  y: rect.bottom + 5,
                };
                setMousePos(pos);
              }}
              onMouseLeave={() => {
                setHoveredPostId(null);
              }}
            >
              {part}
              {isOP ? "(OP)" : ""}
            </span>
          );
        }
      }
      return part;
    });
  };

  return (
    <>
      <p className="text-light mb-0" style={{ whiteSpace: "pre-wrap" }}>
        {parseContent(content)}
      </p>
      {hoveredPostId && (
        <PostLinkPreview
          postId={hoveredPostId}
          allThreadsWithPosts={allThreadsWithPosts}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </>
  );
};

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [threads, setThreads] = useState([]);
  const [threadsWithPosts, setThreadsWithPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Use ref to store socket instance
  const socketRef = useRef(null);

  // Store callbacks in refs to avoid recreating them
  const fetchThreadsRef = useRef();
  const fetchThreadsWithPostsRef = useRef();

  // Fetch threads function
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
  const fetchThreadsWithPosts = useCallback(
    async (threadsList) => {
      if (!threadsList || threadsList.length === 0) return;

      try {
        const threadsWithPostsPromises = threadsList.map(async (thread) => {
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

        const threadsWithPostsData = await Promise.all(
          threadsWithPostsPromises
        );
        setThreadsWithPosts(threadsWithPostsData);
      } catch (err) {
        console.error("Error fetching threads with posts:", err);
      }
    },
    [boardId]
  );

  // Update refs when functions change
  useEffect(() => {
    fetchThreadsRef.current = fetchThreads;
    fetchThreadsWithPostsRef.current = fetchThreadsWithPosts;
  }, [fetchThreads, fetchThreadsWithPosts]);

  // Handle clicking on a post link - navigate to the thread with the post
  const handlePostLinkClick = (postId, threadId) => {
    // Navigate to the thread page with a hash to scroll to the specific post
    navigate(`/board/${boardId}/thread/${threadId}#post-${postId}`);
  };

  // Socket setup - separate effect that only runs once per boardId
  useEffect(() => {
    console.log("Setting up Socket.io connection for board:", boardId);

    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      path: "/socket.io/",
      forceNew: true,
      rejectUnauthorized: false,
    });

    socketRef.current = socket;

    // Socket event handlers
    socket.on("connect", () => {
      console.log("Socket.io connected successfully");
      setSocketConnected(true);
      socket.emit("join_board", boardId);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.io disconnected:", reason);
      setSocketConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error.message);
      setSocketConnected(false);
    });

    // Listen for new threads
    socket.on("thread_created", (data) => {
      console.log("New thread created:", data);
      if (data.boardId === boardId && fetchThreadsRef.current) {
        fetchThreadsRef.current();
      }
    });

    // Listen for new posts
    socket.on("post_created", (data) => {
      console.log("New post created:", data);
      if (data.boardId === boardId && fetchThreadsRef.current) {
        // First fetch threads, then fetch posts
        fetchThreadsRef.current().then(() => {
          // Get the latest threads from state
          setThreads((currentThreads) => {
            if (fetchThreadsWithPostsRef.current) {
              fetchThreadsWithPostsRef.current(currentThreads);
            }
            return currentThreads;
          });
        });
      }
    });

    // Cleanup
    return () => {
      console.log("Cleaning up Socket.io connection for board:", boardId);
      if (socket.connected) {
        socket.emit("leave_board", boardId);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId]); // Only re-run when boardId changes

  // Initial data fetch - separate effect
  useEffect(() => {
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
        const success = await fetchThreads();

        if (success) {
          // Threads will be fetched and state will be updated
          // The next effect will handle fetching posts
        }

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
            {/* Socket connection indicator */}
            <small
              className={`text-${socketConnected ? "success" : "warning"}`}
            >
              {socketConnected ? "● Live updates enabled" : "○ Connecting..."}
            </small>
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
                          <div
                            className="text-light text-break"
                            style={{
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                            }}
                          >
                            <PostContent
                              content={truncateText(thread.content, 20, 2000)}
                              allThreadsWithPosts={threadsWithPosts}
                              boardId={boardId}
                              onPostLinkClick={handlePostLinkClick}
                            />
                          </div>
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
                                    <div
                                      className="small text-light text-break"
                                      style={{
                                        whiteSpace: "pre-wrap",
                                        wordWrap: "break-word",
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                      }}
                                    >
                                      <PostContent
                                        content={truncateText(
                                          reply.content,
                                          20,
                                          2000
                                        )}
                                        allThreadsWithPosts={threadsWithPosts}
                                        boardId={boardId}
                                        onPostLinkClick={handlePostLinkClick}
                                      />
                                    </div>
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
