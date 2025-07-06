// frontend/src/components/PostDeleteButton.js

import { useState } from "react";
import { API_BASE_URL } from "../config/api";

export default function PostDeleteButton({
  post,
  boardId,
  threadId,
  onDeleted,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts/${post.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete post");
      }

      // Call the onDeleted callback to update parent state
      if (onDeleted) {
        onDeleted(post.id);
      }

      setShowConfirm(false);
    } catch (err) {
      console.error("Error deleting post:", err);
      setError(err.message || "Failed to delete post");
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-sm btn-outline-danger"
        onClick={() => setShowConfirm(true)}
        title="Delete your post"
      >
        <i className="bi bi-trash"></i> Delete
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-sm">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Delete Post</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                ></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger alert-sm" role="alert">
                    {error}
                  </div>
                )}
                <p>Are you sure you want to delete this post?</p>
                <p className="text-muted small mb-0">
                  This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
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
                    "Delete Post"
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
