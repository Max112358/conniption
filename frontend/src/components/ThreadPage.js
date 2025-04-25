// components/ThreadPage.js

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";
const SOCKET_URL = "https://conniption.onrender.com";

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

  // Use useCallback to memoize fetchPosts function to avoid dependency issues
  const fetchPosts = useCallback(async () => {
    try {
      const postsResponse = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
      );
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
  }, [boardId, threadId, fetchPosts]); // Added fetchPosts to dependencies

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
          <div className="card-header border-secondary">
            <h1 className="h3 mb-0">
              <span className="badge bg-secondary me-2">/{boardId}/</span>
              {thread.topic}
            </h1>
          </div>
          <div className="card-body">
            <p className="text-muted mb-0">
              Thread created: {new Date(thread.created_at).toLocaleString()}
            </p>
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
                    className="card bg-high-dark border-secondary mb-3"
                  >
                    <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                      <div>
                        <span className="text-muted">Post #{index + 1}</span>
                      </div>
                      <small className="text-muted">
                        {new Date(post.created_at).toLocaleString()}
                      </small>
                    </div>
                    <div className="card-body">
                      {post.image_url && (
                        <div className="mb-3">
                          <img
                            src={post.image_url}
                            alt="Post content"
                            className="img-fluid mb-2"
                            style={{ maxHeight: "300px" }}
                          />
                        </div>
                      )}
                      <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
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
