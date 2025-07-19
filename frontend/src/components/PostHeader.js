// frontend/src/components/PostHeader.js
import { useState } from "react";
import FlagIcon from "./FlagIcon";
import HideButton from "./HideButton";
import { getThreadIdColor } from "../utils/threadIdColors";
import postOwnershipManager from "../utils/postOwnershipManager";

// Component for reply link preview
const ReplyLinkPreview = ({ postId, posts, x, y }) => {
  const post = posts.find((p) => p.id === parseInt(postId));

  if (!post) return null;

  const isVideo =
    post.file_type === "video" ||
    (post.image_url &&
      (post.image_url.toLowerCase().endsWith(".mp4") ||
        post.image_url.toLowerCase().endsWith(".webm")));

  const isAudio =
    post.file_type === "audio" ||
    (post.image_url && post.image_url.toLowerCase().endsWith(".mp3"));

  return (
    <div
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        maxWidth: "400px",
        zIndex: 9999,
        pointerEvents: "none",
        backgroundColor: "#1a1d20",
        border: "2px solid #495057",
        borderRadius: "0.375rem",
        padding: "1rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-secondary">Post #{post.id}</span>
        <small className="text-secondary">
          {new Date(post.created_at).toLocaleString()}
        </small>
      </div>
      {post.image_url && (
        <div className="mb-2">
          {isAudio ? (
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-music-note-beamed text-primary fs-4"></i>
              <span className="text-light small">Audio File</span>
            </div>
          ) : isVideo ? (
            <div className="position-relative d-inline-block">
              <video
                src={post.image_url}
                className="img-fluid"
                style={{
                  maxHeight: "100px",
                  maxWidth: "100px",
                  objectFit: "cover",
                  borderRadius: "4px",
                }}
                muted
                playsInline
                preload="metadata"
              />
              <div
                className="position-absolute top-50 start-50 translate-middle"
                style={{
                  width: "30px",
                  height: "30px",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="bi bi-play-fill text-white"></i>
              </div>
            </div>
          ) : (
            <img
              src={post.image_url}
              alt="Preview"
              className="img-fluid"
              style={{
                maxHeight: "100px",
                maxWidth: "100px",
                objectFit: "cover",
                borderRadius: "4px",
              }}
            />
          )}
        </div>
      )}
      <p className="text-light mb-0 small" style={{ whiteSpace: "pre-wrap" }}>
        {post.content.length > 200
          ? post.content.substring(0, 200) + "..."
          : post.content}
      </p>
    </div>
  );
};

export default function PostHeader({
  post,
  posts = [], // All posts in the thread
  isOP,
  onPostNumberClick,
  onPostLinkClick,
  showThreadId = false,
  showCountryFlag = false,
  isPostHidden = false,
  isUserHidden = false,
  onTogglePostHidden,
  onToggleUserHidden,
  isThreadDead = false,
}) {
  const [showTimeAgo, setShowTimeAgo] = useState(false);
  const [hoveredReplyId, setHoveredReplyId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
  };

  // Find all posts that reply to this post
  const getReplies = () => {
    if (!posts || posts.length === 0) {
      console.log(`No posts array for post ${post.id}`);
      return [];
    }

    const replies = [];
    const postIdStr = post.id.toString();

    posts.forEach((p) => {
      if (p.id !== post.id && p.content) {
        // Simple check - does the content contain >>postId
        if (p.content.includes(`>>${postIdStr}`)) {
          replies.push(p.id);
        }
      }
    });

    //console.log(`Total replies found for post ${postIdStr}: ${replies.length}`);
    return replies;
  };

  const replies = getReplies();

  const handlePostNumberClick = (e) => {
    // Prevent event from bubbling to thread card
    if (e) {
      e.stopPropagation();
    }

    if (isThreadDead) return; // Don't allow quoting in dead threads
    if (onPostNumberClick) {
      onPostNumberClick(post.id);
    }
  };

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      {/* Post hide button */}
      {onTogglePostHidden && (
        <HideButton
          isHidden={isPostHidden}
          onToggle={() => onTogglePostHidden(post.id)}
          title={isPostHidden ? "Unhide this post" : "Hide this post"}
        />
      )}

      {/* OP badge */}
      {isOP && <span className="badge bg-primary">OP</span>}

      <div>
        <span className="text-secondary">Post #</span>
        <span
          className={`${isThreadDead ? "text-secondary" : "text-primary"}`}
          style={{ cursor: isThreadDead ? "default" : "pointer", zIndex: 10 }}
          onClick={handlePostNumberClick}
          title={
            isThreadDead
              ? "Cannot quote posts in archived threads"
              : "Click to reply to this post"
          }
        >
          {post.id}
        </span>
      </div>

      {/* User hide button */}
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

      {/* Reply links */}
      {replies.length > 0 && (
        <div className="d-flex align-items-center gap-1">
          <span className="text-secondary small">Replies:</span>
          {replies.map((replyId, index) => {
            const isYou = postOwnershipManager.isOwnPost(replyId);
            return (
              <span key={replyId}>
                <span
                  className="text-info small"
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPostLinkClick(replyId, post.thread_id);
                  }}
                  onMouseEnter={(e) => {
                    setHoveredReplyId(replyId);
                    const rect = e.target.getBoundingClientRect();
                    setMousePos({
                      x: rect.left,
                      y: rect.bottom + 5,
                    });
                  }}
                  onMouseLeave={() => setHoveredReplyId(null)}
                >
                  &gt;&gt;{replyId}
                  {isYou && " (You)"}
                </span>
                {index < replies.length - 1 && (
                  <span className="text-secondary">, </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Reply preview */}
      {hoveredReplyId && posts.length > 0 && (
        <ReplyLinkPreview
          postId={hoveredReplyId}
          posts={posts}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </div>
  );
}
