// frontend/src/components/ThreadDeleteButton.js

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export default function ThreadDeleteButton({
  threadId,
  boardId,
  isOwnThread,
  isModerator,
  adminUser,
  onDeleted,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Don't show button if user can't delete
  if (!isOwnThread && !isModerator) {
    return null;
  }

  const handleDelete = async () => {
    // Validate reason for moderator deletion
    if (isModerator && !isOwnThread && !deleteReason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const options = {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      };

      // Add credentials for admin users
      if (isModerator) {
        options.credentials = "include";
      }

      // Add reason if provided (for moderation logging)
      if (deleteReason.trim()) {
        options.body = JSON.stringify({ reason: deleteReason });
      }

      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}`,
        options
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete thread");
      }

      // If we have a callback, call it
      if (onDeleted) {
        onDeleted(threadId);
      }

      // Navigate back to board
      navigate(`/board/${boardId}`);
    } catch (err) {
      console.error("Error deleting thread:", err);
      setError(err.message || "Failed to delete thread");
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        className={`btn btn-sm ${
          isModerator && !isOwnThread
            ? "btn-outline-danger"
            : "btn-outline-secondary"
        }`}
        onClick={() => setShowConfirm(true)}
        title={
          isOwnThread
            ? "Delete your thread"
            : `Delete thread (${adminUser?.role})`
        }
      >
        <i className="bi bi-trash"></i> Delete Thread
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Delete Thread</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowConfirm(false);
                    setError(null);
                    setDeleteReason("");
                  }}
                  disabled={deleting}
                ></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <p>Are you sure you want to delete this thread?</p>
                <p className="text-warning">
                  <strong>Warning:</strong> This will permanently delete the
                  thread and all posts within it.
                </p>

                {/* Show reason field for moderators */}
                {isModerator && !isOwnThread && (
                  <div className="mb-3">
                    <label
                      htmlFor="deleteReason"
                      className="form-label text-secondary"
                    >
                      Reason for Deletion *
                    </label>
                    <textarea
                      className="form-control bg-dark text-light border-secondary"
                      id="deleteReason"
                      rows="3"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Enter reason for deletion..."
                      required
                      disabled={deleting}
                    ></textarea>
                    <div className="form-text text-muted">
                      This will be logged in the moderation system.
                    </div>
                  </div>
                )}

                {isOwnThread && (
                  <p className="text-secondary small mb-0">
                    This action cannot be undone.
                  </p>
                )}
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setShowConfirm(false);
                    setError(null);
                    setDeleteReason("");
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Deleting...
                    </>
                  ) : (
                    "Delete Thread"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
