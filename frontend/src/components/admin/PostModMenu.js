// frontend/src/components/admin/PostModMenu.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function PostModMenu({ post, thread, board, isAdmin, isMod }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Only show menu for admins and moderators
  if (!isAdmin && !isMod) {
    return null;
  }

  // Handle ban user navigation
  const handleBanUser = () => {
    // Close dropdown
    setShowMenu(false);

    // Navigate to the ban creation page with post context
    navigate("/admin/bans/create", {
      state: {
        postContext: {
          ipAddress: post.ip_address,
          boardId: board.id,
          threadId: thread.id,
          postId: post.id,
          content: post.content,
          imageUrl: post.image_url,
        },
      },
    });
  };

  // Handle post deletion confirmation
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  // Handle post deletion submission
  const handleDeletePost = async () => {
    if (!deleteReason.trim()) {
      setError("Reason is required");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/posts/${post.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            boardId: board.id,
            threadId: thread.id,
            reason: deleteReason,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete post");
      }

      // Get the response data which includes IP address for potential ban
      const data = await response.json();

      // Ask if the user wants to ban the poster
      if (
        window.confirm(
          `Post deleted successfully. Would you like to ban the user (${data.ipAddress})?`
        )
      ) {
        // Navigate to the ban creation page with post context
        navigate("/admin/bans/create", {
          state: {
            postContext: {
              ipAddress: data.ipAddress,
              boardId: board.id,
              threadId: thread.id,
              postId: post.id,
              content: data.postContent,
              imageUrl: data.imageUrl,
            },
          },
        });
      } else {
        // Refresh the page to show the post is deleted
        window.location.reload();
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      setError(err.message || "Failed to delete post");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="dropdown d-inline-block">
        <button
          className="btn btn-sm btn-outline-secondary"
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          aria-expanded={showMenu}
        >
          <i className="bi bi-shield"></i> Mod
        </button>

        {showMenu && (
          <div
            className="dropdown-menu show bg-dark border-secondary text-light"
            style={{
              position: "absolute",
              zIndex: 1000,
              minWidth: "10rem",
              right: 0,
            }}
          >
            <h6 className="dropdown-header text-secondary">Post #{post.id}</h6>

            <button
              className="dropdown-item text-danger bg-dark text-light"
              type="button"
              onClick={handleBanUser}
            >
              <i className="bi bi-hammer me-2"></i> Ban User
            </button>

            <button
              className="dropdown-item text-warning bg-dark text-light"
              type="button"
              onClick={handleDeleteConfirm}
            >
              <i className="bi bi-trash me-2"></i> Delete Post
            </button>

            <div className="dropdown-divider border-secondary"></div>

            <button
              className="dropdown-item text-secondary bg-dark text-light"
              type="button"
              onClick={() => setShowMenu(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Delete Post</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                ></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <p>Are you sure you want to delete post #{post.id}?</p>

                <div className="mb-3">
                  <label htmlFor="deleteReason" className="form-label">
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
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeletePost}
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
