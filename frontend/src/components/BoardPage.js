// frontend/src/components/BoardPage.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import BanNotification from "./BanNotification";
import PostContent from "./PostContent";
import PostHeader from "./PostHeader";
import LoadingSpinner from "./LoadingSpinner";
import HideButton from "./HideButton";
import hideManager from "../utils/hideManager";
import useBanCheck from "../hooks/useBanCheck";
import { API_BASE_URL, SOCKET_URL } from "../config/api";

// Component for rendering media thumbnails
const MediaThumbnail = ({ src, alt, fileType, size = "150px", linkTo }) => {
  // Determine if this is a video based on extension or fileType
  const isVideo =
    fileType === "video" ||
    (src &&
      (src.toLowerCase().endsWith(".mp4") ||
        src.toLowerCase().endsWith(".webm")));

  if (!src) return null;

  const handleClick = (e) => {
    // Prevent default for middle click
    if (e.button === 1) {
      e.preventDefault();
      window.open(src, "_blank");
    }
  };

  // For videos, show a thumbnail with play icon
  if (isVideo) {
    return (
      <Link
        to={linkTo}
        onMouseDown={handleClick}
        style={{ textDecoration: "none" }}
      >
        <div className="position-relative d-inline-block">
          <video
            src={src}
            className="img-fluid rounded"
            style={{
              maxWidth: size,
              maxHeight: size,
              objectFit: "cover",
            }}
            muted
            playsInline
            preload="metadata"
          />
          <div
            className="position-absolute top-50 start-50 translate-middle"
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <i className="bi bi-play-fill text-white fs-4"></i>
          </div>
        </div>
      </Link>
    );
  }

  // For images
  return (
    <Link
      to={linkTo}
      onMouseDown={handleClick}
      style={{ textDecoration: "none" }}
    >
      <img
        src={src}
        alt={alt}
        className="img-fluid rounded"
        style={{
          maxWidth: size,
          maxHeight: size,
          objectFit: "cover",
        }}
        loading="lazy"
      />
    </Link>
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
  const [socketConnected, setSocketConnected] = useState(false);
  const [hiddenThreads, setHiddenThreads] = useState(new Set());
  const [hiddenPosts, setHiddenPosts] = useState(new Set());
  const [hiddenUsers, setHiddenUsers] = useState(new Set());

  // Use the ban check hook
  const { banned, banInfo, checkBanStatus } = useBanCheck();

  // Use ref to store socket instance
  const socketRef = useRef(null);

  // Initialize hidden state from localStorage
  useEffect(() => {
    const hidden = hideManager.getAllHidden();
    setHiddenThreads(new Set(hidden.threads));
    setHiddenPosts(new Set(hidden.posts));
    setHiddenUsers(new Set(hidden.users));
  }, []);

  // Fetch threads function
  const fetchThreads = useCallback(async () => {
    try {
      const threadsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`
      );

      // Check if response indicates the user is banned
      const isBanned = await checkBanStatus(threadsResponse);
      if (isBanned) {
        return false;
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
  }, [boardId, checkBanStatus]);

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

  // Handle clicking on a post link - navigate to the thread with the post
  const handlePostLinkClick = (postId, threadId) => {
    // Navigate to the thread page with a hash to scroll to the specific post
    navigate(`/board/${boardId}/thread/${threadId}#post-${postId}`);
  };

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

  // Hide/unhide functions
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

  const toggleUserHidden = (threadUserId) => {
    if (!threadUserId) return;

    if (hiddenUsers.has(threadUserId)) {
      hideManager.unhideUser(threadUserId);
      setHiddenUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(threadUserId);
        return newSet;
      });
    } else {
      hideManager.hideUser(threadUserId);
      setHiddenUsers((prev) => new Set(prev).add(threadUserId));
    }
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
    socket.on("thread_created", async (data) => {
      console.log("New thread created:", data);
      if (data.boardId === boardId) {
        // Fetch all threads again to get the new thread
        const threadsResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads`
        );

        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json();
          const newThreads = threadsData.threads || [];
          setThreads(newThreads);

          // Then fetch posts for all threads including the new one
          fetchThreadsWithPosts(newThreads);
        }
      }
    });

    // Listen for new posts
    socket.on("post_created", async (data) => {
      console.log("New post created:", data);
      if (data.boardId === boardId) {
        // Re-fetch the specific thread's posts to update the latest replies
        setThreadsWithPosts((currentThreadsWithPosts) => {
          return currentThreadsWithPosts.map(async (thread) => {
            if (thread.id === data.threadId) {
              // Fetch updated posts for this thread
              try {
                const postsResponse = await fetch(
                  `${API_BASE_URL}/api/boards/${boardId}/threads/${thread.id}/posts`
                );

                if (postsResponse.ok) {
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
                }
              } catch (err) {
                console.error(
                  `Error updating posts for thread ${thread.id}:`,
                  err
                );
              }
            }
            return thread;
          });
        });

        // Also re-fetch all threads to update the order (bumping)
        fetchThreads();
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
  }, [boardId, fetchThreads, fetchThreadsWithPosts]);

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

  // If user is banned, show the ban notification
  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading board..." />;
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
                {threadsWithPosts.map((thread) => {
                  const isThreadHidden = hiddenThreads.has(thread.id);

                  return (
                    <div
                      key={thread.id}
                      className="card bg-high-dark border-secondary mb-4"
                    >
                      {/* Original Post (OP) */}
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="d-flex align-items-center gap-2">
                            <HideButton
                              isHidden={isThreadHidden}
                              onToggle={() => toggleThreadHidden(thread.id)}
                              title={
                                isThreadHidden
                                  ? "Unhide this thread"
                                  : "Hide this thread"
                              }
                            />
                            <Link
                              to={`/board/${boardId}/thread/${thread.id}`}
                              className="text-decoration-none"
                            >
                              <h5 className="mb-1 text-light text-break">
                                {thread.topic}
                              </h5>
                            </Link>
                          </div>
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

                        {!isThreadHidden ? (
                          <>
                            {/* OP Content with larger thumbnail */}
                            <div className="row">
                              {thread.image_url && (
                                <div className="col-auto">
                                  <MediaThumbnail
                                    src={thread.image_url}
                                    alt="Thread"
                                    fileType={thread.file_type}
                                    size="150px"
                                    linkTo={`/board/${boardId}/thread/${thread.id}`}
                                  />
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
                                    content={truncateText(
                                      thread.content,
                                      20,
                                      2000
                                    )}
                                    allThreadsWithPosts={threadsWithPosts}
                                    boardId={boardId}
                                    onPostLinkClick={handlePostLinkClick}
                                    isThreadPage={false}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Latest Replies */}
                            {thread.latestReplies &&
                              thread.latestReplies.length > 0 && (
                                <div className="mt-3 border-top border-secondary pt-3">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <small className="text-secondary">
                                      Latest {thread.latestReplies.length}{" "}
                                      replies:
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

                                  {thread.latestReplies.map((reply) => {
                                    const isPostHidden = hiddenPosts.has(
                                      reply.id
                                    );
                                    const isUserHidden =
                                      reply.thread_user_id &&
                                      hiddenUsers.has(reply.thread_user_id);
                                    const isHidden =
                                      isPostHidden || isUserHidden;

                                    return (
                                      <div
                                        key={reply.id}
                                        className="mb-2 p-2 bg-dark rounded border border-secondary"
                                      >
                                        <div className="mb-1">
                                          <PostHeader
                                            post={reply}
                                            onPostNumberClick={() => {}} // No direct reply from board page
                                            showThreadId={
                                              board?.thread_ids_enabled
                                            }
                                            showCountryFlag={
                                              board?.country_flags_enabled
                                            }
                                            isPostHidden={isPostHidden}
                                            isUserHidden={isUserHidden}
                                            onTogglePostHidden={
                                              togglePostHidden
                                            }
                                            onToggleUserHidden={
                                              toggleUserHidden
                                            }
                                          />
                                        </div>

                                        {!isHidden ? (
                                          <div className="row">
                                            {reply.image_url && (
                                              <div className="col-auto">
                                                <MediaThumbnail
                                                  src={reply.image_url}
                                                  alt="Reply"
                                                  fileType={reply.file_type}
                                                  size="80px"
                                                  linkTo={`/board/${boardId}/thread/${thread.id}`}
                                                />
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
                                                  allThreadsWithPosts={
                                                    threadsWithPosts
                                                  }
                                                  boardId={boardId}
                                                  onPostLinkClick={
                                                    handlePostLinkClick
                                                  }
                                                  isThreadPage={false}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-secondary mb-0 small">
                                            <em>Post hidden</em>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}

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
                          </>
                        ) : (
                          <p className="text-secondary mb-0">
                            <em>Thread hidden</em>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
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
