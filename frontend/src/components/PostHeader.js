// frontend/src/components/PostHeader.js
import { useState } from "react";
import { getFlagEmoji, getCountryName } from "../utils/countryFlags";
import { getThreadIdColor } from "../utils/threadIdColors";

export default function PostHeader({
  post,
  onPostNumberClick,
  showThreadId = false,
  showCountryFlag = false,
}) {
  const [showCountryTooltip, setShowCountryTooltip] = useState(false);

  // Get thread ID color if applicable
  const threadIdColor = post.thread_user_id
    ? getThreadIdColor(post.thread_user_id)
    : null;

  return (
    <div className="d-flex align-items-center gap-2">
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
        <span
          className="position-relative"
          style={{ fontSize: "1.2rem", cursor: "help" }}
          onMouseEnter={() => setShowCountryTooltip(true)}
          onMouseLeave={() => setShowCountryTooltip(false)}
        >
          {getFlagEmoji(post.country_code)}

          {showCountryTooltip && (
            <span
              className="position-absolute bg-dark text-light px-2 py-1 rounded"
              style={{
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginTop: "0.25rem",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
                zIndex: 1000,
                border: "1px solid #495057",
              }}
            >
              {getCountryName(post.country_code)}
            </span>
          )}
        </span>
      )}

      <small className="text-secondary">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}
