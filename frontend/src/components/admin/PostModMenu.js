// frontend/src/components/admin/PostModMenu.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
import IPHistoryModal from "./IPHistoryModal";

export default function PostModMenu({
  post,
  thread,
  board,
  isAdmin,
  isMod,
  adminUser,
  onColorChanged,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIPHistory, setShowIPHistory] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [colorReason, setColorReason] = useState("");
  const [selectedColor, setSelectedColor] = useState(post.color || "black");
  const [deleting, setDeleting] = useState(false);
  const [changingColor, setChangingColor] = useState(false);
  const [error, setError] = useState(null);
  const [colorError, setColorError] = useState(null);
  const [fetchingIP, setFetchingIP] = useState(false);
  const [postIP, setPostIP] = useState(null);
  const navigate = useNavigate();

  // Only show menu for admins, moderators, and janitors
  if (!isAdmin && !isMod && adminUser?.role !== "janitor") {
    return null;
  }

  // Available colors for posts
  const availableColors = [
    { value: "black", label: "Black (Default)", color: "#212529" },
    { value: "red", label: "Red", color: "#dc3545" },
    { value: "orange", label: "Orange", color: "#fd7e14" },
    { value: "yellow", label: "Yellow", color: "#ffc107" },
    { value: "green", label: "Green", color: "#28a745" },
    { value: "blue", label: "Blue", color: "#007bff" },
    { value: "purple", label: "Purple", color: "#6f42c1" },
    { value: "brown", label: "Brown", color: "#795548" },
  ];

  // Check if user can change colors (moderators and admins only, not janitors)
  const canChangeColor = isAdmin || (isMod && adminUser?.role !== "janitor");

  // Fetch IP address for the post
  const fetchPostIP = async () => {
    setFetchingIP(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/posts/${post.id}/ip?boardId=${board.id}&threadId=${thread.id}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch IP address");
      }

      const data = await response.json();
      setPostIP(data.ip_address);
      return data.ip_address;
    } catch (err) {
      console.error("Error fetching IP:", err);
      setError("Failed to fetch IP address");
      return null;
    } finally {
      setFetchingIP(false);
    }
  };

  // Handle checking mod history
  const handleCheckModHistory = async () => {
    setShowMenu(false);

    // If we don't have the IP yet, fetch it first
    let ipToCheck = postIP;
    if (!ipToCheck) {
      ipToCheck = await fetchPostIP();
    }

    if (ipToCheck) {
      setShowIPHistory(true);
    }
  };

  // Handle ban user navigation
  const handleBanUser = () => {
    // Close dropdown
    setShowMenu(false);

    // Navigate to the ban creation page with post context
    navigate("/admin/bans/create", {
      state: {
        postContext: {
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

  // Handle color change confirmation
  const handleColorChangeConfirm = () => {
    setShowColorPicker(true);
    setShowMenu(false);
    setSelectedColor(post.color || "black");
    setColorReason("");
    setColorError(null);
  };

  // Handle post color change
  const handleChangeColor = async () => {
    setChangingColor(true);
    setColorError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/posts/${post.id}/color`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            boardId: board.id,
            threadId: thread.id,
            color: selectedColor,
            reason: colorReason.trim() || undefined,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to change post color");
      }

      await response.json(); // Ensure response is consumed

      // Close the modal
      setShowColorPicker(false);

      // Call the callback to update the post color in the UI
      if (onColorChanged) {
        onColorChanged(post.id, selectedColor);
      }
    } catch (err) {
      console.error("Error changing post color:", err);
      setColorError(err.message || "Failed to change post color");
    } finally {
      setChangingColor(false);
    }
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
              className="dropdown-item bg-dark text-light"
              type="button"
              onClick={handleCheckModHistory}
              disabled={fetchingIP}
            >
              <i className="bi bi-clock-history me-2"></i>
              {fetchingIP ? "Loading..." : "Check Mod History"}
            </button>

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

            {canChangeColor && (
              <button
                className="dropdown-item text-info bg-dark text-light"
                type="button"
                onClick={handleColorChangeConfirm}
              >
                <i className="bi bi-palette me-2"></i> Change Color
              </button>
            )}

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

      {/* IP History Modal */}
      {showIPHistory && postIP && (
        <IPHistoryModal
          ipAddress={postIP}
          onClose={() => setShowIPHistory(false)}
        />
      )}

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

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Change Post Color</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowColorPicker(false)}
                  disabled={changingColor}
                ></button>
              </div>
              <div className="modal-body">
                {colorError && (
                  <div className="alert alert-danger" role="alert">
                    {colorError}
                  </div>
                )}

                <p>Select a color for post #{post.id}:</p>

                <div className="mb-3">
                  <label className="form-label">Color</label>
                  <div className="row g-2">
                    {availableColors.map((colorOption) => (
                      <div key={colorOption.value} className="col-6">
                        <div
                          className={`p-2 rounded border ${
                            selectedColor === colorOption.value
                              ? "border-primary border-2"
                              : "border-secondary"
                          }`}
                          style={{
                            cursor: "pointer",
                            backgroundColor:
                              colorOption.value === "black"
                                ? "transparent"
                                : colorOption.color + "20",
                          }}
                          onClick={() => setSelectedColor(colorOption.value)}
                        >
                          <div className="d-flex align-items-center">
                            <div
                              className="me-2"
                              style={{
                                width: "20px",
                                height: "20px",
                                backgroundColor: colorOption.color,
                                borderRadius: "4px",
                                border: "1px solid rgba(255,255,255,0.3)",
                              }}
                            ></div>
                            <span className="text-light">
                              {colorOption.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="colorReason" className="form-label">
                    Reason (Optional)
                  </label>
                  <textarea
                    className="form-control bg-dark text-light border-secondary"
                    id="colorReason"
                    rows="2"
                    value={colorReason}
                    onChange={(e) => setColorReason(e.target.value)}
                    placeholder="Enter reason for color change..."
                    disabled={changingColor}
                  ></textarea>
                  <div className="form-text text-muted">
                    Providing a reason helps maintain transparency in
                    moderation.
                  </div>
                </div>

                <div className="alert alert-info" role="alert">
                  <h6 className="alert-heading">Color Guidelines:</h6>
                  <small>
                    <ul className="mb-0">
                      <li>
                        <strong>Red:</strong> Serious violations or warnings
                      </li>
                      <li>
                        <strong>Yellow:</strong> Cautions or important notices
                      </li>
                      <li>
                        <strong>Green:</strong> Approved or verified content
                      </li>
                      <li>
                        <strong>Blue:</strong> Informational posts
                      </li>
                      <li>
                        <strong>Orange:</strong> Temporary warnings
                      </li>
                      <li>
                        <strong>Purple:</strong> Special announcements
                      </li>
                      <li>
                        <strong>Brown:</strong> Archived or outdated content
                      </li>
                    </ul>
                  </small>
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowColorPicker(false)}
                  disabled={changingColor}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleChangeColor}
                  disabled={changingColor}
                >
                  {changingColor ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Changing...
                    </>
                  ) : (
                    "Change Color"
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
