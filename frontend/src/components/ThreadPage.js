// frontend/src/components/ThreadPage.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import PostModMenu from "./admin/PostModMenu";
import BanNotification from "./BanNotification";
import MediaViewer from "./MediaViewer";
import PostContent from "./PostContent";
import PostHeader from "./PostHeader";
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
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [board, setBoard] = useState(null);

  const contentTextareaRef = useRef(null);

  // Add custom CSS for highlight animation
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes postHighlight {
        0% { background-color: rgba(255, 193, 7, 0.5) !important; }
        100% { background-color: transparent; }
      }
      .post-highlight {
        animation: postHighlight 2s ease-in-out;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Check for admin user
  useEffect(() => {
    const storedUser = localStorage.getItem("adminUser");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setAdminUser(userData);
      } catch (err) {
        console.error("Error parsing admin user data:", err);
      }
    }
  }, []);

  // Use useCallback to memoize fetchPosts function to avoid dependency issues
  const fetchPosts = useCallback(async () => {
    try {
      const postsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
      );

      // Check if response indicates the user is banned
      if (postsResponse.status === 403) {
        const errorData = await postsResponse.json();
        if (errorData.error === "Banned") {
          setBanned(true);
          setBanInfo(errorData.ban);
          return false;
        }
      }

      if (!postsResponse.ok) {
        throw new Error("Failed to load posts");
      }

      const postsData = await postsResponse.json();
      setPosts(postsData.posts || []);
      return true;
    } catch (err) {
      console.error("Error fetching posts:", err);
      return false;
    }
  }, [boardId, threadId]);

  useEffect(() => {
    // Socket.io setup with better error handling
    console.log("Connecting to Socket.io server at:", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      // Start with polling, allow upgrade to websocket
      transports: ["polling", "websocket"],
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Timeout settings
      timeout: 20000,
      // Path must match server
      path: "/socket.io/",
      // Force new connection
      forceNew: true,
      // Additional options for stability
      rejectUnauthorized: false,
    });

    // Socket event handlers
    socket.on("connect", () => {
      console.log("Socket.io connected successfully");
      // Join the thread room after connection
      socket.emit("join_thread", { boardId, threadId });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.io disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error.message);
    });

    // Listen for new posts
    socket.on("post_created", (data) => {
      console.log("New post created:", data);
      if (data.threadId === parseInt(threadId) && data.boardId === boardId) {
        // Refresh posts when a new post is created
        fetchPosts();
      }
    });

    // Fetch thread and its posts
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
        await fetchPosts();

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

    // Cleanup function to leave the thread room
    return () => {
      if (socket.connected) {
        socket.emit("leave_thread", { boardId, threadId });
      }
      socket.disconnect();
    };
  }, [boardId, threadId, fetchPosts]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (4MB limit)
      if (file.size > 4 * 1024 * 1024) {
        setPostError("File size must be less than 4MB");
        e.target.value = null;
        setImage(null);
        setImagePreview(null);
        return;
      }

      setImage(file);
      setPostError(null);

      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle post submission
  const handleSubmitPost = async (e) => {
    e.preventDefault();

    // validation (checks for content OR image):
    if (!content.trim() && !image) {
      setPostError("Either content or an image/video is required");
      return;
    }

    setPostLoading(true);
    setPostError(null);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("content", content);
    if (image) {
      formData.append("image", image);
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      // Reset form
      setContent("");
      setImage(null);
      setImagePreview(null);

      // Clear file input
      const fileInput = document.getElementById("image");
      if (fileInput) {
        fileInput.value = "";
      }

      // Fetch updated posts
      await fetchPosts();

      setPostLoading(false);
    } catch (err) {
      console.error("Error creating post:", err);
      setPostError(
        err.message || "Failed to create post. Please try again later."
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

  // Check if user is admin or moderator
  const isAdmin = adminUser && adminUser.role === "admin";
  const isModerator =
    adminUser && (adminUser.role === "moderator" || adminUser.role === "admin");

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
            <p className="mt-3">Loading thread...</p>
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

        {/* Thread Header - FIXED COLORS HERE */}
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

              {/* Admin badge */}
              {adminUser && (
                <span
                  className={`badge bg-${
                    adminUser.role === "admin"
                      ? "danger"
                      : adminUser.role === "moderator"
                      ? "warning"
                      : "info"
                  }`}
                >
                  {adminUser.role.charAt(0).toUpperCase() +
                    adminUser.role.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0 text-light">Posts</h2>
          </div>
          <div className="card-body">
            {posts.length > 0 ? (
              <div className="post-list">
                {posts.map((post, index) => (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className="card bg-dark border-secondary mb-3"
                    style={{ transition: "background-color 0.3s ease" }}
                  >
                    <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                      <PostHeader
                        post={post}
                        onPostNumberClick={handlePostNumberClick}
                        showThreadId={board?.thread_ids_enabled}
                        showCountryFlag={board?.country_flags_enabled}
                      />

                      {/* Moderation menu */}
                      {isModerator && (
                        <PostModMenu
                          post={post}
                          thread={thread}
                          board={{ id: boardId }}
                          isAdmin={isAdmin}
                          isMod={isModerator}
                        />
                      )}
                    </div>
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
                  </div>
                ))}
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
                <div className="form-text text-muted">
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
                <div className="form-text text-muted">
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
