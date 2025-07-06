// frontend/src/components/PostHeader.js
import { useState } from "react";
import FlagIcon from "./FlagIcon";
import HideButton from "./HideButton";
import { getThreadIdColor } from "../utils/threadIdColors";

export default function PostHeader({
  post,
  onPostNumberClick,
  showThreadId = false,
  showCountryFlag = false,
  isPostHidden = false,
  isUserHidden = false,
  onTogglePostHidden,
  onToggleUserHidden,
}) {
  const [showTimeAgo, setShowTimeAgo] = useState(false);

  // Get thread ID color if applicable
  const threadIdColor = post.thread_user_id
    ? getThreadIdColor(post.thread_user_id)
    : null;

  // Calculate time ago
  const getTimeAgo = () => {
    const now = new Date();
    const postTime = new Date(post.created_at);
    const diffMs = now - postTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffMins < 1440) {
      // Less than 24 hours
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
  };

  return (
    <div className="d-flex align-items-center gap-2">
      {/* Post hide button - to the left of post number */}
      {onTogglePostHidden && (
        <HideButton
          isHidden={isPostHidden}
          onToggle={() => onTogglePostHidden(post.id)}
          title={isPostHidden ? "Unhide this post" : "Hide this post"}
        />
      )}

      <div>
        <span className="text-secondary">Post #</span>
        <span
          className="text-primary"
          style={{ cursor: "pointer" }}
          onClick={() => onPostNumberClick(post.id)}
          title="Click to reply to this post"
        >
          {post.id}
        </span>
      </div>

      {/* User hide button - to the left of thread ID */}
      {showThreadId && post.thread_user_id && onToggleUserHidden && (
        <HideButton
          isHidden={isUserHidden}
          onToggle={() => onToggleUserHidden(post.thread_user_id)}
          title={isUserHidden ? "Unhide this user" : "Hide this user"}
        />
      )}

      {/* Thread ID */}
      {showThreadId && post.thread_user_id && (
        <span
          className="badge"
          style={{
            backgroundColor: threadIdColor,
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "0.75rem",
          }}
          title="Thread ID - unique per user in this thread"
        >
          {post.thread_user_id}
        </span>
      )}

      {/* Country Flag */}
      {showCountryFlag && post.country_code && (
        <FlagIcon
          countryCode={post.country_code}
          size="small"
          showTooltip={true}
        />
      )}

      <small
        className="text-secondary position-relative"
        style={{ cursor: "help" }}
        onMouseEnter={() => setShowTimeAgo(true)}
        onMouseLeave={() => setShowTimeAgo(false)}
      >
        {new Date(post.created_at).toLocaleString()}

        {showTimeAgo && (
          <span
            className="position-absolute bg-dark text-light px-2 py-1 rounded"
            style={{
              bottom: "125%",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.875rem",
              whiteSpace: "nowrap",
              zIndex: 1000,
              border: "1px solid #495057",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
          >
            {getTimeAgo()}
          </span>
        )}
      </small>
    </div>
  );
}
