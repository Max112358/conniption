// components/CreateThreadPage.js

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";

export default function CreateThreadPage() {
  const { boardId } = useParams();
  console.log("CreateThreadPage mounting, boardId:", boardId);
  const navigate = useNavigate();

  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!topic.trim()) {
      setError("Topic is required");
      return;
    }

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    if (!image) {
      setError("Image is required");
      return;
    }

    setLoading(true);
    setError(null);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("content", content);
    formData.append("image", image);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads`,
        {
          method: "POST",
          body: formData,
          // Note: Don't set Content-Type header when using FormData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create thread");
      }

      const data = await response.json();

      // Show success message before redirecting
      setError(null);
      setSuccessMessage(
        "Thread created successfully! Redirecting to thread..."
      );

      // Redirect to the new thread after a short delay
      setTimeout(() => {
        navigate(`/board/${boardId}/thread/${data.threadId}`);
      }, 1500);
    } catch (err) {
      console.error("Error creating thread:", err);
      setError(
        err.message || "Failed to create thread. Please try again later."
      );
      setLoading(false);
    }
  };

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

        <div className="card bg-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h1 className="h3 mb-0">Create New Thread</h1>
          </div>
          <div className="card-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success" role="alert">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="topic" className="form-label">
                  Thread Topic
                </label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter thread topic"
                  required
                  maxLength="100"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="content" className="form-label">
                  Content
                </label>
                <textarea
                  className="form-control bg-dark text-light border-secondary"
                  id="content"
                  rows="5"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your post content"
                  required
                  maxLength="2000"
                ></textarea>
              </div>

              <div className="mb-3">
                <label htmlFor="image" className="form-label">
                  Image (Required)
                </label>
                <input
                  type="file"
                  className="form-control bg-dark text-light border-secondary"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  required
                />
                <div className="form-text text-muted">
                  Supported formats: JPEG, PNG, GIF (Max size: 5MB)
                </div>
              </div>

              {imagePreview && (
                <div className="mb-3">
                  <label className="form-label">Image Preview</label>
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
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Creating Thread...
                    </>
                  ) : (
                    "Create Thread"
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
