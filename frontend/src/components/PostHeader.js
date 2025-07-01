// frontend/src/components/PostHeader.js
import FlagIcon from "./FlagIcon";
import { getThreadIdColor } from "../utils/threadIdColors";

export default function PostHeader({
  post,
  onPostNumberClick,
  showThreadId = false,
  showCountryFlag = false,
}) {
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
        <FlagIcon
          countryCode={post.country_code}
          size="small"
          showTooltip={true}
        />
      )}

      <small className="text-secondary">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}
