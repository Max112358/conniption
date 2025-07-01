// frontend/src/components/CreateThreadPage.js

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

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
  const [board, setBoard] = useState(null);

  // Fetch board details on component mount
  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);
        if (response.ok) {
          const data = await response.json();
          setBoard(data.board);
        }
      } catch (err) {
        console.error("Error fetching board data:", err);
        // Don't set error state here as it's not critical for thread creation
      }
    };

    fetchBoardData();
  }, [boardId]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (4MB limit)
      if (file.size > 4 * 1024 * 1024) {
        setError("File size must be less than 4MB");
        e.target.value = null; // Clear the input
        setImage(null);
        setImagePreview(null);
        return;
      }

      // Check file type
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError(
          "Invalid file type. Only PNG, JPG, WebP, GIF, MP4, and WebM files are allowed."
        );
        e.target.value = null; // Clear the input
        setImage(null);
        setImagePreview(null);
        return;
      }

      setImage(file);
      setError(null);

      // Create preview
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
      setError("Image or video is required");
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

        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <div className="d-flex align-items-center justify-content-between">
              <h1 className="h3 mb-0 text-light">Create New Thread</h1>
              {board && (
                <div className="text-end">
                  <span className="badge bg-secondary me-2">/{board.id}/</span>
                  <span className="text-secondary">{board.name}</span>
                  {board.nsfw && (
                    <span className="badge bg-danger ms-2">NSFW</span>
                  )}
                </div>
              )}
            </div>
            {board && (
              <p className="text-secondary mb-0 mt-2">{board.description}</p>
            )}
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
                <label htmlFor="topic" className="form-label text-secondary">
                  Thread Topic
                </label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary text-light"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter thread topic"
                  required
                  maxLength="100"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="content" className="form-label text-secondary">
                  Content
                </label>
                <textarea
                  className="form-control bg-dark text-light border-secondary text-light"
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
                <label htmlFor="image" className="form-label text-secondary">
                  Image or Video (Required)
                </label>
                <input
                  type="file"
                  className="form-control bg-dark text-light border-secondary text-light"
                  id="image"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  onChange={handleImageChange}
                  required
                />
                <div className="text-secondary mt-1 small">
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
