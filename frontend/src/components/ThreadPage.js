// frontend/src/components/ThreadPage.js

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import PostModMenu from "./admin/PostModMenu";
import BanNotification from "./BanNotification";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";
const SOCKET_URL = "https://conniption.onrender.com";

// Component for expandable images
const ExpandableImage = ({ src, alt, postId }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleImageClick = (e) => {
    e.preventDefault();
    setIsExpanded(!isExpanded);
  };

  if (!src) return null;

  return (
    <div className="mb-3">
      <img
        src={src}
        alt={alt}
        className="img-fluid"
        style={{
          maxHeight: isExpanded ? "none" : "250px",
          maxWidth: isExpanded ? "100%" : "250px",
          objectFit: isExpanded ? "contain" : "cover",
          cursor: "pointer",
          borderRadius: "4px",
          transition: "all 0.3s ease",
        }}
        onClick={handleImageClick}
        title={isExpanded ? "Click to collapse" : "Click to expand"}
      />
      {!isExpanded && (
        <div className="small text-muted mt-1">Click to expand</div>
      )}
    </div>
  );
};

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
    // Socket.io setup
    const socket = io(SOCKET_URL);

    // Join the thread room
    socket.emit("join_thread", { boardId, threadId });

    // Listen for new posts
    socket.on("post_created", (data) => {
      if (data.threadId === parseInt(threadId) && data.boardId === boardId) {
        // Refresh posts when a new post is created
        fetchPosts();
      }
    });

    // Fetch thread and its posts
    const fetchThreadData = async () => {
      try {
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
      socket.emit("leave_thread", { boardId, threadId });
      socket.disconnect();
    };
  }, [boardId, threadId, fetchPosts]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);

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

    if (!content.trim()) {
      setPostError("Content is required");
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

        {/* Thread Header */}
        <div className="card bg-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0">
              <span className="badge bg-secondary me-2">/{boardId}/</span>
              {thread.topic}
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
              <p className="text-muted mb-0">
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
                    className="card bg-dark border-secondary mb-3"
                  >
                    <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                      <div>
                        <span className="text-secondary">
                          Post #{index + 1}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <small className="text-secondary">
                          {new Date(post.created_at).toLocaleString()}
                        </small>

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
                    </div>
                    <div className="card-body">
                      {/* Use the new ExpandableImage component */}
                      {post.image_url && (
                        <ExpandableImage
                          src={post.image_url}
                          alt="Post content"
                          postId={post.id}
                        />
                      )}
                      <p
                        className="text-light mb-0"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {post.content}
                      </p>
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
                  className="form-control bg-dark text-light border-secondary"
                  id="content"
                  rows="4"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your reply"
                  required
                  maxLength="2000"
                ></textarea>
              </div>

              <div className="mb-3">
                <label htmlFor="image" className="form-label text-secondary">
                  Image (Optional)
                </label>
                <input
                  type="file"
                  className="form-control bg-dark text-light border-secondary"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <div className="form-text text-muted">
                  Supported formats: JPEG, PNG, GIF (Max size: 5MB)
                </div>
              </div>

              {imagePreview && (
                <div className="mb-3">
                  <label className="form-label text-secondary">
                    Image Preview
                  </label>
                  <div className="border border-secondary p-2 rounded">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="img-fluid"
                      style={{ maxHeight: "200px" }}
                    />
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
