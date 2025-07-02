// frontend/src/components/PostHeader.js
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
  // Get thread ID color if applicable
  const threadIdColor = post.thread_user_id
    ? getThreadIdColor(post.thread_user_id)
    : null;

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

      <small className="text-secondary">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}
