// frontend/src/components/ThreadPage.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import PostModMenu from "./admin/PostModMenu";
import BanNotification from "./BanNotification";
import MediaViewer from "./MediaViewer";
import PostContent from "./PostContent";
import PostHeader from "./PostHeader";
import LoadingSpinner from "./LoadingSpinner";
import hideManager from "../utils/hideManager";
import useBanCheck from "../hooks/useBanCheck";
import { API_BASE_URL, SOCKET_URL } from "../config/api";

export default function ThreadPage() {
  const { boardId, threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [board, setBoard] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [hiddenPosts, setHiddenPosts] = useState(new Set());
  const [hiddenUsers, setHiddenUsers] = useState(new Set());

  // Use the ban check hook
  const { banned, banInfo, checkBanStatus } = useBanCheck();

  const contentTextareaRef = useRef(null);
  const socketRef = useRef(null);
  const postsRef = useRef(posts); // Keep track of current posts for socket handler

  // Update postsRef when posts change
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Add custom CSS for highlight animation
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes postHighlight {
        0% { background-color: rgba(255, 193, 7, 0.5) !important; }
        100% { background-color: transparent; }
      }
      .post-highlight {
        animation: postHighlight 2s ease-out;
      }
      @keyframes newPostSlide {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      .new-post-animation {
        animation: newPostSlide 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Check if user is logged in as admin/mod
  useEffect(() => {
    const checkAdminStatus = async () => {
      const token = localStorage.getItem("adminToken");
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/verify`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setAdminUser(data.user);
          }
        } catch (err) {
          console.error("Error verifying admin status:", err);
        }
      }
    };

    checkAdminStatus();
  }, []);

  // Initialize hidden state from localStorage
  useEffect(() => {
    const hidden = hideManager.getAllHidden();
    setHiddenPosts(new Set(hidden.posts));
    setHiddenUsers(new Set(hidden.users));
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(
    async (isSocketUpdate = false) => {
      try {
        const postsResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
        );

        if (!postsResponse.ok) {
          throw new Error("Failed to load posts");
        }

        const postsData = await postsResponse.json();
        const newPosts = postsData.posts || [];

        // If this is a socket update and we have existing posts, animate new ones
        if (isSocketUpdate && postsRef.current.length > 0) {
          const existingPostIds = new Set(postsRef.current.map((p) => p.id));
          const actualNewPosts = newPosts.filter(
            (p) => !existingPostIds.has(p.id)
          );

          if (actualNewPosts.length > 0) {
            // Mark the new posts for animation
            const markedPosts = newPosts.map((post) => ({
              ...post,
              isNew: !existingPostIds.has(post.id),
            }));
            setPosts(markedPosts);

            // Remove the "new" flag after animation completes
            setTimeout(() => {
              setPosts((current) =>
                current.map((post) => ({
                  ...post,
                  isNew: false,
                }))
              );
            }, 500);

            // Show notification if user is scrolled up
            const scrollPosition = window.scrollY + window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            if (scrollPosition < documentHeight - 100) {
              setNewPostsAvailable(true);
            }
          } else {
            setPosts(newPosts);
          }
        } else {
          setPosts(newPosts);
        }

        return true;
      } catch (err) {
        console.error("Error fetching posts:", err);
        return false;
      }
    },
    [boardId, threadId]
  );

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      setPostError("Please enter a message");
      return;
    }

    setPostLoading(true);
    setPostError(null);

    try {
      const formData = new FormData();
      formData.append("content", content);
      if (image) {
        formData.append("image", image);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`,
        {
          method: "POST",
          body: formData,
        }
      );

      // Check if response indicates the user is banned
      const isBanned = await checkBanStatus(response);
      if (isBanned) {
        setPostLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to post");
      }

      // Clear form
      setContent("");
      setImage(null);
      setImagePreview(null);

      // Socket will handle updating the posts
      setPostLoading(false);
    } catch (err) {
      console.error("Error submitting post:", err);
      setPostError(
        err.message || "Failed to submit post. Please try again later."
      );
      setPostLoading(false);
    }
  };

  // Handle clicking on a post number to quote it
  const handlePostNumberClick = (postId) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const replyLink = `>>${postId}`;
    const currentContent = content;

    // If content is empty or ends with a newline, just add the link
    if (!currentContent || currentContent.endsWith("\n")) {
      setContent(currentContent + replyLink + "\n");
    } else {
      // Otherwise add a newline before the link
      setContent(currentContent + "\n" + replyLink + "\n");
    }

    // Focus the textarea
    textarea.focus();

    // Scroll to the textarea
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Handle clicking on a post link to scroll to that post
  const handlePostLinkClick = (postId) => {
    const postElement = document.getElementById(`post-${postId}`);
    if (postElement) {
      // Get the header height to offset the scroll
      const headerOffset = 80; // Adjust this based on your header height
      const elementPosition = postElement.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Add a temporary highlight effect
      postElement.classList.add("post-highlight");

      // Remove any existing highlight classes after animation
      setTimeout(() => {
        const allPosts = document.querySelectorAll(".post-highlight");
        allPosts.forEach((post) => post.classList.remove("post-highlight"));
      }, 2000);
    }
  };

  // Scroll to new posts when notification is clicked
  const scrollToNewPosts = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setNewPostsAvailable(false);
  };

  // Hide/unhide functions
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

  // Socket setup effect
  useEffect(() => {
    console.log("Setting up Socket.io connection for thread:", threadId);

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
      // Join the thread room after connection
      socket.emit("join_thread", { boardId, threadId });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.io disconnected:", reason);
      setSocketConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error.message);
      setSocketConnected(false);
    });

    // Listen for new posts
    socket.on("post_created", (data) => {
      console.log("New post created event received:", data);
      if (data.threadId === parseInt(threadId) && data.boardId === boardId) {
        console.log("Post is for this thread, fetching updates...");
        // Fetch posts with socket update flag
        fetchPosts(true);
      }
    });

    // Cleanup function
    return () => {
      console.log("Cleaning up Socket.io connection for thread:", threadId);
      if (socket.connected) {
        socket.emit("leave_thread", { boardId, threadId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, threadId, fetchPosts]);

  // Initial data fetch
  useEffect(() => {
    const fetchThreadData = async () => {
      try {
        // Fetch board details to get settings
        const boardResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}`
        );

        if (!boardResponse.ok) {
          throw new Error("Board not found");
        }

        const boardData = await boardResponse.json();
        setBoard(boardData.board);

        // Fetch thread details
        const threadResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}`
        );

        if (!threadResponse.ok) {
          throw new Error("Thread not found");
        }

        const threadData = await threadResponse.json();
        setThread(threadData.thread);

        // Fetch posts
        await fetchPosts(false);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching thread data:", err);
        setError(
          err.message || "Failed to load thread data. Please try again later."
        );
        setLoading(false);
      }
    };

    fetchThreadData();
  }, [boardId, threadId, fetchPosts]);

  // Check if user is admin or moderator
  const isAdmin = adminUser && adminUser.role === "admin";
  const isModerator =
    adminUser && (adminUser.role === "moderator" || adminUser.role === "admin");

  // If user is banned, show the ban notification
  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading thread..." />;
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
            <Link
              to={`/board/${boardId}`}
              className="btn btn-outline-light mt-3"
            >
              ← Back to Board
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
          <Link
            to={`/board/${boardId}`}
            className="btn btn-outline-light btn-sm"
          >
            ← Back to Board
          </Link>
        </div>

        {/* Thread Header */}
        <div className="card bg-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0 text-light">
              <span className="badge bg-secondary me-2">/{boardId}/</span>
              <span className="text-light">{thread.topic}</span>
            </h1>

            {/* Thread mod options for admins/mods */}
            {isModerator && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => console.log("Delete thread")}
              >
                <i className="bi bi-trash"></i> Delete Thread
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <p className="text-secondary mb-0">
                Thread created: {new Date(thread.created_at).toLocaleString()}
              </p>

              <div className="d-flex align-items-center gap-2">
                {/* Socket connection indicator */}
                <small
                  className={`text-${socketConnected ? "success" : "warning"}`}
                >
                  {socketConnected ? "● Live" : "○ Connecting..."}
                </small>

                {/* Admin badge */}
                {adminUser && (
                  <span
                    className={`badge bg-${
                      adminUser.role === "admin"
                        ? "danger"
                        : adminUser.role === "moderator"
                        ? "warning"
                        : "secondary"
                    }`}
                  >
                    {adminUser.role}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* New posts notification */}
        {newPostsAvailable && (
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x mb-3"
            style={{ zIndex: 1000 }}
          >
            <button
              className="btn btn-primary shadow-lg"
              onClick={scrollToNewPosts}
            >
              <i className="bi bi-arrow-down-circle me-2"></i>
              New posts available
            </button>
          </div>
        )}

        {/* Posts Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0 text-light">Posts</h2>
          </div>
          <div className="card-body">
            {posts.length > 0 ? (
              <div className="post-list">
                {posts.map((post, index) => {
                  const isPostHidden = hiddenPosts.has(post.id);
                  const isUserHidden =
                    post.thread_user_id && hiddenUsers.has(post.thread_user_id);
                  const isHidden = isPostHidden || isUserHidden;

                  return (
                    <div
                      key={post.id}
                      id={`post-${post.id}`}
                      className={`card bg-dark border-secondary mb-3 ${
                        post.isNew ? "new-post" : ""
                      }`}
                      style={{ transition: "background-color 0.3s ease" }}
                    >
                      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                        <PostHeader
                          post={post}
                          onPostNumberClick={handlePostNumberClick}
                          showThreadId={board?.thread_ids_enabled}
                          showCountryFlag={board?.country_flags_enabled}
                          isPostHidden={isPostHidden}
                          isUserHidden={isUserHidden}
                          onTogglePostHidden={togglePostHidden}
                          onToggleUserHidden={toggleUserHidden}
                        />

                        {/* Moderation menu */}
                        {isModerator && !isHidden && (
                          <PostModMenu
                            post={post}
                            thread={thread}
                            board={{ id: boardId }}
                            isAdmin={isAdmin}
                            isMod={isModerator}
                          />
                        )}
                      </div>

                      {!isHidden ? (
                        <div className="card-body">
                          {/* Use MediaViewer for images and videos */}
                          {post.image_url && (
                            <MediaViewer
                              src={post.image_url}
                              alt="Post content"
                              postId={post.id}
                              fileType={post.file_type}
                            />
                          )}
                          <PostContent
                            content={post.content}
                            posts={posts}
                            onPostLinkClick={handlePostLinkClick}
                            isThreadPage={true}
                          />
                        </div>
                      ) : (
                        <div className="card-body py-2">
                          <p className="text-secondary mb-0 small">
                            <em>Post hidden</em>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-muted">No posts available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Reply Form */}
        <div className="card bg-mid-dark border-secondary shadow">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0 text-light">Reply to Thread</h2>
          </div>
          <div className="card-body">
            {postError && (
              <div className="alert alert-danger" role="alert">
                {postError}
              </div>
            )}

            <form onSubmit={handleSubmitPost}>
              <div className="mb-3">
                <label htmlFor="content" className="form-label text-secondary">
                  Content
                </label>
                <textarea
                  ref={contentTextareaRef}
                  className="form-control bg-dark text-light border-secondary"
                  id="content"
                  rows="4"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your reply"
                  maxLength="2000"
                ></textarea>
                <div className="form-text text-secondary">
                  Click on any post number above to quote it
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="image" className="form-label text-secondary">
                  Image or Video (Optional)
                </label>
                <input
                  type="file"
                  className="form-control bg-dark text-light border-secondary"
                  id="image"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  onChange={handleImageChange}
                />
                <div className="form-text text-secondary">
                  Supported formats: PNG, JPG, WebP, GIF, MP4, WebM (Max size:
                  4MB)
                </div>
              </div>

              {imagePreview && (
                <div className="mb-3">
                  <label className="form-label text-secondary">
                    File Preview
                  </label>
                  <div className="border border-secondary p-2 rounded">
                    {image && image.type.startsWith("video/") ? (
                      <video
                        src={imagePreview}
                        className="img-fluid"
                        style={{ maxHeight: "200px" }}
                        controls
                        muted
                      />
                    ) : (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="img-fluid"
                        style={{ maxHeight: "200px" }}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="d-grid gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={postLoading}
                >
                  {postLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Posting...
                    </>
                  ) : (
                    "Post Reply"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
