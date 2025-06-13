// frontend/src/components/BanNotification.js
import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export default function BanNotification({ ban, boardId, onClose }) {
  const [appealText, setAppealText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  // Format expiration date
  const formatExpiration = () => {
    if (!ban.expires_at) {
      return "permanent";
    }

    const expiresDate = new Date(ban.expires_at);
    return expiresDate.toLocaleString();
  };

  // Handle appeal submission
  const handleSubmitAppeal = async (e) => {
    e.preventDefault();

    if (!appealText.trim()) {
      setError("Please enter an appeal reason");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/appeal/${ban.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ appealText }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit appeal");
      }

      setSubmitted(true);
      setShowAppealForm(false);
    } catch (err) {
      console.error("Error submitting appeal:", err);
      setError(err.message || "Failed to submit appeal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-5">
      <div className="container">
        <div className="card bg-dark border-danger shadow">
          <div className="card-header bg-danger text-white">
            <h1 className="h4 mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              You are banned from this board
            </h1>
          </div>
          <div className="card-body">
            <div className="alert alert-dark" role="alert">
              <p className="mb-1">
                <strong>Reason:</strong> {ban.reason}
              </p>

              {ban.expires_at && (
                <p className="mb-1">
                  <strong>Expires:</strong> {formatExpiration()}
                </p>
              )}

              {!ban.expires_at && (
                <p className="mb-0">
                  <strong>Ban type:</strong> Permanent
                </p>
              )}
            </div>

            {/* Display banned post content if available */}
            {ban.post_content && (
              <div className="mt-4">
                <div className="card bg-mid-dark border-secondary mb-4">
                  <div className="card-header border-secondary">
                    <h2 className="h5 mb-0">Post that resulted in ban:</h2>
                  </div>
                  <div className="card-body">
                    {ban.post_image_url && (
                      <div className="mb-3">
                        <img
                          src={ban.post_image_url}
                          alt="Banned post content"
                          className="img-fluid mb-2"
                          style={{ maxHeight: "300px" }}
                        />
                      </div>
                    )}
                    <p
                      className="text-light mb-0"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {ban.post_content}
                    </p>

                    {ban.thread_id && (
                      <div className="mt-3 text-muted small">
                        <strong>Thread ID:</strong> {ban.thread_id} |{" "}
                        <strong>Post ID:</strong> {ban.post_id || "N/A"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Appeal status message */}
            {ban.appeal_status && ban.appeal_status !== "none" && (
              <div
                className={`alert alert-${
                  ban.appeal_status === "pending"
                    ? "warning"
                    : ban.appeal_status === "approved"
                    ? "success"
                    : "danger"
                }`}
                role="alert"
              >
                <strong>Appeal status:</strong>{" "}
                {ban.appeal_status.charAt(0).toUpperCase() +
                  ban.appeal_status.slice(1)}
                {ban.appeal_status === "pending" && (
                  <p className="mt-2 mb-0">
                    Your appeal is being reviewed by the moderators. Please
                    check back later.
                  </p>
                )}
                {ban.appeal_status === "approved" && (
                  <p className="mt-2 mb-0">
                    Your appeal has been approved. This ban has been removed or
                    will expire soon.
                  </p>
                )}
                {ban.appeal_status === "denied" && (
                  <p className="mt-2 mb-0">
                    Your appeal has been denied. This ban remains in effect.
                  </p>
                )}
              </div>
            )}

            {/* Appeal submission success message */}
            {submitted && (
              <div className="alert alert-success" role="alert">
                <h4 className="alert-heading">Appeal Submitted!</h4>
                <p>
                  Your appeal has been submitted and will be reviewed by the
                  moderators. Please check back later to see the status of your
                  appeal.
                </p>
              </div>
            )}

            {/* Appeal form */}
            {!submitted && !ban.appeal_status && (
              <div className="mt-4">
                {!showAppealForm ? (
                  <button
                    className="btn btn-outline-warning"
                    onClick={() => setShowAppealForm(true)}
                  >
                    Submit an Appeal
                  </button>
                ) : (
                  <div className="card bg-mid-dark border-secondary">
                    <div className="card-header border-secondary">
                      <h2 className="h5 mb-0">Submit an Appeal</h2>
                    </div>
                    <div className="card-body">
                      {error && (
                        <div className="alert alert-danger" role="alert">
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleSubmitAppeal}>
                        <div className="mb-3">
                          <label
                            htmlFor="appealText"
                            className="form-label text-secondary"
                          >
                            Appeal Reason
                          </label>
                          <textarea
                            className="form-control bg-dark text-light border-secondary"
                            id="appealText"
                            rows="5"
                            value={appealText}
                            onChange={(e) => setAppealText(e.target.value)}
                            placeholder="Explain why this ban should be removed..."
                            required
                            disabled={submitting}
                          ></textarea>
                          <div className="form-text text-muted">
                            Be honest and respectful in your appeal. Include any
                            relevant information that may help the moderators
                            reconsider the ban.
                          </div>
                        </div>

                        <div className="d-flex justify-content-between">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowAppealForm(false)}
                            disabled={submitting}
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            className="btn btn-warning"
                            disabled={submitting}
                          >
                            {submitting ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-2"
                                  role="status"
                                  aria-hidden="true"
                                ></span>
                                Submitting...
                              </>
                            ) : (
                              "Submit Appeal"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Link to="/" className="btn btn-outline-light">
                ← Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
