// frontend/src/components/CreateThreadPage.js

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { handleApiError } from "../utils/apiErrorHandler";
import postOwnershipManager from "../utils/postOwnershipManager";
import threadOwnershipManager from "../utils/threadOwnershipManager";
import PreviewableTextArea from "./PreviewableTextArea";

// Mock Link component for artifact
const Link = ({ to, children, className }) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export default function CreateThreadPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();

  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [board, setBoard] = useState(null);

  // Survey state
  const [includeSurvey, setIncludeSurvey] = useState(false);
  const [surveyType, setSurveyType] = useState("single");
  const [surveyQuestion, setSurveyQuestion] = useState("");
  const [surveyOptions, setSurveyOptions] = useState(["", ""]);
  const [surveyExpiresIn, setSurveyExpiresIn] = useState("");

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
        e.target.value = null;
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
        e.target.value = null;
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

  // Survey option management
  const addSurveyOption = () => {
    if (surveyOptions.length < 16) {
      setSurveyOptions([...surveyOptions, ""]);
    }
  };

  const removeSurveyOption = (index) => {
    if (surveyOptions.length > 2) {
      setSurveyOptions(surveyOptions.filter((_, i) => i !== index));
    }
  };

  const updateSurveyOption = (index, value) => {
    const newOptions = [...surveyOptions];
    newOptions[index] = value;
    setSurveyOptions(newOptions);
  };

  // Calculate survey expiration date
  const calculateSurveyExpiresAt = () => {
    if (!surveyExpiresIn) return null;

    const now = new Date();
    const [value, unit] = surveyExpiresIn.split("-");
    const amount = parseInt(value);

    switch (unit) {
      case "hours":
        now.setHours(now.getHours() + amount);
        break;
      case "days":
        now.setDate(now.getDate() + amount);
        break;
      case "weeks":
        now.setDate(now.getDate() + amount * 7);
        break;
      default:
        return null;
    }

    return now.toISOString();
  };

  // Validate survey data
  const validateSurvey = () => {
    if (!includeSurvey) return true;

    if (!surveyQuestion.trim()) {
      setError("Survey question is required");
      return false;
    }

    const validOptions = surveyOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      setError("Survey must have at least 2 options");
      return false;
    }

    return true;
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

    if (!validateSurvey()) {
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
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = handleApiError(errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Track the OP post as owned by the user
      if (data.postId) {
        postOwnershipManager.addPost(data.postId);
      }

      // Track the thread as owned by the user
      if (data.threadId) {
        threadOwnershipManager.addThread(data.threadId);
      }

      // Create survey if requested
      if (includeSurvey && data.postId) {
        try {
          const validOptions = surveyOptions.filter((opt) => opt.trim());

          const surveyResponse = await fetch(
            `${API_BASE_URL}/api/boards/${boardId}/threads/${data.threadId}/posts/${data.postId}/survey`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                survey_type: surveyType,
                question: surveyQuestion.trim(),
                options: validOptions,
                expires_at: calculateSurveyExpiresAt(),
              }),
            }
          );

          if (!surveyResponse.ok) {
            console.error("Failed to create survey, but thread was created");
          }
        } catch (surveyErr) {
          console.error("Error creating survey:", surveyErr);
          // Don't fail the thread creation if survey fails
        }
      }

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
                  className="form-control bg-dark text-light border-secondary"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter thread topic"
                  required
                  maxLength="100"
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="content" className="form-label text-secondary">
                  Content
                </label>
                <PreviewableTextArea
                  id="content"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your post content"
                  disabled={loading}
                  maxLength={2000}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="image" className="form-label text-secondary">
                  Image or Video (Required)
                </label>
                <input
                  type="file"
                  className="form-control bg-dark text-light border-secondary"
                  id="image"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  onChange={handleImageChange}
                  required
                  disabled={loading}
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

              {/* Survey Section */}
              <div className="card bg-dark border-secondary mb-3">
                <div className="card-header border-secondary">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="includeSurvey"
                      checked={includeSurvey}
                      onChange={(e) => setIncludeSurvey(e.target.checked)}
                      disabled={loading}
                    />
                    <label className="form-check-label" htmlFor="includeSurvey">
                      Add a survey/poll to this thread
                    </label>
                  </div>
                </div>

                {includeSurvey && (
                  <div className="card-body">
                    {/* Survey Type */}
                    <div className="mb-3">
                      <label className="form-label text-secondary">
                        Survey Type
                      </label>
                      <div>
                        <div className="form-check form-check-inline">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="surveyType"
                            id="singleChoice"
                            value="single"
                            checked={surveyType === "single"}
                            onChange={(e) => setSurveyType(e.target.value)}
                            disabled={loading}
                          />
                          <label
                            className="form-check-label"
                            htmlFor="singleChoice"
                          >
                            Single Choice
                          </label>
                        </div>
                        <div className="form-check form-check-inline">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="surveyType"
                            id="multipleChoice"
                            value="multiple"
                            checked={surveyType === "multiple"}
                            onChange={(e) => setSurveyType(e.target.value)}
                            disabled={loading}
                          />
                          <label
                            className="form-check-label"
                            htmlFor="multipleChoice"
                          >
                            Multiple Choice
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Survey Question */}
                    <div className="mb-3">
                      <label
                        htmlFor="surveyQuestion"
                        className="form-label text-secondary"
                      >
                        Survey Question
                      </label>
                      <input
                        type="text"
                        className="form-control bg-dark text-light border-secondary"
                        id="surveyQuestion"
                        value={surveyQuestion}
                        onChange={(e) => setSurveyQuestion(e.target.value)}
                        placeholder="What would you like to ask?"
                        maxLength="200"
                        disabled={loading}
                      />
                    </div>

                    {/* Survey Options */}
                    <div className="mb-3">
                      <label className="form-label text-secondary">
                        Options (minimum 2, maximum 16)
                      </label>
                      {surveyOptions.map((option, index) => (
                        <div key={index} className="input-group mb-2">
                          <span className="input-group-text bg-dark text-secondary border-secondary">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            className="form-control bg-dark text-light border-secondary"
                            value={option}
                            onChange={(e) =>
                              updateSurveyOption(index, e.target.value)
                            }
                            placeholder={`Option ${index + 1}`}
                            maxLength="100"
                            disabled={loading}
                          />
                          {surveyOptions.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => removeSurveyOption(index)}
                              disabled={loading}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      ))}

                      {surveyOptions.length < 16 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={addSurveyOption}
                          disabled={loading}
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Add Option
                        </button>
                      )}
                    </div>

                    {/* Survey Expiration */}
                    <div className="mb-3">
                      <label
                        htmlFor="surveyExpiresIn"
                        className="form-label text-secondary"
                      >
                        Expires In (optional)
                      </label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        id="surveyExpiresIn"
                        value={surveyExpiresIn}
                        onChange={(e) => setSurveyExpiresIn(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Never</option>
                        <option value="1-hours">1 Hour</option>
                        <option value="6-hours">6 Hours</option>
                        <option value="12-hours">12 Hours</option>
                        <option value="1-days">1 Day</option>
                        <option value="3-days">3 Days</option>
                        <option value="7-days">1 Week</option>
                        <option value="14-days">2 Weeks</option>
                        <option value="30-days">1 Month</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

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
