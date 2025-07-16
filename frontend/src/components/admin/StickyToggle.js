// frontend/src/components/admin/StickyToggle.js
import { useState } from "react";
import { API_BASE_URL } from "../../config/api";

export default function StickyToggle({
  threadId,
  boardId,
  isSticky,
  adminUser,
  onStickyChanged,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Show for admins and moderators (not janitors)
  if (
    !adminUser ||
    (adminUser.role !== "admin" && adminUser.role !== "moderator")
  ) {
    return null;
  }

  const handleToggleSticky = async () => {
    setLoading(true);
    setError(null);

    try {
      const method = isSticky ? "DELETE" : "PUT";
      const response = await fetch(
        `${API_BASE_URL}/api/admin/boards/${boardId}/threads/${threadId}/sticky`,
        {
          method,
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sticky status");
      }

      const data = await response.json();
      console.log(data.message);

      // Call the callback to update the UI
      if (onStickyChanged) {
        onStickyChanged(threadId, !isSticky);
      }
    } catch (err) {
      console.error("Error toggling sticky:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`btn btn-sm ${
          isSticky ? "btn-warning" : "btn-outline-warning"
        }`}
        onClick={handleToggleSticky}
        disabled={loading}
        title={isSticky ? "Remove sticky" : "Make sticky"}
      >
        <i className={`bi bi-pin${isSticky ? "-fill" : ""}`}></i>
        {loading && (
          <span
            className="spinner-border spinner-border-sm ms-1"
            role="status"
            aria-hidden="true"
          ></span>
        )}
      </button>
      {error && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-3"
          style={{ zIndex: 1050 }}
        >
          <div
            className="alert alert-danger alert-dismissible fade show"
            role="alert"
          >
            {error}
            <button
              type="button"
              className="btn-close"
              onClick={() => setError(null)}
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}
    </>
  );
}
