// frontend/src/components/admin/CreateBan.js
import { useState, useEffect } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function CreateBan() {
  const { adminUser } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we have post context from location state
  const postContext = location.state?.postContext || null;

  const [ipAddress, setIpAddress] = useState("");
  const [boardId, setBoardId] = useState(postContext?.boardId || "");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("30d"); // Default to 30 days
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [boards, setBoards] = useState([]);
  const [fetchingIp, setFetchingIp] = useState(false);

  // Post context fields
  const [postContent, setPostContent] = useState(postContext?.content || "");
  const [postImage, setPostImage] = useState(postContext?.imageUrl || "");
  const [threadId, setThreadId] = useState(postContext?.threadId || "");
  const [postId, setPostId] = useState(postContext?.postId || "");

  // Expiration options - Limit moderators to 1 month max
  const getExpirationOptions = () => {
    const options = [
      { value: "1h", label: "1 Hour" },
      { value: "6h", label: "6 Hours" },
      { value: "12h", label: "12 Hours" },
      { value: "1d", label: "1 Day" },
      { value: "3d", label: "3 Days" },
      { value: "7d", label: "1 Week" },
      { value: "14d", label: "2 Weeks" },
      { value: "30d", label: "1 Month" },
    ];

    // Add permanent and longer options for admins only
    if (adminUser.role === "admin") {
      options.push(
        { value: "90d", label: "3 Months" },
        { value: "180d", label: "6 Months" },
        { value: "365d", label: "1 Year" },
        { value: "", label: "Permanent" }
      );
    }

    return options;
  };

  const expirationOptions = getExpirationOptions();

  // Fetch boards for dropdown
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards`);

        if (!response.ok) {
          throw new Error("Failed to fetch boards");
        }

        const data = await response.json();
        setBoards(data.boards || []);
      } catch (err) {
        console.error("Error fetching boards:", err);
        // Don't set error state here, as it's not critical
      }
    };

    fetchBoards();
  }, []);

  // Fetch IP address if we have post context
  useEffect(() => {
    const fetchIpAddress = async () => {
      // Only fetch if we have post context with required fields and no IP address yet
      if (
        postContext &&
        postContext.postId &&
        postContext.boardId &&
        postContext.threadId
      ) {
        setFetchingIp(true);
        setError(null);

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/admin/posts/${postContext.postId}/ip?boardId=${postContext.boardId}&threadId=${postContext.threadId}`,
            {
              credentials: "include",
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch IP address");
          }

          const data = await response.json();

          // Only update if we got valid data
          if (data.ip_address) {
            setIpAddress(data.ip_address);
          }

          // Update post content if provided and not already set
          if (data.post_content) {
            setPostContent((prev) => prev || data.post_content);
          }

          // Update post image if provided and not already set
          if (data.image_url) {
            setPostImage((prev) => prev || data.image_url);
          }
        } catch (err) {
          console.error("Error fetching IP address:", err);
          setError(`Failed to fetch IP address: ${err.message}`);
        } finally {
          setFetchingIp(false);
        }
      }
    };

    // Only fetch if we don't have an IP address yet
    if (!ipAddress && postContext) {
      fetchIpAddress();
    }
  }, [postContext, ipAddress]); // Now properly depending on ipAddress

  // Convert duration string to actual date
  const calculateExpirationDate = (durationStr) => {
    if (!durationStr) return null;

    const now = new Date();
    const match = durationStr.match(/^(\d+)([dhmy])$/);

    if (!match) return null;

    const [, amount, unit] = match;
    const numAmount = parseInt(amount, 10);

    switch (unit) {
      case "d": // days
        now.setDate(now.getDate() + numAmount);
        break;
      case "h": // hours
        now.setHours(now.getHours() + numAmount);
        break;
      case "m": // months
        now.setMonth(now.getMonth() + numAmount);
        break;
      case "y": // years
        now.setFullYear(now.getFullYear() + numAmount);
        break;
      default:
        return null;
    }

    return now;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!ipAddress.trim()) {
      setError("IP address is required");
      return;
    }

    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate expiration date if needed
      const expirationDate = calculateExpirationDate(expiresAt);

      const response = await fetch(`${API_BASE_URL}/api/admin/bans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ip_address: ipAddress,
          board_id: boardId || null, // Convert empty string to null for global ban
          reason,
          expires_at: expirationDate ? expirationDate.toISOString() : null,
          post_content: postContent || null,
          post_image_url: postImage || null,
          thread_id: threadId ? parseInt(threadId) : null,
          post_id: postId ? parseInt(postId) : null,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create ban");
      }

      // Redirect back to ban list
      navigate("/admin/bans");
    } catch (err) {
      console.error("Error creating ban:", err);
      setError(err.message || "Failed to create ban. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <h1 className="h3 mb-4">Create New Ban</h1>

      <div className="card bg-mid-dark border-secondary">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0 text-light">Ban Details</h2>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {fetchingIp && (
            <div className="alert alert-info" role="alert">
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Fetching IP address...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Ban Information */}
            <div className="mb-3">
              <label htmlFor="ipAddress" className="form-label text-secondary">
                IP Address *
              </label>
              <input
                type="text"
                className="form-control bg-dark text-light border-secondary"
                id="ipAddress"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="e.g. 192.168.1.1"
                required
                disabled={loading || fetchingIp}
              />
              <div className="form-text text-secondary">
                {fetchingIp
                  ? "Fetching IP address from post..."
                  : "Enter the IP address to ban"}
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="boardId" className="form-label text-secondary">
                Board
              </label>
              <select
                className="form-select bg-dark text-light border-secondary"
                id="boardId"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                disabled={loading}
              >
                {adminUser.role === "admin" && (
                  <option value="">Global (All Boards)</option>
                )}
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    /{board.id}/ - {board.name}
                  </option>
                ))}
              </select>
              <div className="form-text text-secondary">
                {adminUser.role === "admin"
                  ? "Leave empty for a global ban across all boards"
                  : "Select the board for this ban"}
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="reason" className="form-label text-secondary">
                Reason *
              </label>
              <textarea
                className="form-control bg-dark text-light border-secondary"
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows="3"
                placeholder="Reason for ban..."
                required
                disabled={loading}
              ></textarea>
              <div className="form-text text-secondary">
                Provide a clear reason for the ban
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="expiresAt" className="form-label text-secondary">
                Duration
              </label>
              <select
                className="form-select bg-dark text-light border-secondary"
                id="expiresAt"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={loading}
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="form-text text-secondary">
                {adminUser.role === "admin"
                  ? "Select ban duration or set as permanent"
                  : "Moderators can set bans up to 1 month maximum"}
              </div>
            </div>

            {/* Post Context Information */}
            {!postContext && (
              <div className="card bg-dark border-secondary mb-4">
                <div className="card-header border-secondary">
                  <h3 className="h6 mb-0 text-light">
                    Post Context (Optional)
                  </h3>
                </div>
                <div className="card-body">
                  <div className="form-text text-muted mb-3">
                    You can provide post context to show the user what content
                    resulted in their ban.
                  </div>

                  <div className="mb-3">
                    <label htmlFor="threadId" className="form-label text-light">
                      Thread ID
                    </label>
                    <input
                      type="number"
                      className="form-control bg-dark text-light border-secondary"
                      id="threadId"
                      value={threadId}
                      onChange={(e) => setThreadId(e.target.value)}
                      placeholder="Thread ID"
                      disabled={loading}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="postId" className="form-label text-light">
                      Post ID
                    </label>
                    <input
                      type="number"
                      className="form-control bg-dark text-light border-secondary"
                      id="postId"
                      value={postId}
                      onChange={(e) => setPostId(e.target.value)}
                      placeholder="Post ID"
                      disabled={loading}
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="postContent"
                      className="form-label text-secondary"
                    >
                      Post Content
                    </label>
                    <textarea
                      className="form-control bg-dark text-light border-secondary"
                      id="postContent"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      rows="3"
                      placeholder="Content of the post that resulted in ban..."
                      disabled={loading}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="postImage"
                      className="form-label text-secondary"
                    >
                      Post Image URL
                    </label>
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      id="postImage"
                      value={postImage}
                      onChange={(e) => setPostImage(e.target.value)}
                      placeholder="URL to the post image"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Post Context Display (when provided via navigation state) */}
            {postContext && (
              <div className="card bg-dark border-secondary mb-4">
                <div className="card-header border-secondary">
                  <h3 className="h6 mb-0 text-light">Post Context</h3>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <p className="mb-1 text-light">
                      <strong>Thread ID:</strong> {threadId}
                    </p>
                    <p className="mb-1 text-light">
                      <strong>Post ID:</strong> {postId}
                    </p>
                  </div>

                  {postImage && (
                    <div className="mb-3">
                      <label className="form-label text-light">Image</label>
                      <div className="border border-secondary p-2 rounded">
                        <img
                          src={postImage}
                          alt="Post"
                          className="img-fluid"
                          style={{ maxHeight: "200px" }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label text-light">Content</label>
                    <div className="border border-secondary p-2 rounded bg-dark">
                      <p
                        className="mb-0 text-light"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {postContent}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate("/admin/bans")}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-danger"
                disabled={loading || fetchingIp || !ipAddress}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Creating Ban...
                  </>
                ) : (
                  "Create Ban"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
